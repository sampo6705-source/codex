const http = require("http");
const https = require("https");
const { URL } = require("url");

const port = Number(process.env.PORT || 8787);
const cache = new Map();
const fallbackStocks = [
  { code: "0050", name: "元大台灣50", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "0056", name: "元大高股息", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "00878", name: "國泰永續高股息", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "1101", name: "台泥", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "1216", name: "統一", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "1301", name: "台塑", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2002", name: "中鋼", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2303", name: "聯電", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2317", name: "鴻海", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2330", name: "台積電", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2412", name: "中華電", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2454", name: "聯發科", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2881", name: "富邦金", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "2882", name: "國泰金", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "3008", name: "大立光", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "3034", name: "聯詠", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "3711", name: "日月光投控", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "4938", name: "和碩", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "5871", name: "中租-KY", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "6505", name: "台塑化", market: "上市", suffix: "TW", close: null, referencePrice: null },
  { code: "8069", name: "元太", market: "上櫃", suffix: "TWO", close: null, referencePrice: null },
  { code: "8299", name: "群聯", market: "上櫃", suffix: "TWO", close: null, referencePrice: null },
];

const staticTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function requestText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 TradeJournal/1.0",
        "Accept": "application/json,text/plain,*/*",
      },
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(body);
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function cached(key, ms, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < ms) return hit.value;
  const value = await loader();
  cache.set(key, { time: Date.now(), value });
  return value;
}

function cleanNumber(value) {
  if (value === undefined || value === null) return null;
  const num = Number(String(value).replace(/,/g, "").replace("--", ""));
  return Number.isFinite(num) ? num : null;
}

async function loadTwseStocks() {
  const text = await requestText("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");
  const rows = JSON.parse(text);
  return rows
    .filter((row) => row.Code && row.Name)
    .map((row) => ({
      code: row.Code,
      name: row.Name,
      market: "上市",
      suffix: "TW",
      close: cleanNumber(row.ClosingPrice),
      referencePrice: cleanNumber(row.ClosingPrice),
    }));
}

async function loadTpexStocks() {
  const text = await requestText("https://www.tpex.org.tw/web/stock/aftertrading/DAILY_CLOSE_quotes/stk_quote_result.php?l=zh-tw&o=json");
  const json = JSON.parse(text);
  const rows = json.aaData || [];
  return rows
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      code: String(row[0]).trim(),
      name: String(row[1]).trim(),
      market: "上櫃",
      suffix: "TWO",
      close: cleanNumber(row[2]),
      referencePrice: cleanNumber(row[2]),
    }));
}

async function getStocks() {
  return cached("stocks", 15 * 60 * 1000, async () => {
    const results = await Promise.allSettled([loadTwseStocks(), loadTpexStocks()]);
    const stocks = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const filtered = stocks
      .filter((stock) => /^\d{4,6}$/.test(stock.code))
      .sort((a, b) => a.code.localeCompare(b.code, "zh-Hant"));
    return filtered.length ? filtered : fallbackStocks;
  });
}

function yahooSymbol(code, market) {
  return `${code}.${market === "上櫃" ? "TWO" : "TW"}`;
}

async function getQuote(code, market) {
  return cached(`quote:${market}:${code}`, 12000, async () => {
    const symbol = yahooSymbol(code, market);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
    const text = await requestText(url);
    const data = JSON.parse(text);
    const result = data.chart && data.chart.result && data.chart.result[0];
    if (!result) throw new Error("no quote");
    const meta = result.meta || {};
    const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    const closes = (quote.close || []).filter((value) => typeof value === "number");
    const price = cleanNumber(meta.regularMarketPrice) || closes[closes.length - 1];
    const close = price || cleanNumber(meta.previousClose);
    const seconds = meta.regularMarketTime || Math.floor(Date.now() / 1000);
    const time = new Date(seconds * 1000).toLocaleString("zh-TW", { hour12: false });
    return {
      code,
      market,
      price,
      close,
      time,
      note: "行情用 Yahoo Finance 代理抓取；正式商用即時報價需另外申請授權。",
    };
  });
}

async function getQuotes(items) {
  const normalized = items
    .filter((item) => item.code)
    .slice(0, 80)
    .map((item) => ({ code: item.code, market: item.market || "上市" }));
  const results = await Promise.allSettled(normalized.map((item) => getQuote(item.code, item.market)));
  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const fs = require("fs");
  const path = require("path");
  const pathname = new URL(req.url, `http://localhost:${port}`).pathname;
  const safeName = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(__dirname, safeName);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": staticTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname === "/api/stocks") {
      sendJson(res, { stocks: await getStocks() });
      return;
    }
    if (url.pathname === "/api/quote") {
      const code = url.searchParams.get("code");
      const market = url.searchParams.get("market") || "上市";
      if (!code) {
        sendJson(res, { error: "missing code" }, 400);
        return;
      }
      sendJson(res, await getQuote(code, market));
      return;
    }
    if (url.pathname === "/api/quotes") {
      const raw = url.searchParams.get("items") || "";
      const items = raw.split(",").map((part) => {
        const [code, market] = part.split(":");
        return { code, market };
      });
      sendJson(res, { quotes: await getQuotes(items) });
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, { error: error.message }, 500);
  }
});

server.listen(port, () => {
  console.log(`Trade journal app: http://localhost:${port}`);
});
