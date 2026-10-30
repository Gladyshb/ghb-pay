import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fiatMap: Record<string, string> = { KSH: "KES" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function p2pPrice(fiat: string, tradeType: "BUY" | "SELL") {
  try {
    const result = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        fiat,
        page: 1,
        rows: 10,
        tradeType,
        asset: "USDT",
        countries: [],
        payTypes: [],
        publisherType: null,
      }),
    });
    if (!result.ok) return null;
    const json = await result.json();
    const prices = (json?.data || [])
      .map((item: { adv?: { price?: string } }) => Number(item.adv?.price))
      .filter((price: number) => Number.isFinite(price) && price > 0)
      .sort((a: number, b: number) => a - b);
    return prices.length ? prices[Math.floor(prices.length / 2)] : null;
  } catch (error) {
    console.error("Binance P2P rate lookup failed:", error);
    return null;
  }
}

async function fallbackRates() {
  try {
    const result = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!result.ok) return null;
    const json = await result.json();
    return json?.rates || null;
  } catch (error) {
    console.error("Fallback exchange-rate lookup failed:", error);
    return null;
  }
}

function computeRates(reference: number, feePercent: number, fixedSpread: number) {
  if (fixedSpread > 0) {
    return {
      buy: +(reference + fixedSpread).toFixed(4),
      sell: +Math.max(0, reference - fixedSpread).toFixed(4),
    };
  }
  return {
    buy: +(reference * (1 + feePercent / 100)).toFixed(4),
    sell: +(reference * (1 - feePercent / 100)).toFixed(4),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return response({ error: "Supabase function environment is incomplete." }, 500);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authorization = request.headers.get("Authorization");
  const schedulerSecret = Deno.env.get("SCHEDULER_SECRET");
  let authorized = Boolean(schedulerSecret && request.headers.get("x-scheduler-secret") === schedulerSecret);

  if (authorization) {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError) return response({ error: "Unauthorized" }, 401);
    if (user) {
      const { data: profile, error: profileError } = await service
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileError) return response({ error: "Unable to authorize this request." }, 500);
      authorized = profile.role === "admin";
    }
  }

  if (!authorized) return response({ error: "Administrator access required." }, 403);

  try {
    const { data: currencies, error: currenciesError } = await service
      .from("currencies")
      .select("*")
      .order("code")
      .limit(1000);
    if (currenciesError) throw currenciesError;

    const automatic = currencies.filter((item) =>
      !["USD", "USDT"].includes(item.code.toUpperCase()) && !item.manual_override
    );
    const probe = automatic.length
      ? await p2pPrice(fiatMap[automatic[0].code.toUpperCase()] || automatic[0].code.toUpperCase(), "SELL")
      : null;
    const useBinance = Boolean(probe);
    const externalRates = useBinance ? null : await fallbackRates();
    const now = new Date().toISOString();
    const results = [];

    for (const currency of currencies) {
      const code = currency.code.toUpperCase();
      const fee = Number(currency.fee_percent ?? 5);
      const spread = Number(currency.spread_fixed ?? 0);
      if (code === "USD" || code === "USDT") {
        const { error } = await service.from("currencies").update({
          binance_rate: 1,
          buy_rate: 1,
          sell_rate: 1,
          last_synced_at: now,
        }).eq("id", currency.id);
        if (error) throw error;
        results.push({ code, ref: 1, buy: 1, sell: 1, source: "base", manual: false });
        continue;
      }

      let reference = Number(currency.binance_rate) || 0;
      let source = "manual";
      if (!currency.manual_override && useBinance) {
        const fiat = fiatMap[code] || code;
        const [ask, bid] = await Promise.all([p2pPrice(fiat, "SELL"), p2pPrice(fiat, "BUY")]);
        reference = ask && bid ? (ask + bid) / 2 : ask || bid || reference;
        source = "binance";
      } else if (!currency.manual_override && externalRates) {
        reference = Number(externalRates[fiatMap[code] || code]) || reference;
        source = "fallback";
      }

      if (!reference || reference <= 0) {
        results.push({ code, status: "no_rate", source });
        continue;
      }
      const { buy, sell } = computeRates(reference, fee, spread);
      const values: Record<string, unknown> = {
        buy_rate: buy,
        sell_rate: sell,
        last_synced_at: now,
      };
      if (!currency.manual_override) values.binance_rate = +reference.toFixed(4);
      const { error } = await service.from("currencies").update(values).eq("id", currency.id);
      if (error) throw error;
      results.push({ code, ref: +reference.toFixed(4), buy, sell, source, manual: currency.manual_override });
    }

    return response({
      ok: true,
      source: useBinance ? "binance" : externalRates ? "fallback" : "manual",
      synced: results.length,
      results,
    });
  } catch (error) {
    console.error("Rate synchronization failed:", error);
    return response({ error: error instanceof Error ? error.message : "Rate synchronization failed." }, 500);
  }
});
