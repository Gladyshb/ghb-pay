// Cloudflare Worker — Proxy Binance P2P (USDT)
// Renvoie le prix médian du marché P2P pour une devise donnée.
// Usage: GET https://<ton-worker>.workers.dev/?fiat=BIF&tradeType=SELL&asset=USDT
// Réponse: { fiat, tradeType, asset, price, count, source: "binance_p2p" }

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Content-Type": "application/json",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const fiat = (url.searchParams.get("fiat") || "USD").toUpperCase();
    const tradeType = (url.searchParams.get("tradeType") || "SELL").toUpperCase(); // SELL = ask, BUY = bid
    const asset = (url.searchParams.get("asset") || "USDT").toUpperCase();

    try {
      const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Origin": "https://p2p.binance.com",
          "Referer": "https://p2p.binance.com/",
        },
        body: JSON.stringify({
          fiat, page: 1, rows: 20, tradeType, asset,
          countries: [], payTypes: [], publisherType: null,
        }),
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: `binance_http_${res.status}`, fiat, tradeType }), { status: 502, headers: cors });
      }
      const json = await res.json();
      const prices = (json?.data || [])
        .map((d) => parseFloat(d?.adv?.price))
        .filter((p) => !isNaN(p) && p > 0)
        .sort((a, b) => a - b);

      if (!prices.length) {
        return new Response(JSON.stringify({ error: "no_data", fiat, tradeType }), { status: 502, headers: cors });
      }
      const median = prices[Math.floor(prices.length / 2)];
      return new Response(JSON.stringify({ fiat, tradeType, asset, price: median, count: prices.length, source: "binance_p2p" }), { headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, fiat, tradeType }), { status: 500, headers: cors });
    }
  }
};