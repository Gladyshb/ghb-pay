import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Map app currency codes to Binance P2P fiat codes (only non-standard ones need an entry).
const FIAT_MAP = { KSH: "KES" };

// Fetch the median USDT P2P price for a fiat on a given side (SELL = ask, BUY = bid).
// Routes through the Cloudflare Worker proxy to bypass Binance 403 blocks.
// Proxy URL resolved from AppConfig (admin-managed secure field), read fresh each sync.
async function getProxyUrl(base44) {
  let url = "";
  try {
    const { items } = await base44.asServiceRole.entities.AppConfig.filter({}, { limit: 1 });
    url = (items[0]?.binance_proxy_url || "").trim();
  } catch {}
  return url.replace(/\/$/, "");
}

async function p2pPrice(fiat, tradeType, base44) {
  const proxyBase = await getProxyUrl(base44);
  try {
    if (proxyBase) {
      const url = `${proxyBase}/?fiat=${encodeURIComponent(fiat)}&tradeType=${encodeURIComponent(tradeType)}&asset=USDT`;
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        const json = await res.json();
        const price = parseFloat(json?.price);
        if (!isNaN(price) && price > 0) return price;
      }
      return null;
    }
    // Direct fallback (likely 403 from Binance when no proxy configured).
    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://p2p.binance.com",
        "Referer": "https://p2p.binance.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify({
        fiat, page: 1, rows: 10, tradeType, asset: "USDT",
        countries: [], payTypes: [], publisherType: null,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const prices = (json?.data || [])
      .map((d) => parseFloat(d?.adv?.price))
      .filter((p) => !isNaN(p) && p > 0)
      .sort((a, b) => a - b);
    if (!prices.length) return null;
    return prices[Math.floor(prices.length / 2)];
  } catch {
    return null;
  }
}

// Fallback: free open exchange rates (no key, server-side friendly) — one batch call.
async function fallbackRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const json = await res.json();
    return json?.rates || null;
  } catch {
    return null;
  }
}

// Compute client Buy/Sell rates from a reference rate.
// Buy  = reference + spread  (user BUYS USDT, pays MORE local currency) -> GREEN
// Sell = reference - spread  (user SELLS USDT, gets LESS local currency) -> WHITE
function computeRates(ref, feePercent, spreadFixed) {
  const r = Number(ref) || 0;
  const fee = Number(feePercent) || 0;
  const spread = Number(spreadFixed) || 0;
  let buy, sell;
  if (spread > 0) {
    buy = +(r + spread).toFixed(4);
    sell = +Math.max(0, r - spread).toFixed(4);
  } else {
    buy = +(r * (1 + fee / 100)).toFixed(4);
    sell = +(r * (1 - fee / 100)).toFixed(4);
  }
  return { buy, sell };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Enforce admin when invoked by a user; scheduled workflows call without a user.
    try {
      const me = await base44.auth.me();
      if (me && me.role !== "admin") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch {
      /* no user (workflow) — proceed with service role */
    }

    const cur = base44.asServiceRole.entities.Currency;
    const { items } = await cur.filter({}, { limit: 100 });

    // Only auto-fetch the reference rate for non-base currencies NOT under manual override.
    const autoFiats = items.filter((c) => {
      const code = (c.code || "").toUpperCase();
      return code !== "USD" && code !== "USDT" && !c.manual_override;
    });

    // Probe Binance P2P reachability once; if blocked (Cloudflare 403), use the fallback batch.
    let useBinance = false;
    if (autoFiats.length) {
      const probe = await p2pPrice(FIAT_MAP[autoFiats[0].code] || autoFiats[0].code, "SELL", base44);
      useBinance = !!probe;
    }
    let erRates = null;
    if (!useBinance) erRates = await fallbackRates();

    const now = new Date().toISOString();
    const results = [];

    for (const c of items) {
      const code = (c.code || "").toUpperCase();
      const fee = Number(c.fee_percent ?? 5);
      const spreadFixed = Number(c.spread_fixed ?? 0);

      // Base currencies (USD/USDT) carry no margin.
      if (code === "USD" || code === "USDT") {
        await cur.update(c.id, { binance_rate: 1, buy_rate: 1, sell_rate: 1, last_synced_at: now });
        results.push({ code, ref: 1, buy: 1, sell: 1, source: "base", manual: false });
        continue;
      }

      // Resolve the reference rate.
      let ref = Number(c.binance_rate) || 0;
      let source = "manual";
      if (c.manual_override) {
        source = "manual"; // admin-controlled reference (e.g. BIF = 6000)
      } else if (useBinance) {
        const fiat = FIAT_MAP[code] || code;
        const ask = await p2pPrice(fiat, "SELL", base44);
        const bid = await p2pPrice(fiat, "BUY", base44);
        if (ask && bid) ref = (ask + bid) / 2;
        else if (ask) ref = ask;
        else if (bid) ref = bid;
        source = "binance";
      } else if (erRates) {
        const r = erRates[FIAT_MAP[code] || code] || erRates[code];
        if (r) ref = r;
        source = "fallback";
      }

      if (!ref || ref <= 0) {
        results.push({ code, status: "no_rate", source });
        continue;
      }

      const { buy, sell } = computeRates(ref, fee, spreadFixed);
      const update = {
        buy_rate: buy,
        sell_rate: sell,
        last_synced_at: now,
      };
      // Only overwrite the reference when it was auto-fetched (manual = admin keeps it).
      if (!c.manual_override) update.binance_rate = +ref.toFixed(4);
      await cur.update(c.id, update);
      results.push({ code, ref: +ref.toFixed(4), buy, sell, source, manual: !!c.manual_override });
    }

    const overall = useBinance ? "binance" : (erRates ? "fallback" : "manual");
    return Response.json({ ok: true, source: overall, synced: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}