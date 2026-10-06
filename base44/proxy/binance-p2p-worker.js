// Cloudflare Worker — Proxy Binance P2P (USDT)
// Renvoie le prix médian du marché P2P pour une devise donnée.
// Usage: GET https://<ton-worker>.workers.dev/?fiat=BIF&tradeType=SELL&asset=USDT
// Réponse: { fiat, tradeType, asset, price, count, source: "binance_p2p" }

const BINANCE_ENDPOINT = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

const BROWSER_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Origin": "https://p2p.binance.com",
  "Referer": "https://p2p.binance.com/en/trade/all-payments/USDT?fiat=BIF",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "clienttype": "web",
  "lang": "en",
  "bnc-uuid": "f3d2e1a0-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
};

async function fetchBinance(fiat, tradeType, asset, attempt) {
  const body = JSON.stringify({
    fiat, page: 1, rows: 20, tradeType, asset,
    countries: [], payTypes: [], publisherType: null,
    tradeMethod: "all",
  });
  const headers = { ...BROWSER_HEADERS, "bnc-uuid": `f3d2e1a0-1b2c-3d4e-5f6a-7b8c9d0e1f${attempt}a` };
  return fetch(BINANCE_ENDPOINT, {
    method: "POST",
    headers,
    body,
    cf: { cacheTtl: 0, cacheEverything: false },
  });
}

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
    const tradeType = (url.searchParams.get("tradeType") || "SELL").toUpperCase();
    const asset = (url.searchParams.get("asset") || "USDT").toUpperCase();

    try {
      let res;
      // Retry up to 3 times — Binance occasionally 403s on the first attempt.
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetchBinance(fiat, tradeType, asset, attempt);
        if (res.ok || res.status !== 403) break;
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }

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