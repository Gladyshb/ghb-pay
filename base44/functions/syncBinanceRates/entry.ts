import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Map app currency codes to Binance P2P fiat codes (only non-standard ones need an entry).
const FIAT_MAP = { KSH: "KES" };

// Fetch the median USDT P2P price for a fiat on a given side (SELL = ask, BUY = bid).
async function p2pPrice(fiat, tradeType) {
  try {
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

    // Probe Binance P2P reachability once; if blocked (Cloudflare 403), use the fallback batch.
    const fiats = items.filter((c) => {
      const code = (c.code || "").toUpperCase();
      return code !== "USD" && code !== "USDT";
    });
    let useBinance = false;
    if (fiats.length) {
      const probe = await p2pPrice(FIAT_MAP[fiats[0].code] || fiats[0].code, "SELL");
      useBinance = !!probe;
    }
    let erRates = null;
    if (!useBinance) erRates = await fallbackRates();

    const results = [];
    for (const c of items) {
      const code = (c.code || "").toUpperCase();
      let binanceRate = 0;
      let source = "none";

      if (code === "USD" || code === "USDT") {
        binanceRate = 1;
        source = "base";
      } else if (useBinance) {
        const fiat = FIAT_MAP[code] || code;
        const ask = await p2pPrice(fiat, "SELL");
        const bid = await p2pPrice(fiat, "BUY");
        if (ask && bid) binanceRate = (ask + bid) / 2;
        else if (ask) binanceRate = ask;
        else if (bid) binanceRate = bid;
        source = "binance";
      } else if (erRates) {
        const r = erRates[FIAT_MAP[code] || code] || erRates[code];
        if (r) binanceRate = r;
        source = "fallback";
      }

      if (!binanceRate || binanceRate <= 0) {
        results.push({ code, status: "no_rate", source });
        continue;
      }

      const now = new Date().toISOString();
      const update = { binance_rate: +binanceRate.toFixed(4), last_synced_at: now };

      // Base currencies (USD/USDT) carry no margin.
      if (code === "USD" || code === "USDT") {
        if (!c.manual_override) { update.buy_rate = 1; update.sell_rate = 1; }
        results.push({ code, binance: 1, source, manual: !!c.manual_override });
        await cur.update(c.id, update);
        continue;
      }

      const fee = Number(c.fee_percent ?? 5);
      const sellRate = +(binanceRate * (1 + fee / 100)).toFixed(4);
      const buyRate = +(binanceRate * (1 - fee / 100)).toFixed(4);
      if (!c.manual_override) { update.sell_rate = sellRate; update.buy_rate = buyRate; }
      await cur.update(c.id, update);
      results.push({ code, binance: +binanceRate.toFixed(4), fee, sell: sellRate, buy: buyRate, source, manual: !!c.manual_override });
    }

    return Response.json({ ok: true, source: useBinance ? "binance" : (erRates ? "fallback" : "none"), synced: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}