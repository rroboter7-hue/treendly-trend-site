const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { URL, URLSearchParams } = require("url");

const PORT = Number(process.env.PORT || 4177);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const TREENDLY_BASE = (process.env.TREENDLY_API_BASE || "https://treendly.com/api").replace(/\/+$/, "");
const TREENDLY_UID = process.env.TREENDLY_UID || "";
const TREENDLY_PASSWORD = process.env.TREENDLY_PASSWORD || "";
const HAS_TREENDLY_CREDENTIALS = Boolean(TREENDLY_UID && TREENDLY_PASSWORD);
const ETSY_API_KEY = process.env.ETSY_API_KEY || "";
const HAS_ETSY_CREDENTIALS = Boolean(ETSY_API_KEY);
const GOOGLE_TRENDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GOOGLE_TRENDS_COOLDOWN_MS = 30 * 60 * 1000;
const GOOGLE_TRENDS_MIN_INTERVAL_MS = 90 * 1000;
const GOOGLE_TRENDS_GUARD_PATH = path.join(__dirname, ".cache", "google-trends-guard.json");
const PLATFORM_GUARD_PATH = path.join(__dirname, ".cache", "platform-guards.json");
const PLATFORM_HARD_COOLDOWN_MS = 30 * 60 * 1000;
const PLATFORM_SOFT_COOLDOWN_MS = 5 * 60 * 1000;
const PLATFORM_DEFAULT_MIN_INTERVAL_MS = 20 * 1000;
const googleTrendsCache = new Map();
let googleTrendsCooldownUntil = loadGoogleTrendsCooldown();
let googleTrendsNextAllowedAt = 0;
const platformGuards = loadPlatformGuards();
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9"
};

function loadGoogleTrendsCooldown() {
  try {
    const raw = fs.readFileSync(GOOGLE_TRENDS_GUARD_PATH, "utf8");
    const data = JSON.parse(raw);
    const until = Date.parse(data.cooldownUntil || "");
    return Number.isFinite(until) && until > Date.now() ? until : 0;
  } catch {
    return 0;
  }
}

function persistGoogleTrendsCooldown() {
  try {
    fs.mkdirSync(path.dirname(GOOGLE_TRENDS_GUARD_PATH), { recursive: true });
    fs.writeFileSync(GOOGLE_TRENDS_GUARD_PATH, JSON.stringify({
      cooldownUntil: googleTrendsCooldownUntil ? new Date(googleTrendsCooldownUntil).toISOString() : "",
      updatedAt: new Date().toISOString()
    }, null, 2));
  } catch {
    // The guard is protective but non-critical; keep serving if persistence fails.
  }
}

const PLATFORM_GUARD_RULES = {
  "google-search": { label: "Google 搜索推荐词", minIntervalMs: 25 * 1000 },
  "google-shopping": { label: "Google Shopping 推荐词", minIntervalMs: 25 * 1000 },
  "google-images": { label: "Google Images 推荐词", minIntervalMs: 25 * 1000 },
  "google-news": { label: "Google News 推荐词", minIntervalMs: 25 * 1000 },
  "google-trends": { label: "Google Trends 曲线", minIntervalMs: GOOGLE_TRENDS_MIN_INTERVAL_MS },
  "youtube": { label: "YouTube 推荐词", minIntervalMs: 25 * 1000 },
  "amazon": { label: "Amazon 美国站推荐词", minIntervalMs: 45 * 1000 },
  "tiktok": { label: "TikTok 搜索推荐词", minIntervalMs: 60 * 1000 },
  "reddit": { label: "Reddit Search", minIntervalMs: 60 * 1000 },
  "bing": { label: "Bing 搜索推荐词", minIntervalMs: 25 * 1000 },
  "duckduckgo": { label: "DuckDuckGo 推荐词", minIntervalMs: 25 * 1000 },
  "ebay": { label: "eBay 购物推荐词", minIntervalMs: 35 * 1000 },
  "etsy": { label: "Etsy Open API", minIntervalMs: 60 * 1000 }
};

function loadPlatformGuards() {
  try {
    const raw = fs.readFileSync(PLATFORM_GUARD_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistPlatformGuards() {
  try {
    fs.mkdirSync(path.dirname(PLATFORM_GUARD_PATH), { recursive: true });
    fs.writeFileSync(PLATFORM_GUARD_PATH, JSON.stringify(platformGuards, null, 2));
  } catch {
    // Platform guards should never block the whole local tool.
  }
}

function platformRule(key) {
  return PLATFORM_GUARD_RULES[key] || {
    label: key || "Unknown platform",
    minIntervalMs: PLATFORM_DEFAULT_MIN_INTERVAL_MS
  };
}

function platformKeyFromUrl(value) {
  try {
    const target = new URL(value);
    const host = target.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "suggestqueries.google.com") {
      const dataset = target.searchParams.get("ds") || "web";
      if (dataset === "sh") return "google-shopping";
      if (dataset === "i") return "google-images";
      if (dataset === "n") return "google-news";
      if (dataset === "yt") return "youtube";
      return "google-search";
    }
    if (host === "trends.google.com") return "google-trends";
    if (host.endsWith("amazon.com")) return "amazon";
    if (host.endsWith("tiktok.com")) return "tiktok";
    if (host.endsWith("reddit.com")) return "reddit";
    if (host.endsWith("bing.com")) return "bing";
    if (host.endsWith("duckduckgo.com")) return "duckduckgo";
    if (host.endsWith("ebay.com")) return "ebay";
    if (host.endsWith("etsy.com")) return "etsy";
    return host;
  } catch {
    return "";
  }
}

function platformGuardStatus(key) {
  const rule = platformRule(key);
  const guard = platformGuards[key] || {};
  const now = Date.now();
  const cooldownAt = Date.parse(guard.cooldownUntil || "");
  const nextAt = Date.parse(guard.nextAllowedAt || "");
  const hardRemainingMs = Number.isFinite(cooldownAt) ? Math.max(0, cooldownAt - now) : 0;
  const spacingRemainingMs = Number.isFinite(nextAt) ? Math.max(0, nextAt - now) : 0;
  const remainingMs = Math.max(hardRemainingMs, spacingRemainingMs);
  const reason = hardRemainingMs > 0 ? (guard.reason || "rate-limit") : spacingRemainingMs > 0 ? "spacing" : "ready";
  const advice = hardRemainingMs > 0
    ? `${rule.label} 当前触发限流、验证或访问限制。倒计时结束前系统不会自动请求该平台；如平台页面仍不可用，请稍后再试或切换网络/IP/节点。`
    : spacingRemainingMs > 0
      ? `${rule.label} 正在执行短间隔保护。倒计时结束前会优先使用缓存和其他平台，避免连续请求导致限流。`
      : `${rule.label} 当前可尝试自动采集。`;
  return {
    key,
    label: rule.label,
    status: remainingMs > 0 ? "cooldown" : "ready",
    reason,
    cooldownUntil: remainingMs > 0 ? new Date(Math.max(cooldownAt || 0, nextAt || 0)).toISOString() : "",
    remainingMs,
    cooldownMinutes: Math.ceil(remainingMs / 60000),
    minIntervalMs: rule.minIntervalMs,
    lastError: guard.lastError || "",
    updatedAt: guard.updatedAt || "",
    advice
  };
}

function platformGuardsStatus() {
  const keys = Array.from(new Set([
    ...Object.keys(PLATFORM_GUARD_RULES),
    ...Object.keys(platformGuards)
  ]));
  return keys.map(platformGuardStatus)
    .filter((guard) => guard.status === "cooldown" || guard.updatedAt || PLATFORM_GUARD_RULES[guard.key]);
}

function assertPlatformAllowed(key) {
  if (!key) return;
  const status = platformGuardStatus(key);
  if (status.status !== "cooldown") return;
  const seconds = Math.max(1, Math.ceil(status.remainingMs / 1000));
  throw new Error(`${status.label} 自动采集冷却中，约 ${Math.ceil(seconds / 60)} 分钟后再试。${status.advice}`);
}

function markPlatformAttempt(key) {
  if (!key) return;
  const rule = platformRule(key);
  const now = Date.now();
  const existing = platformGuards[key] || {};
  platformGuards[key] = {
    ...existing,
    key,
    label: rule.label,
    nextAllowedAt: new Date(now + rule.minIntervalMs).toISOString(),
    updatedAt: new Date(now).toISOString()
  };
  persistPlatformGuards();
}

function markPlatformFailure(key, statusCode, message) {
  if (!key) return;
  const text = String(message || "");
  let duration = 0;
  let reason = "error";
  if (statusCode === 429 || /Too Many Requests|rate limit|频繁|限流/i.test(text)) {
    duration = PLATFORM_HARD_COOLDOWN_MS;
    reason = "rate-limit";
  } else if ([401, 403, 407, 451].includes(Number(statusCode)) || /captcha|verify|verification|login|forbidden|no permission|robot/i.test(text)) {
    duration = PLATFORM_HARD_COOLDOWN_MS;
    reason = "verification";
  } else if (Number(statusCode) >= 500 || /AbortError|timeout|ETIMEDOUT|ECONNRESET|network/i.test(text)) {
    duration = PLATFORM_SOFT_COOLDOWN_MS;
    reason = "temporary";
  }

  if (!duration) return;
  const rule = platformRule(key);
  const now = Date.now();
  const existing = platformGuards[key] || {};
  platformGuards[key] = {
    ...existing,
    key,
    label: rule.label,
    reason,
    cooldownUntil: new Date(now + duration).toISOString(),
    lastError: text.slice(0, 220),
    updatedAt: new Date(now).toISOString()
  };
  persistPlatformGuards();
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

const EXTERNAL_OPEN_HOST_SUFFIXES = [
  "google.com",
  "pinterest.com",
  "tiktok.com",
  "amazon.com",
  "youtube.com",
  "bing.com",
  "duckduckgo.com",
  "ebay.com",
  "etsy.com",
  "walmart.com",
  "target.com",
  "instagram.com",
  "reddit.com",
  "seo.com",
  "x.com",
  "threads.net",
  "facebook.com"
];

function isAllowedExternalUrl(value) {
  try {
    const target = new URL(value);
    if (!["http:", "https:"].includes(target.protocol)) return false;
    const host = target.hostname.toLowerCase();
    return EXTERNAL_OPEN_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function openUrlInDefaultBrowser(url) {
  const platform = process.platform;
  let command;
  let args;

  if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.on("error", () => {});
  child.unref();
}

function handleOpenExternal(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const targetUrl = requestUrl.searchParams.get("url") || "";
  if (!isAllowedExternalUrl(targetUrl)) {
    sendJson(res, 400, {
      ok: false,
      error: "Only approved trend, search, marketplace, and social platform URLs can be opened externally."
    });
    return;
  }

  openUrlInDefaultBrowser(targetUrl);
  sendJson(res, 200, { ok: true, url: targetUrl });
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
}

function seedFromTerm(term) {
  return String(term || "trend")
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function makeGoogleTrendsLink(term, geo) {
  return `https://trends.google.com/trends/explore?date=today%205-y&geo=${encodeURIComponent(geo || "US")}&q=${encodeURIComponent(term)}`;
}

function makePinterestLink(term, geo = "US") {
  return `https://trends.pinterest.com/search/?country=${encodeURIComponent(geo || "US")}&q=${encodeURIComponent(term)}&trendsPreset=2`;
}

function makeGoogleSearchLink(term) {
  return `https://www.google.com/search?q=${encodeURIComponent(term)}`;
}

function makeGoogleImagesLink(term) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}`;
}

function makeGoogleNewsLink(term, geo = "US") {
  const country = encodeURIComponent(geo || "US");
  return `https://news.google.com/search?q=${encodeURIComponent(term)}&hl=en-US&gl=${country}&ceid=${country}:en`;
}

function makeGoogleShoppingLink(term) {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term)}`;
}

function makeAmazonLink(term) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(term)}`;
}

function makeAmazonBestSellersLink(term) {
  return `https://www.amazon.com/Best-Sellers/zgbs?k=${encodeURIComponent(term)}`;
}

function makeAmazonMoversLink(term) {
  return `https://www.amazon.com/gp/movers-and-shakers?k=${encodeURIComponent(term)}`;
}

function makeAmazonNewReleasesLink(term) {
  return `https://www.amazon.com/gp/new-releases/?k=${encodeURIComponent(term)}`;
}

function makeAmazonMostWishedLink(term) {
  return `https://www.amazon.com/gp/most-wished-for/?k=${encodeURIComponent(term)}`;
}

function makeEbayLink(term) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(term)}`;
}

function makeTikTokLink(term) {
  return `https://www.tiktok.com/search?q=${encodeURIComponent(term)}`;
}

function makeYouTubeLink(term) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`;
}

function makeInstagramTagLink(term) {
  const tag = String(term || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 60);
  return `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
}

function makeEtsyLink(term) {
  return `https://www.etsy.com/search?q=${encodeURIComponent(term)}`;
}

function makeWalmartLink(term) {
  return `https://www.walmart.com/search?q=${encodeURIComponent(term)}`;
}

function makeTargetLink(term) {
  return `https://www.target.com/s?searchTerm=${encodeURIComponent(term)}`;
}

function makeHomeDepotLink(term) {
  return `https://www.homedepot.com/s/${encodeURIComponent(term)}`;
}

function makeLowesLink(term) {
  return `https://www.lowes.com/search?searchTerm=${encodeURIComponent(term)}`;
}

function makeWayfairLink(term) {
  return `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(term)}`;
}

function makeAliExpressLink(term) {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(term)}`;
}

function makeTemuLink(term) {
  return `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(term)}`;
}

function makeSheinLink(term) {
  return `https://us.shein.com/pdsearch/${encodeURIComponent(term)}/`;
}

function makeMetaAdsLibraryLink(term) {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(term)}`;
}

function makeKickstarterLink(term) {
  return `https://www.kickstarter.com/discover/advanced?term=${encodeURIComponent(term)}`;
}

function makeProductHuntLink(term) {
  return `https://www.producthunt.com/search?q=${encodeURIComponent(term)}`;
}

function makeQuoraLink(term) {
  return `https://www.quora.com/search?q=${encodeURIComponent(term)}`;
}

function makeTrendHunterLink(term) {
  return `https://www.trendhunter.com/results?search=${encodeURIComponent(term)}`;
}

function makeExplodingTopicsLink(term) {
  return `https://explodingtopics.com/explore?q=${encodeURIComponent(term)}`;
}

function makeRedditLink(term) {
  return `https://www.reddit.com/search/?q=${encodeURIComponent(term)}`;
}

function makeFacebookSearchLink(term) {
  return `https://www.facebook.com/search/top/?q=${encodeURIComponent(term)}`;
}

function makeFacebookMarketplaceLink(term) {
  return `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(term)}`;
}

function makeXSearchLink(term) {
  return `https://x.com/search?q=${encodeURIComponent(term)}&src=typed_query&f=top`;
}

function makeThreadsSearchLink(term) {
  return `https://www.threads.net/search?q=${encodeURIComponent(term)}`;
}

function makeKeywordActionLink(sourceName, term, geo) {
  if (sourceName.includes("Best Sellers")) return makeAmazonBestSellersLink(term);
  if (sourceName.includes("Movers")) return makeAmazonMoversLink(term);
  if (sourceName.includes("New Releases")) return makeAmazonNewReleasesLink(term);
  if (sourceName.includes("Most Wished")) return makeAmazonMostWishedLink(term);
  if (sourceName.includes("Amazon")) return makeAmazonLink(term);
  if (sourceName.includes("eBay")) return makeEbayLink(term);
  if (sourceName.includes("TikTok")) return makeTikTokLink(term);
  if (sourceName.includes("YouTube")) return makeYouTubeLink(term);
  if (sourceName.includes("Shopping")) return makeGoogleShoppingLink(term);
  if (sourceName.includes("Home Depot")) return makeHomeDepotLink(term);
  if (sourceName.includes("Lowe")) return makeLowesLink(term);
  if (sourceName.includes("Wayfair")) return makeWayfairLink(term);
  if (sourceName.includes("AliExpress")) return makeAliExpressLink(term);
  if (sourceName.includes("Temu")) return makeTemuLink(term);
  if (sourceName.includes("SHEIN")) return makeSheinLink(term);
  if (sourceName.includes("Meta Ads")) return makeMetaAdsLibraryLink(term);
  if (sourceName.includes("Kickstarter")) return makeKickstarterLink(term);
  if (sourceName.includes("Product Hunt")) return makeProductHuntLink(term);
  if (sourceName.includes("Quora")) return makeQuoraLink(term);
  if (sourceName.includes("TrendHunter")) return makeTrendHunterLink(term);
  if (sourceName.includes("Exploding Topics")) return makeExplodingTopicsLink(term);
  if (sourceName.includes("Bing")) return `https://www.bing.com/search?q=${encodeURIComponent(term)}&cc=${encodeURIComponent(geo || "US")}`;
  if (sourceName.includes("DuckDuckGo")) return `https://duckduckgo.com/?q=${encodeURIComponent(term)}&kl=us-en`;
  return makeGoogleSearchLink(term);
}

async function fetchExternalJson(url, options = {}) {
  const guardKey = options.guardKey || platformKeyFromUrl(url);
  assertPlatformAllowed(guardKey);
  markPlatformAttempt(guardKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
      body: options.body,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      markPlatformFailure(guardKey, response.status, text);
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    }
    return JSON.parse(text.replace(/^\)\]\}',?\n?/, ""));
  } catch (error) {
    markPlatformFailure(guardKey, 0, error.message || error.name || "");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExternalText(url, options = {}) {
  const guardKey = options.guardKey || platformKeyFromUrl(url);
  assertPlatformAllowed(guardKey);
  markPlatformAttempt(guardKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
      body: options.body,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      markPlatformFailure(guardKey, response.status, text);
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    }
    return text;
  } catch (error) {
    markPlatformFailure(guardKey, 0, error.message || error.name || "");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function sourceResult(source, status, payload) {
  return {
    source,
    status,
    items: payload.items || [],
    link: payload.link || "",
    note: payload.note || "",
    meta: payload.meta || {}
  };
}

function googleTrendsGuardStatus() {
  const now = Date.now();
  const hardRemainingMs = Math.max(0, googleTrendsCooldownUntil - now);
  const spacingRemainingMs = Math.max(0, googleTrendsNextAllowedAt - now);
  const remainingMs = Math.max(hardRemainingMs, spacingRemainingMs);
  const reason = hardRemainingMs > 0 ? "rate-limit" : spacingRemainingMs > 0 ? "spacing" : "ready";
  const advice = hardRemainingMs > 0
    ? "Google Trends 当前触发 429 限流。倒计时结束前系统不会自动请求 Trends；如果官方页面仍空白，请切换网络/IP/节点或稍后再试。"
    : spacingRemainingMs > 0
      ? "Google Trends 正在执行短间隔保护。倒计时结束前只使用缓存和其他平台，避免连续换词导致再次限流。"
      : "Google Trends 当前可尝试查询。系统会缓存同词结果，并在触发 429 后自动进入保护冷却。";
  return {
    status: remainingMs > 0 ? "cooldown" : "ready",
    reason,
    cooldownUntil: remainingMs > 0 ? new Date(Math.max(googleTrendsCooldownUntil, googleTrendsNextAllowedAt)).toISOString() : "",
    remainingMs,
    cooldownMinutes: Math.ceil(remainingMs / 60000),
    cacheTtlMs: GOOGLE_TRENDS_CACHE_TTL_MS,
    minIntervalMs: GOOGLE_TRENDS_MIN_INTERVAL_MS,
    cacheEntries: googleTrendsCache.size,
    advice
  };
}
async function getGoogleSuggest(term, geo) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(term)}`;
  const data = await fetchExternalJson(url);
  return sourceResult("Google 输入框推荐词", "live", {
    items: Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [],
    link: `https://www.google.com/search?q=${encodeURIComponent(term)}`,
    note: "来自 Google autocomplete，地区参数 gl=US。"
  });
}

async function getGoogleShoppingSuggest(term, geo) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=sh&hl=en&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(term)}`;
  const data = await fetchExternalJson(url);
  return sourceResult("Google Shopping 推荐词", "live", {
    items: Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [],
    link: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term)}`,
    note: "来自 Google Shopping autocomplete，地区参数 gl=US。"
  });
}

async function getGoogleImagesSuggest(term, geo) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=i&hl=en&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(term)}`;
  const data = await fetchExternalJson(url);
  return sourceResult("Google Images 推荐词", "live", {
    items: Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [],
    link: makeGoogleImagesLink(term),
    note: "来自 Google Images autocomplete，用于判断视觉风格和场景需求。"
  });
}

async function getGoogleNewsSuggest(term, geo) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=n&hl=en&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(term)}`;
  const data = await fetchExternalJson(url);
  return sourceResult("Google News 推荐词", "live", {
    items: Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [],
    link: makeGoogleNewsLink(term, geo),
    note: "来自 Google News autocomplete，用于补充内容话题和新闻型需求。"
  });
}

async function getBingSuggest(term) {
  const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(term)}&cc=US`;
  const data = await fetchExternalJson(url);
  return sourceResult("Bing 搜索推荐词", "live", {
    items: Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [],
    link: `https://www.bing.com/search?q=${encodeURIComponent(term)}&cc=US`,
    note: "来自 Bing osjson 搜索推荐接口，cc=US。"
  });
}

async function getDuckDuckGoSuggest(term) {
  const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(term)}&kl=us-en`;
  const data = await fetchExternalJson(url, {
    headers: {
      "Referer": "https://duckduckgo.com/"
    }
  });
  return sourceResult("DuckDuckGo 推荐词", "live", {
    items: Array.isArray(data) ? data.map((item) => item.phrase).filter(Boolean).slice(0, 10) : [],
    link: `https://duckduckgo.com/?q=${encodeURIComponent(term)}&kl=us-en`,
    note: "来自 DuckDuckGo autocomplete，区域参数 us-en。"
  });
}

async function getAmazonSuggest(term) {
  const url = `https://completion.amazon.com/api/2017/suggestions?limit=11&prefix=${encodeURIComponent(term)}&suggestion-type=KEYWORD&suggestion-type=WIDGET&mid=ATVPDKIKX0DER&alias=aps&fresh=0&client-info=amazon-search-ui&page-type=Search&site-variant=desktop&lop=en_US`;
  const data = await fetchExternalJson(url, {
    headers: {
      "Referer": "https://www.amazon.com/"
    }
  });
  const items = Array.isArray(data?.suggestions)
    ? data.suggestions.map((item) => item.value).filter(Boolean).slice(0, 10)
    : [];
  return sourceResult("Amazon 美国站推荐词", "live", {
    items,
    link: makeAmazonLink(term),
    note: "来自 Amazon.com 搜索框 completion 接口。"
  });
}

async function getEbaySuggest(term) {
  const url = `https://autosug.ebay.com/autosug?kwd=${encodeURIComponent(term)}&sId=0&fmt=json`;
  const text = await fetchExternalText(url, {
    headers: {
      "Referer": "https://www.ebay.com/"
    }
  });
  const match = text.match(/_do\((.*)\)\s*$/s);
  const data = JSON.parse(match ? match[1] : text);
  return sourceResult("eBay 购物推荐词", "live", {
    items: Array.isArray(data?.res?.sug) ? data.res.sug.slice(0, 10) : [],
    link: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(term)}`,
    note: "来自 eBay autosug 购物推荐接口。"
  });
}

async function getEtsyListings(term) {
  const url = `https://api.etsy.com/v3/application/listings?state=active&keywords=${encodeURIComponent(term)}&limit=12`;
  const data = await fetchExternalJson(url, {
    timeoutMs: 12000,
    headers: {
      "x-api-key": ETSY_API_KEY
    }
  });
  const listings = Array.isArray(data?.results) ? data.results : [];
  const seen = new Set();
  const items = [];

  listings.forEach((listing) => {
    const title = String(listing?.title || "").trim();
    if (!title) return;
    const key = title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(title);
    }
  });

  return sourceResult("Etsy Open API", "live", {
    items: items.slice(0, 10),
    link: makeEtsyLink(term),
    note: "来自 Etsy Open API v3 active listings，提取公开 listing 标题；用于手作礼品市场供给验证，不参与自动评分。",
    meta: {
      count: Number(data?.count || listings.length || 0)
    }
  });
}

async function getTikTokSuggest(term) {
  const url = `https://www.tiktok.com/api/search/general/sug/?keyword=${encodeURIComponent(term)}&aid=1988&app_language=en&region=US`;
  const data = await fetchExternalJson(url, {
    headers: {
      "Referer": "https://www.tiktok.com/"
    }
  });
  const items = Array.isArray(data?.sug_list)
    ? data.sug_list.map((item) => item.content || item?.word_record?.words_content).filter(Boolean).slice(0, 10)
    : [];
  return sourceResult("TikTok 搜索框推荐词", "live", {
    items,
    link: makeTikTokLink(term),
    note: "来自 TikTok 搜索建议接口，region=US。"
  });
}

async function getYouTubeSuggest(term, geo) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(term)}`;
  const data = await fetchExternalJson(url);
  return sourceResult("YouTube 推荐词", "live", {
    items: Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [],
    link: makeYouTubeLink(term),
    note: "来自 YouTube autocomplete，地区参数 gl=US。"
  });
}

async function getGoogleTrends(term, geo) {
  const now = Date.now();
  const cacheKey = `${geo || "US"}:${String(term || "").trim().toLowerCase()}`;
  const cached = googleTrendsCache.get(cacheKey);
  if (cached && now - cached.cachedAt < GOOGLE_TRENDS_CACHE_TTL_MS) {
    return {
      ...cached.result,
      note: `${cached.result.note} 已使用本地缓存，避免重复触发 Google Trends 限流。`
    };
  }

  const guardUntil = Math.max(googleTrendsCooldownUntil, googleTrendsNextAllowedAt);
  if (now < guardUntil) {
    const minutes = Math.max(1, Math.ceil((guardUntil - now) / 60000));
    const hardCooldownActive = googleTrendsCooldownUntil > now;
    throw new Error(hardCooldownActive
      ? `Google Trends 当前返回 429 请求限制，已暂停自动读取约 ${minutes} 分钟；请优先用官方页面手动复核，或切换网络/IP/节点后再试。`
      : `Google Trends 自动查询间隔保护中，约 ${minutes} 分钟后再尝试；当前会优先使用其他平台和缓存结果。`);
  }

  try {
    googleTrendsNextAllowedAt = Date.now() + GOOGLE_TRENDS_MIN_INTERVAL_MS;
    const req = {
      comparisonItem: [{ keyword: term, geo, time: "all" }],
      category: 0,
      property: ""
    };
    const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en-US&tz=360&req=${encodeURIComponent(JSON.stringify(req))}`;
    const explore = await fetchExternalJson(exploreUrl, { timeoutMs: 9000 });
    const widgets = Array.isArray(explore?.widgets) ? explore.widgets : [];
    const widget = widgets.find((item) => item.id === "TIMESERIES" || item.type === "TIMESERIES");
    if (!widget?.token || !widget?.request) {
      throw new Error("Google Trends 没有返回时间序列 token");
    }

    const dataUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=360&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`;
    const data = await fetchExternalJson(dataUrl, { timeoutMs: 9000 });
    const points = Array.isArray(data?.default?.timelineData)
      ? data.default.timelineData.map((point) => ({
        date: point.formattedTime || point.time,
        value: Array.isArray(point.value) ? point.value[0] : 0
      })).slice(-24)
      : [];

    const result = sourceResult("Google Trends 曲线", "live", {
      items: points.map((point) => `${point.date}: ${point.value}`).slice(-8),
      link: makeGoogleTrendsLink(term, geo),
      note: "来自 Google Trends 网页接口，非官方 API，可能被 429 限流。",
      meta: {
        pointCount: points.length,
        timeline: points,
        latest: points.at(-1) || null
      }
    });
    googleTrendsCache.set(cacheKey, { cachedAt: now, result });
    return result;
  } catch (error) {
    if (/HTTP 429|Too Many Requests/i.test(error.message || "")) {
      googleTrendsCooldownUntil = Date.now() + GOOGLE_TRENDS_COOLDOWN_MS;
      persistGoogleTrendsCooldown();
      throw new Error("Google Trends 返回 HTTP 429，当前网络/IP/会话请求过频；系统已暂停自动读取 30 分钟，避免继续加重限流。");
    }
    throw error;
  }
}

async function getRedditSearch(term) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&restrict_sr=0&sort=relevance&t=year&limit=12`;
  const data = await fetchExternalJson(url, {
    timeoutMs: 9000,
    headers: {
      "User-Agent": "TrendRadarLocal/1.0 keyword-research"
    }
  });
  const posts = Array.isArray(data?.data?.children) ? data.data.children : [];
  const seen = new Set();
  const items = [];

  posts.forEach((child) => {
    const post = child?.data || {};
    const title = String(post.title || "").trim();
    if (!title) return;
    const subreddit = post.subreddit ? `r/${post.subreddit}` : "Reddit";
    const item = `${title} (${subreddit})`;
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  });

  return sourceResult("Reddit Search", "live", {
    items: items.slice(0, 10),
    link: makeRedditLink(term),
    note: "来自 Reddit search.json 公开搜索结果，提取帖子标题；用于社区语境验证，不参与自动评分。",
    meta: {
      postCount: posts.length
    }
  });
}

async function settleSource(name, getter) {
  try {
    return await getter();
  } catch (error) {
    return sourceResult(name, "blocked", {
      items: [],
      note: error.message
    });
  }
}

const HOLIDAY_CATEGORY_GROUPS = [
  {
    key: "door-wreaths",
    label: "门饰花环",
    description: "前门、窗户、壁挂类装饰，适合做季节款和节日款。",
    subcategories: [
      { label: "Christmas Door Wreath", event: "Christmas", season: "冬季", seed: "christmas wreath" },
      { label: "Halloween Door Wreath", event: "Halloween", season: "秋季", seed: "halloween wreath" },
      { label: "Easter Door Wreath", event: "Easter", season: "春季", seed: "easter wreath" },
      { label: "Fall Door Wreath", event: "Fall Decor", season: "秋季", seed: "fall wreath" },
      { label: "Window Wreath", event: "Christmas", season: "冬季", seed: "christmas window wreath" },
      { label: "Mini Wreath", event: "Christmas", season: "冬季", seed: "mini christmas wreath" }
    ]
  },
  {
    key: "table-centerpieces",
    label: "桌面中心装饰",
    description: "餐桌、壁炉、蜡烛托、桌面摆件方向，适合套装和氛围图。",
    subcategories: [
      { label: "Christmas Centerpiece", event: "Christmas", season: "冬季", seed: "christmas centerpiece" },
      { label: "Thanksgiving Centerpiece", event: "Thanksgiving", season: "秋季", seed: "thanksgiving centerpiece" },
      { label: "Candle Holder Wreath", event: "Christmas Table", season: "冬季", seed: "candle holder wreath" },
      { label: "Easter Centerpiece", event: "Easter", season: "春季", seed: "easter centerpiece" },
      { label: "Mantel Decor", event: "Christmas", season: "冬季", seed: "christmas mantel decor" },
      { label: "Candle Ring", event: "Christmas Table", season: "冬季", seed: "christmas candle rings" }
    ]
  },
  {
    key: "party-decor",
    label: "派对装饰",
    description: "毕业、国庆、万圣节、新年等派对场景，搜索词更偏一次性布置。",
    subcategories: [
      { label: "Graduation Party Decorations", event: "Graduation", season: "春季", seed: "graduation party decorations" },
      { label: "4th of July Decorations", event: "4th of July", season: "夏季", seed: "4th of july decorations" },
      { label: "Halloween Party Decorations", event: "Halloween", season: "秋季", seed: "halloween party decorations" },
      { label: "New Years Eve Decorations", event: "New Year", season: "冬季", seed: "new years eve decorations" },
      { label: "Balloon Garland", event: "Party Decor", season: "全年", seed: "holiday balloon garland" },
      { label: "Party Table Decor", event: "Party Decor", season: "全年", seed: "holiday party table decorations" }
    ]
  },
  {
    key: "holiday-gifts",
    label: "礼品礼物",
    description: "送礼需求强，适合观察人群词、对象词和套装机会。",
    subcategories: [
      { label: "Mother's Day Gifts", event: "Mother's Day", season: "春季", seed: "mothers day gifts" },
      { label: "Father's Day Gifts", event: "Father's Day", season: "夏季", seed: "fathers day gifts" },
      { label: "Valentine Gifts", event: "Valentine's Day", season: "冬季", seed: "valentine gifts" },
      { label: "Graduation Gifts", event: "Graduation", season: "春季", seed: "graduation gifts" },
      { label: "Christmas Gifts", event: "Christmas", season: "冬季", seed: "christmas gifts" },
      { label: "Teacher Gifts", event: "Back to School", season: "夏季", seed: "teacher gifts" }
    ]
  },
  {
    key: "lighting",
    label: "灯饰氛围",
    description: "LED、灯串、蜡烛氛围类，适合与你的花环/桌饰做差异化组合。",
    subcategories: [
      { label: "Christmas Lights Decor", event: "Christmas", season: "冬季", seed: "christmas lights decor" },
      { label: "LED String Lights Decor", event: "All Season", season: "全年", seed: "led string lights decor" },
      { label: "Halloween Lights", event: "Halloween", season: "秋季", seed: "halloween lights" },
      { label: "Candle Wreath With LED", event: "Christmas Table", season: "冬季", seed: "candle holder wreath with led lights" },
      { label: "Fairy Lights Decor", event: "Home Decor", season: "全年", seed: "fairy lights decor" },
      { label: "Battery Operated Lights", event: "Home Decor", season: "全年", seed: "battery operated lights decor" }
    ]
  },
  {
    key: "outdoor-yard",
    label: "户外庭院装饰",
    description: "门廊、庭院、户外摆件方向，适合看尺寸、耐候和包装成本。",
    subcategories: [
      { label: "Christmas Yard Decorations", event: "Christmas", season: "冬季", seed: "christmas yard decorations" },
      { label: "Halloween Outdoor Decorations", event: "Halloween", season: "秋季", seed: "halloween outdoor decorations" },
      { label: "Fall Porch Decor", event: "Fall Decor", season: "秋季", seed: "fall porch decor" },
      { label: "4th of July Outdoor Decor", event: "4th of July", season: "夏季", seed: "4th of july outdoor decorations" },
      { label: "Christmas Porch Decor", event: "Christmas", season: "冬季", seed: "christmas porch decor" },
      { label: "Halloween Yard Signs", event: "Halloween", season: "秋季", seed: "halloween yard signs" }
    ]
  }
];

const SEASONAL_SOURCE_COLLECTORS = [
  {
    name: "Google 输入框推荐词",
    maxItems: 5,
    weight: 28,
    collect: (term, geo) => getGoogleSuggest(term, geo)
  },
  {
    name: "Google Shopping 推荐词",
    maxItems: 5,
    weight: 24,
    collect: (term, geo) => getGoogleShoppingSuggest(term, geo)
  },
  {
    name: "Google Images 推荐词",
    maxItems: 4,
    weight: 14,
    collect: (term, geo) => getGoogleImagesSuggest(term, geo)
  },
  {
    name: "Amazon 美国站推荐词",
    maxItems: 5,
    weight: 30,
    collect: (term) => getAmazonSuggest(term)
  },
  {
    name: "TikTok 搜索框推荐词",
    maxItems: 3,
    weight: 18,
    collect: (term) => getTikTokSuggest(term)
  },
  {
    name: "YouTube 推荐词",
    maxItems: 3,
    weight: 16,
    collect: (term, geo) => getYouTubeSuggest(term, geo)
  },
  {
    name: "Google News 推荐词",
    maxItems: 3,
    weight: 8,
    collect: (term, geo) => getGoogleNewsSuggest(term, geo)
  },
  {
    name: "Bing 搜索推荐词",
    maxItems: 3,
    weight: 14,
    collect: (term) => getBingSuggest(term)
  },
  {
    name: "eBay 购物推荐词",
    maxItems: 3,
    weight: 12,
    collect: (term) => getEbaySuggest(term)
  }
];

const SEASONAL_CACHE = new Map();
const SEASONAL_CACHE_TTL_MS = 10 * 60 * 1000;

const SEASONAL_BLOCKED_PATTERNS = [
  /singapore/i,
  /crossword/i,
  /sims\s*4/i,
  /free shipping/i,
  /over\s*\d/i,
  /\$\s*\d/,
  /near me/i
];

function isUsefulSeasonalKeyword(keyword) {
  const clean = String(keyword || "").trim();
  if (clean.length < 3 || clean.length > 64) return false;
  return !SEASONAL_BLOCKED_PATTERNS.some((pattern) => pattern.test(clean));
}

const HOT_KEYWORD_CACHE = new Map();
const HOT_KEYWORD_CACHE_TTL_MS = 10 * 60 * 1000;
const SOCIAL_RADAR_CACHE = new Map();
const SOCIAL_RADAR_CACHE_TTL_MS = 10 * 60 * 1000;

const DISCOVERY_TRANSLATIONS = [
  ["红色", "red"],
  ["粉色", "pink"],
  ["粉红", "pink"],
  ["蓝色", "blue"],
  ["绿色", "green"],
  ["白色", "white"],
  ["黑色", "black"],
  ["金色", "gold"],
  ["银色", "silver"],
  ["紫色", "purple"],
  ["棕色", "brown"],
  ["米色", "beige"],
  ["圣诞", "christmas"],
  ["万圣节", "halloween"],
  ["复活节", "easter"],
  ["情人节", "valentine"],
  ["感恩节", "thanksgiving"],
  ["天鹅绒", "velvet"],
  ["铃铛", "bells"],
  ["蝴蝶结", "bow"],
  ["丝带", "ribbon"],
  ["花环", "wreath"],
  ["装饰", "decorations"],
  ["装饰品", "decorations"],
  ["宠物", "pet"],
  ["狗", "dog"],
  ["猫", "cat"],
  ["麻将", "mahjong"],
  ["蜡烛", "candle"],
  ["收纳", "storage"],
  ["厨房", "kitchen"],
  ["花园", "garden"],
  ["户外", "outdoor"],
  ["教师", "teacher"],
  ["老师", "teacher"],
  ["礼物", "gift"],
  ["礼品", "gift"],
  ["派对", "party"],
  ["婚礼", "wedding"],
  ["婴儿", "baby"],
  ["儿童", "kids"],
  ["家居", "home decor"]
];

const DISCOVERY_COLLECTORS = [
  { name: "Google 输入框推荐词", weight: 30, family: "搜索需求", collect: (term, geo) => getGoogleSuggest(term, geo) },
  { name: "Google Shopping 推荐词", weight: 28, family: "购物需求", collect: (term, geo) => getGoogleShoppingSuggest(term, geo) },
  { name: "Amazon 美国站推荐词", weight: 34, family: "电商货架", collect: (term) => getAmazonSuggest(term) },
  { name: "Google Images 推荐词", weight: 18, family: "视觉场景", collect: (term, geo) => getGoogleImagesSuggest(term, geo) },
  { name: "TikTok 搜索框推荐词", weight: 22, family: "社媒内容", collect: (term) => getTikTokSuggest(term) },
  { name: "YouTube 推荐词", weight: 16, family: "内容教程", collect: (term, geo) => getYouTubeSuggest(term, geo) },
  { name: "Bing 搜索推荐词", weight: 14, family: "搜索补充", collect: (term) => getBingSuggest(term) },
  { name: "eBay 购物推荐词", weight: 12, family: "二级市场", collect: (term) => getEbaySuggest(term) }
];

function translateDiscoveryTerm(term) {
  let clean = normalizeSeedTerm(term).toLowerCase();
  DISCOVERY_TRANSLATIONS.forEach(([from, to]) => {
    clean = clean.replaceAll(from.toLowerCase(), to);
  });
  return clean
    .replace(/[，、]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values, limit = 20) {
  const seen = new Set();
  const list = [];
  values.forEach((value) => {
    const clean = normalizeSeedTerm(value).toLowerCase();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    list.push(clean);
  });
  return list.slice(0, limit);
}

const BROAD_DISCOVERY_EXPANSIONS = [
  {
    pattern: /\b(christmas|xmas|santa|ornament|wreath|christmas tree)\b/i,
    seeds: [
      "christmas decorations",
      "christmas gifts",
      "christmas wreath",
      "christmas ornaments",
      "christmas tree decorations",
      "christmas lights",
      "christmas table decor",
      "christmas outdoor decorations",
      "christmas stockings",
      "christmas nutcracker",
      "christmas ribbon",
      "christmas garland"
    ]
  },
  {
    pattern: /\b(halloween|spooky|ghost|witch|skull|pumpkin)\b/i,
    seeds: [
      "halloween decorations",
      "halloween outdoor decorations",
      "halloween party decorations",
      "spooky decor",
      "pumpkin decor",
      "halloween wreath",
      "halloween lights",
      "halloween table decor"
    ]
  },
  {
    pattern: /\b(fall|autumn|thanksgiving|harvest)\b/i,
    seeds: [
      "fall decor",
      "fall wreath",
      "pumpkin decor",
      "thanksgiving centerpiece",
      "fall table decor",
      "fall porch decor",
      "harvest decorations",
      "thanksgiving gifts"
    ]
  },
  {
    pattern: /\b(summer|bbq|barbecue|grill|grilling|cookout|patio|outdoor)\b/i,
    seeds: [
      "summer bbq",
      "bbq party decorations",
      "grilling accessories",
      "patio decor",
      "outdoor entertaining",
      "summer party decorations",
      "picnic decor",
      "pool party decor",
      "garden party decorations"
    ]
  },
  {
    pattern: /\b(pet|dog|cat|puppy|kitten)\b/i,
    seeds: [
      "pet gifts",
      "dog christmas gifts",
      "cat christmas gifts",
      "pet home decor",
      "dog toys",
      "cat toys",
      "pet christmas ornaments",
      "pet stockings",
      "pet bed",
      "pet travel accessories"
    ]
  },
  {
    pattern: /\b(wedding|bridal|bride|party|birthday|baby shower|event|balloon)\b/i,
    seeds: [
      "party decorations",
      "wedding decor",
      "bridal shower decorations",
      "baby shower decorations",
      "birthday party decorations",
      "balloon garland",
      "party table decor",
      "party favors"
    ]
  },
  {
    pattern: /\b(back to school|teacher|school|classroom|dorm|student|college)\b/i,
    seeds: [
      "back to school supplies",
      "teacher gifts",
      "classroom decor",
      "dorm decor",
      "student planner",
      "school organization",
      "teacher appreciation gifts"
    ]
  },
  {
    pattern: /\b(garden|yard|porch|front door|planter|lawn)\b/i,
    seeds: [
      "garden decor",
      "yard decor",
      "porch decor",
      "front door decor",
      "outdoor planters",
      "garden lights",
      "patio decorations"
    ]
  }
];

function broadDiscoverySeedsForTerm(base) {
  const text = String(base || "").toLowerCase();
  return uniqueStrings(
    BROAD_DISCOVERY_EXPANSIONS
      .filter((group) => group.pattern.test(text))
      .flatMap((group) => group.seeds),
    14
  );
}

function makeDiscoverySeeds(term) {
  const base = translateDiscoveryTerm(term);
  if (!base) return [];
  const broadSeeds = broadDiscoverySeedsForTerm(base);
  const isColor = /\b(red|pink|blue|green|white|black|gold|silver|purple|brown|beige)\b/i.test(base);
  const isHoliday = /\b(christmas|halloween|easter|valentine|thanksgiving|holiday|fall|winter|spring|summer)\b/i.test(base);
  const isDecor = /\b(decor|decoration|ornament|wreath|garland|ribbon|bow|bells|candle|centerpiece|home|velvet|lights)\b/i.test(base);
  const isPet = /\b(pet|dog|cat|puppy|kitten)\b/i.test(base);
  const isGift = /\b(gift|teacher|mom|mother|dad|father|kids|baby|wedding|party)\b/i.test(base);
  const isGame = /\b(game|games|mahjong|puzzle|cards|toy|toys)\b/i.test(base);

  const seeds = [
    base,
    `${base} ideas`,
    `${base} aesthetic`,
    `${base} trend`,
    `${base} set`,
    `${base} gift`,
    `${base} diy`,
    `${base} accessories`,
    `${base} for home`,
    `${base} products`,
    `${base} supplies`,
    `${base} best`,
    `${base} 2026`
  ];

  if (isColor || isHoliday) {
    seeds.unshift(
      `${base} decor`,
      `${base} decorations`,
      `${base} ornaments`,
      `${base} ribbon`,
      `${base} velvet`,
      `${base} bells`,
      `${base} garland`,
      `${base} wreath`
    );
    seeds.push(
      `${base} decor`,
      `${base} decorations`,
      `${base} christmas`,
      `${base} christmas decorations`,
      `${base} ornaments`,
      `${base} wreath`,
      `${base} ribbon`,
      `${base} velvet`,
      `${base} bells`,
      `${base} garland`,
      `christmas ${base} decorations`
    );
  } else if (isDecor) {
    seeds.unshift(
      `${base} decor`,
      `${base} decorations`,
      `${base} set`,
      `${base} holder`,
      `${base} centerpiece`,
      `${base} for home`,
      `${base} ideas`,
      `${base} diy`
    );
  }

  if (isPet) {
    seeds.push(
      `${base} supplies`,
      `${base} toys`,
      `${base} bed`,
      `${base} clothes`,
      `${base} christmas`,
      `${base} winter`,
      `${base} home`,
      `${base} travel`,
      `${base} gift`
    );
  }

  if (isGift) {
    seeds.push(
      `${base} ideas`,
      `${base} for women`,
      `${base} for men`,
      `${base} for kids`,
      `${base} personalized`,
      `${base} christmas`,
      `${base} basket`,
      `${base} bulk`
    );
  }

  if (isGame) {
    seeds.push(
      `${base} set`,
      `${base} accessories`,
      `${base} table`,
      `${base} gift`,
      `${base} travel`,
      `${base} aesthetic`,
      `${base} for adults`,
      `${base} party`
    );
  }

  return uniqueStrings(broadSeeds.length ? [...broadSeeds, ...seeds] : seeds, broadSeeds.length ? 24 : 16);
}

function normalizeDiscoveryKeyword(keyword) {
  return String(keyword || "")
    .replace(/\s+/g, " ")
    .replace(/[“”"]/g, "")
    .trim()
    .slice(0, 96);
}

function isUsefulDiscoveryKeyword(keyword, baseTerm) {
  const clean = normalizeDiscoveryKeyword(keyword);
  if (clean.length < 3 || clean.length > 96) return false;
  if (SEASONAL_BLOCKED_PATTERNS.some((pattern) => pattern.test(clean))) return false;
  if (/^(http|www\.|\.com|login|sign in)/i.test(clean)) return false;
  if (/\b(amazon|walmart|target|ebay|etsy|temu|shein|aliexpress)\b/i.test(clean)) return false;
  const baseWords = translateDiscoveryTerm(baseTerm).split(/\s+/).filter(Boolean);
  if (!baseWords.length) return true;
  const text = clean.toLowerCase();
  const translatedBase = translateDiscoveryTerm(baseTerm);
  const isSingleColor = /^(red|pink|blue|green|white|black|gold|silver|purple|brown|beige)$/.test(translatedBase);
  if (isSingleColor && new RegExp(`^${translatedBase}\\s+(set|accessories|aesthetic|trend|ideas|gift|diy|best|products|supplies|for home)$`, "i").test(text)) return false;
  const meaningfulWords = baseWords.filter((word) => word.length > 2);
  if (!meaningfulWords.length) return true;
  if (meaningfulWords.some((word) => text.includes(word))) return true;
  return /(gift|set|decor|decoration|ideas|aesthetic|trend|diy|amazon|review|accessories|supplies|toys|home|for)/i.test(text);
}

function sourceFamilyForDiscovery(sourceName) {
  const found = DISCOVERY_COLLECTORS.find((collector) => collector.name === sourceName);
  return found?.family || "其他来源";
}

function classifyDiscoveryKeyword(keyword) {
  const text = String(keyword || "").toLowerCase();
  if (/(velvet|ribbon|bow|sash|plaid|gingham|metal|wood|glass|ceramic|faux|flocked)/i.test(text)) return "材质/风格";
  if (/(wreath|garland|ornament|bells|ball|tree|stocking|centerpiece|candle|lights|decor|decoration)/i.test(text)) return "产品方向";
  if (/(front door|porch|mantel|table|outdoor|indoor|yard|window|bedroom|kitchen)/i.test(text)) return "使用场景";
  if (/(diy|ideas|aesthetic|trend|how to|tutorial|inspo|theme)/i.test(text)) return "内容灵感";
  return "关联热词";
}

function scoreDiscoveryEvidence(keyword, baseTerm, evidence) {
  const text = keyword.toLowerCase();
  const translatedBase = translateDiscoveryTerm(baseTerm);
  const baseWords = translatedBase.split(/\s+/).filter(Boolean);
  const sourceCount = new Set(evidence.map((item) => item.source)).size;
  const familyCount = new Set(evidence.map((item) => item.family)).size;
  const averageRank = evidence.length
    ? evidence.reduce((sum, item) => sum + Number(item.rank || 10), 0) / evidence.length
    : 10;
  const averageSourceWeight = evidence.length
    ? evidence.reduce((sum, item) => sum + Number(item.score || 0), 0) / evidence.length
    : 0;
  const matchBonus = baseWords.some((word) => text.includes(word)) ? 6 : 0;
  const intentBonus = /(christmas|holiday|decor|decoration|ornament|wreath|garland|bells|ribbon|velvet|pink|red|bow|lights|centerpiece|front door|table|tree)/i.test(text) ? 8 : 0;
  const buyingBonus = /(set|pack|bulk|large|small|outdoor|indoor|with|for|amazon|diy|ideas)/i.test(text) ? 4 : 0;
  const coverageScore = Math.min(28, sourceCount * 3.5);
  const familyScore = Math.min(14, familyCount * 2.8);
  const rankScore = Math.max(0, 14 - averageRank * 1.3);
  const sourceWeightScore = Math.min(8, averageSourceWeight / 4);
  return Math.min(100, Math.round(12 + coverageScore + familyScore + rankScore + sourceWeightScore + matchBonus + intentBonus + buyingBonus));
}

async function collectHotKeywords(term, geo) {
  const seeds = makeDiscoverySeeds(term);
  const candidateMap = new Map();
  const sourceStats = new Map();

  const seedResults = await mapWithLimit(seeds, 3, async (seed) => {
    const results = await mapWithLimit(DISCOVERY_COLLECTORS, 4, async (collector) => {
      const result = await settleSource(collector.name, () => collector.collect(seed, geo));
      return { collector, result, seed };
    });
    return results;
  });

  seedResults.flat().forEach(({ collector, result, seed }) => {
    const stat = sourceStats.get(collector.name) || {
      source: collector.name,
      family: collector.family,
      status: result.status,
      itemCount: 0,
      seeds: new Set(),
      link: result.link || makeKeywordActionLink(collector.name, seed, geo),
      note: result.note || ""
    };
    stat.status = stat.status === "live" || result.status === "live" ? "live" : result.status;
    stat.itemCount += Array.isArray(result.items) ? result.items.length : 0;
    stat.seeds.add(seed);
    sourceStats.set(collector.name, stat);

    if (result.status !== "live") return;
    (result.items || []).forEach((rawKeyword, index) => {
      const keyword = normalizeDiscoveryKeyword(rawKeyword);
      if (!isUsefulDiscoveryKeyword(keyword, term)) return;
      const key = keyword.toLowerCase();
      const bucket = candidateMap.get(key) || {
        keyword,
        category: classifyDiscoveryKeyword(keyword),
        evidence: [],
        sources: new Set(),
        families: new Set(),
        seeds: new Set(),
        score: 0
      };
      const duplicateEvidence = bucket.evidence.find((item) => item.source === collector.name);
      const evidence = {
        source: collector.name,
        family: collector.family,
        seed,
        rank: index + 1,
        score: Math.max(3, collector.weight - index * 2),
        link: makeKeywordActionLink(collector.name, keyword, geo)
      };
      if (!duplicateEvidence || duplicateEvidence.rank > evidence.rank) {
        bucket.evidence = bucket.evidence.filter((item) => item.source !== collector.name);
        bucket.evidence.push(evidence);
      }
      bucket.sources.add(collector.name);
      bucket.families.add(collector.family);
      bucket.seeds.add(seed);
      candidateMap.set(key, bucket);
    });
  });

  const candidates = Array.from(candidateMap.values())
    .map((bucket) => {
      const evidence = bucket.evidence.sort((a, b) => b.score - a.score).slice(0, 6);
      const score = scoreDiscoveryEvidence(bucket.keyword, term, evidence);
      const sourceCount = bucket.sources.size;
      const familyCount = bucket.families.size;
      return {
        keyword: bucket.keyword,
        category: bucket.category,
        score,
        confidence: sourceCount >= 3 && familyCount >= 2 ? "强交叉验证" : sourceCount >= 2 ? "中交叉验证" : "单源待复核",
        sourceCount,
        familyCount,
        sources: Array.from(bucket.sources),
        families: Array.from(bucket.families),
        seeds: Array.from(bucket.seeds).slice(0, 5),
        evidence,
        validationLinks: makeValidationLinks(bucket.keyword, geo).slice(0, 6)
      };
    })
    .filter((item) => item.sourceCount >= 2)
    .sort((a, b) => b.score - a.score || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword))
    .slice(0, 24);

  const fallbackCandidates = candidates.length ? [] : Array.from(candidateMap.values())
    .map((bucket) => {
      const evidence = bucket.evidence.sort((a, b) => b.score - a.score).slice(0, 4);
      return {
        keyword: bucket.keyword,
        category: bucket.category,
        score: scoreDiscoveryEvidence(bucket.keyword, term, evidence),
        confidence: "单源待复核",
        sourceCount: bucket.sources.size,
        familyCount: bucket.families.size,
        sources: Array.from(bucket.sources),
        families: Array.from(bucket.families),
        seeds: Array.from(bucket.seeds).slice(0, 5),
        evidence,
        validationLinks: makeValidationLinks(bucket.keyword, geo).slice(0, 6)
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return {
    term: normalizeSeedTerm(term),
    normalizedTerm: translateDiscoveryTerm(term),
    geo,
    generatedAt: new Date().toISOString(),
    querySeeds: seeds,
    sources: Array.from(sourceStats.values()).map((stat) => ({
      ...stat,
      seeds: Array.from(stat.seeds).slice(0, 4)
    })),
    candidates: candidates.length ? candidates : fallbackCandidates,
    strictCrossVerified: Boolean(candidates.length),
    note: candidates.length
      ? "只展示至少 2 个自动来源共同返回过的关键词；分数来自公开推荐词来源覆盖、排名和意图词。"
      : "当前没有足够的双来源交叉验证词，临时展示单源待复核词，需打开来源确认。"
  };
}

const SOCIAL_AUTO_COLLECTORS = [
  { name: "Google 输入框推荐词", weight: 28, family: "搜索需求", collect: (term, geo) => getGoogleSuggest(term, geo) },
  { name: "Google Images 推荐词", weight: 18, family: "视觉场景", collect: (term, geo) => getGoogleImagesSuggest(term, geo) },
  { name: "Google News 推荐词", weight: 12, family: "内容话题", collect: (term, geo) => getGoogleNewsSuggest(term, geo) },
  { name: "TikTok 搜索框推荐词", weight: 22, family: "短视频内容", collect: (term) => getTikTokSuggest(term) },
  { name: "YouTube 推荐词", weight: 18, family: "教程测评", collect: (term, geo) => getYouTubeSuggest(term, geo) },
  { name: "Reddit Search", weight: 16, family: "社区讨论", collect: (term) => getRedditSearch(term) },
  { name: "Amazon 美国站推荐词", weight: 26, family: "电商需求", collect: (term) => getAmazonSuggest(term) },
  { name: "Google Shopping 推荐词", weight: 22, family: "购物搜索", collect: (term, geo) => getGoogleShoppingSuggest(term, geo) },
  { name: "Bing 搜索推荐词", weight: 12, family: "搜索补充", collect: (term) => getBingSuggest(term) },
  { name: "eBay 购物推荐词", weight: 10, family: "二级市场", collect: (term) => getEbaySuggest(term) }
];

function addMonths(date, months) {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const date = new Date(year, monthIndex, 1);
  const offset = (weekday - date.getDay() + 7) % 7;
  date.setDate(1 + offset + (nth - 1) * 7);
  return date;
}

function firstWeekdayOfMonth(year, monthIndex, weekday) {
  return nthWeekdayOfMonth(year, monthIndex, weekday, 1);
}

function isoDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const SOCIAL_EVENT_TEMPLATES = [
  { key: "summer-outdoor", label: "Summer Outdoor", dateForYear: (year) => new Date(year, 6, 15), seeds: ["summer outdoor", "patio decor", "outdoor entertaining", "summer party"], scenes: ["户外庭院", "露台布置", "夏季派对", "户外家居"] },
  { key: "bbq-season", label: "Summer BBQ", dateForYear: (year) => new Date(year, 6, 20), seeds: ["bbq party", "barbecue decor", "grilling accessories", "summer bbq"], scenes: ["夏季烧烤", "庭院聚会", "烤炉周边", "户外餐桌"] },
  { key: "pool-beach", label: "Pool & Beach", dateForYear: (year) => new Date(year, 6, 25), seeds: ["pool party", "beach party", "summer pool decor", "beach decor"], scenes: ["泳池派对", "沙滩出游", "夏季清凉", "户外玩水"] },
  { key: "back-to-school", label: "Back to School", dateForYear: (year) => new Date(year, 7, 1), seeds: ["back to school", "teacher gifts", "dorm decor", "school supplies"], scenes: ["学生宿舍", "教师礼物", "返校收纳", "学习桌布置"] },
  { key: "camping-picnic", label: "Camping & Picnic", dateForYear: (year) => new Date(year, 7, 10), seeds: ["camping accessories", "picnic decor", "camping decor", "outdoor picnic"], scenes: ["露营野餐", "户外收纳", "家庭出游", "车尾箱布置"] },
  { key: "wedding-party", label: "Wedding & Party", dateForYear: (year) => new Date(year, 7, 15), seeds: ["wedding decor", "bridal shower", "party decorations", "baby shower decorations"], scenes: ["婚礼派对", "生日派对", "迎婴派对", "活动布置"] },
  { key: "garden-patio", label: "Garden & Patio", dateForYear: (year) => new Date(year, 7, 20), seeds: ["patio decor", "garden decor", "porch decor", "yard decor"], scenes: ["花园庭院", "门廊布置", "户外灯饰", "家居园艺"] },
  { key: "labor-day", label: "Labor Day", dateForYear: (year) => firstWeekdayOfMonth(year, 8, 1), seeds: ["labor day sale", "patriotic decor", "outdoor party", "bbq decor"], scenes: ["庭院派对", "户外烧烤", "促销礼品", "美国主题装饰"] },
  { key: "football-tailgate", label: "Football Tailgate", dateForYear: (year) => new Date(year, 8, 7), seeds: ["football party", "tailgate party", "game day decor", "football decorations"], scenes: ["比赛日聚会", "车尾派对", "客厅观赛", "零食桌"] },
  { key: "fall", label: "Fall Decor", dateForYear: (year) => new Date(year, 8, 15), seeds: ["fall decor", "fall wreath", "pumpkin decor", "fall centerpiece"], scenes: ["门廊布置", "南瓜元素", "秋季桌面", "丰收主题"] },
  { key: "pet-home", label: "Pet Home & Gifts", dateForYear: (year) => new Date(year, 9, 1), seeds: ["pet gifts", "dog decor", "cat toys", "pet christmas"], scenes: ["宠物家庭", "狗猫礼品", "宠物节日装扮", "宠物家居"] },
  { key: "halloween", label: "Halloween", dateForYear: (year) => new Date(year, 9, 31), seeds: ["halloween decor", "halloween party", "spooky decor", "halloween outdoor decorations"], scenes: ["派对装饰", "门口布置", "恐怖元素", "户外庭院"] },
  { key: "thanksgiving", label: "Thanksgiving", dateForYear: (year) => nthWeekdayOfMonth(year, 10, 4, 4), seeds: ["thanksgiving decor", "thanksgiving centerpiece", "fall table decor", "turkey decor"], scenes: ["餐桌中心装饰", "家庭聚餐", "秋季花环", "感恩节礼物"] },
  { key: "black-friday", label: "Black Friday / Cyber Monday", dateForYear: (year) => { const d = nthWeekdayOfMonth(year, 10, 4, 4); d.setDate(d.getDate() + 1); return d; }, seeds: ["black friday deals", "cyber monday deals", "christmas gifts", "holiday deals"], scenes: ["礼品采购", "套装促销", "电商爆款", "低价组合装"] },
  { key: "christmas", label: "Christmas", dateForYear: (year) => new Date(year, 11, 25), seeds: ["christmas decor", "christmas wreath", "christmas ornaments", "christmas centerpiece"], scenes: ["圣诞装饰", "门饰花环", "桌面中心装饰", "礼物包装"] },
  { key: "new-year", label: "New Year", dateForYear: (year) => new Date(year + 1, 0, 1), seeds: ["new years eve decorations", "party decorations", "gold party decor", "new year gifts"], scenes: ["跨年派对", "金色银色元素", "派对背景", "节日礼品"] }
];

function upcomingSocialEvents(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = addMonths(start, 6);
  const years = [start.getFullYear(), start.getFullYear() + 1];
  return SOCIAL_EVENT_TEMPLATES.flatMap((template) => years.map((year) => ({ ...template, date: template.dateForYear(year) })))
    .filter((event) => event.date >= start && event.date <= end)
    .sort((a, b) => a.date - b.date);
}

function makeSocialRadarSeeds(term) {
  const base = translateDiscoveryTerm(term);
  if (!base) return [];
  const broadSeeds = broadDiscoverySeedsForTerm(base);
  const compatibleKeys = compatibleEventKeysForTopic(base);
  const eventPool = upcomingSocialEvents().filter((event) => !compatibleKeys || compatibleKeys.has(event.key));
  const futureSeeds = eventPool.flatMap((event) => (
    compatibleKeys
      ? [`${event.seeds[0]} ${base}`, `${base} ${event.label.toLowerCase()}`]
      : [`${event.seeds[0]} ${base}`]
  ));
  return uniqueStrings([
    ...broadSeeds,
    base,
    `${base} ideas`,
    `${base} review`,
    `${base} diy`,
    `${base} tiktok`,
    `${base} reddit`,
    `${base} aesthetic`,
    `${base} for home`,
    `${base} gift`,
    ...futureSeeds
  ], compatibleKeys ? 24 : 30);
}

function classifySocialIntent(keyword) {
  const text = String(keyword || "").toLowerCase();
  if (/(review|unboxing|tutorial|how to|diy|ideas|inspo|aesthetic)/i.test(text)) return "内容种草";
  if (/(wreath|decor|decoration|ornament|garland|centerpiece|gift|set|pack|lights|ribbon|bow|toy|supplies)/i.test(text)) return "产品机会";
  if (/(front door|porch|table|mantel|outdoor|indoor|party|classroom|dorm|yard|home)/i.test(text)) return "使用场景";
  if (/(dog|cat|kids|teacher|women|men|mom|dad|baby|pet owner)/i.test(text)) return "人群对象";
  return "搜索延伸";
}

function scoreSocialSignal(keyword, baseTerm, evidence) {
  const baseScore = scoreDiscoveryEvidence(keyword, baseTerm, evidence);
  const socialBonus = evidence.some((item) => /TikTok|YouTube|Reddit|News|Images/i.test(item.source)) ? 8 : 0;
  const discussionBonus = evidence.some((item) => /Reddit|News/i.test(item.source)) ? 5 : 0;
  return Math.min(100, baseScore + socialBonus + discussionBonus);
}

const SOCIAL_EVENT_PATTERNS = {
  "summer-outdoor": /\b(summer|outdoor|patio|yard|garden|pool|beach|camping|picnic|porch|deck)\b/i,
  "bbq-season": /\b(bbq|barbecue|grill|grilling|cookout|outdoor dining|patio party|summer party)\b/i,
  "pool-beach": /\b(pool|beach|swim|swimming|water|float|tropical|coastal|luau)\b/i,
  "back-to-school": /\b(back to school|teacher|school|classroom|dorm|student|college|school supplies|backpack)\b/i,
  "camping-picnic": /\b(camping|camp|picnic|hiking|rv|camper|outdoor blanket|cooler|travel)\b/i,
  "wedding-party": /\b(wedding|bridal|bride|party|birthday|baby shower|shower|event|balloon)\b/i,
  "garden-patio": /\b(garden|patio|porch|yard|deck|outdoor light|planter|lawn|front door)\b/i,
  "labor-day": /\b(labor day|bbq|barbecue|patriotic|outdoor party|yard party|sale)\b/i,
  "football-tailgate": /\b(football|tailgate|game day|super bowl|team|sports party|watch party)\b/i,
  fall: /\b(fall|autumn|pumpkin|harvest|fall table|fall porch)\b/i,
  "pet-home": /\b(pet|dog|cat|puppy|kitten|pet owner|pet gift|pet toy|pet decor)\b/i,
  halloween: /\b(halloween|spooky|ghost|witch|skull|haunted|trick or treat)\b/i,
  thanksgiving: /\b(thanksgiving|turkey|harvest|fall table|thankful)\b/i,
  "black-friday": /\b(black friday|cyber monday|deal|deals|christmas gift|holiday deal|gift)\b/i,
  christmas: /\b(christmas|xmas|holiday|santa|wreath|ornament|tree|stocking|nativity)\b/i,
  "new-year": /\b(new year|new years eve|nye|countdown|party decor|gold|silver)\b/i
};

const SOCIAL_WEAK_TOPIC_TOKENS = new Set([
  "decor",
  "decoration",
  "decorations",
  "home",
  "house",
  "ideas",
  "idea",
  "gift",
  "gifts",
  "set",
  "pack",
  "diy",
  "best",
  "with",
  "for",
  "and",
  "the"
]);

function escapeRegexLiteral(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function topicTokenMatchesCandidate(token, keyword) {
  const escaped = escapeRegexLiteral(token);
  const pattern = token.length <= 3
    ? new RegExp(`\\b${escaped}\\b`, "i")
    : new RegExp(`\\b${escaped}\\w*\\b`, "i");
  return pattern.test(keyword);
}

function topicMatchesCandidate(topic, keyword) {
  const tokens = String(topic || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  const usefulTokens = tokens.filter((token) => token.length >= 2 && !SOCIAL_WEAK_TOPIC_TOKENS.has(token));
  const fallbackTokens = tokens.filter((token) => token.length >= 2);
  const relevantTokens = usefulTokens.length ? usefulTokens : fallbackTokens;
  if (!relevantTokens.length) return true;
  return relevantTokens.some((token) => topicTokenMatchesCandidate(token, keyword));
}

function isNoisySocialEventCandidate(keyword, topic) {
  const text = String(keyword || "").toLowerCase();
  if (/\breddit\b/.test(text)) return true;
  if (/\b(homes for sale|apartments?|weather|restaurants?|menu|jobs|lyrics|song|movie|tv show)\b/i.test(text)) return true;

  const tokens = String(topic || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  const usefulTokens = tokens.filter((token) => token.length >= 2 && !SOCIAL_WEAK_TOPIC_TOKENS.has(token));
  for (const token of usefulTokens) {
    const escaped = escapeRegexLiteral(token);
    if (new RegExp(`\\b(no|not|without|except)\\s+${escaped}\\b`, "i").test(text)) return true;
  }

  if (usefulTokens.includes("red") && /\b(red deer|red wing mn|red bank|red rocks|red river|red lodge|redondo)\b/i.test(text)) return true;
  return false;
}

function compatibleEventKeysForTopic(topic) {
  const text = String(topic || "").toLowerCase();
  if (/\b(christmas|xmas|santa|ornament|christmas tree)\b/i.test(text)) return new Set(["christmas", "black-friday", "new-year"]);
  if (/\b(bbq|barbecue|grill|grilling|cookout)\b/i.test(text)) return new Set(["bbq-season", "summer-outdoor", "labor-day"]);
  if (/\b(pool|beach|swim|swimming|water|float|tropical|coastal)\b/i.test(text)) return new Set(["pool-beach", "summer-outdoor", "bbq-season"]);
  if (/\b(camping|camp|picnic|hiking|rv|camper|travel)\b/i.test(text)) return new Set(["camping-picnic", "summer-outdoor", "labor-day", "fall"]);
  if (/\b(patio|yard|garden|porch|deck|planter|lawn|front door)\b/i.test(text)) return new Set(["garden-patio", "summer-outdoor", "bbq-season", "labor-day", "fall"]);
  if (/\b(summer|outdoor)\b/i.test(text)) return new Set(["summer-outdoor", "bbq-season", "pool-beach", "camping-picnic", "garden-patio", "labor-day"]);
  if (/\b(wedding|bridal|bride|party|birthday|baby shower|shower|event|balloon)\b/i.test(text)) return new Set(["wedding-party", "summer-outdoor", "new-year", "labor-day"]);
  if (/\b(football|tailgate|game day|super bowl|sports party|watch party)\b/i.test(text)) return new Set(["football-tailgate", "labor-day", "fall"]);
  if (/\b(pet|dog|cat|puppy|kitten|pet owner|pet gift|pet toy)\b/i.test(text)) return new Set(["pet-home", "halloween", "christmas", "black-friday"]);
  if (/\b(halloween|spooky|ghost|witch|skull)\b/i.test(text)) return new Set(["halloween", "fall"]);
  if (/\b(thanksgiving|turkey)\b/i.test(text)) return new Set(["thanksgiving", "fall", "black-friday"]);
  if (/\b(fall|autumn|pumpkin|harvest)\b/i.test(text)) return new Set(["fall", "halloween", "thanksgiving"]);
  if (/\b(back to school|teacher|school|classroom|dorm|student|college)\b/i.test(text)) return new Set(["back-to-school", "labor-day"]);
  if (/\b(new year|new years eve|nye)\b/i.test(text)) return new Set(["new-year", "christmas"]);
  return null;
}

function socialEventMatch(event, candidate, topic) {
  const compatibleKeys = compatibleEventKeysForTopic(topic);
  if (compatibleKeys && !compatibleKeys.has(event.key)) return false;
  const text = String(candidate.keyword || "").toLowerCase();
  if (isNoisySocialEventCandidate(text, topic)) return false;
  if (!topicMatchesCandidate(topic, text)) return false;
  const pattern = SOCIAL_EVENT_PATTERNS[event.key];
  return pattern ? pattern.test(text) : false;
}

function buildTrendReview(result) {
  const timeline = Array.isArray(result?.meta?.timeline) ? result.meta.timeline : [];
  if (result?.status !== "live" || timeline.length < 18) {
    return { status: "unavailable", source: result?.source || "Google Trends", link: result?.link || "", note: result?.note || "Google Trends 当前没有返回足够的历史曲线，先作为人工复核入口。" };
  }
  const recent = timeline.slice(-12);
  const previous = timeline.slice(-24, -12);
  const avg = (points) => Math.round(points.reduce((sum, point) => sum + (Number(point.value) || 0), 0) / Math.max(1, points.length));
  const recentAvg = avg(recent);
  const previousAvg = avg(previous);
  const growth = previousAvg ? Math.round(((recentAvg - previousAvg) / previousAvg) * 100) : 0;
  const peak = timeline.reduce((best, point) => (Number(point.value) || 0) > (Number(best.value) || 0) ? point : best, timeline[0]);
  return { status: "live", source: result.source, link: result.link, recentAvg, previousAvg, growth, peak, note: "历史曲线来自 Google Trends 网页接口；不是销量，也不是绝对搜索量。" };
}

function buildSocialPlatformRecommendations(term, geo, sourceStats) {
  const statList = Array.from(sourceStats.values());
  const statFor = (pattern) => statList.find((stat) => pattern.test(stat.source));
  const livePlatform = (label, pattern, link, role) => {
    const stat = statFor(pattern);
    const count = Number(stat?.itemCount || 0);
    return { platform: label, role, status: count ? "auto" : "watch", signal: count ? Math.min(100, 42 + count * 3) : 0, proof: count ? `${count} 条公开推荐/标题信号` : "本次未返回稳定自动信号", link, scoring: Boolean(count) };
  };
  const manualPlatform = (label, link, role, proof) => ({ platform: label, role, status: "manual", signal: null, proof, link, scoring: false });
  return [
    livePlatform("TikTok", /TikTok/i, makeTikTokLink(term), "短视频种草、热点元素、场景内容"),
    livePlatform("YouTube", /YouTube/i, makeYouTubeLink(term), "教程、测评、开箱、使用场景"),
    livePlatform("Reddit", /Reddit/i, makeRedditLink(term), "真实讨论、吐槽、痛点和小众圈层"),
    livePlatform("Google Images", /Images/i, makeGoogleImagesLink(term), "视觉密度、风格方向、素材场景"),
    livePlatform("Google News", /News/i, makeGoogleNewsLink(term, geo), "新闻/内容话题和上升语境"),
    livePlatform("Amazon", /Amazon/i, makeAmazonLink(term), "电商购买词、规格词、套装词"),
    livePlatform("Google Shopping", /Shopping/i, makeGoogleShoppingLink(term), "购物搜索和价格带方向"),
    manualPlatform("Pinterest Trends", makePinterestLink(term, geo), "审美趋势、节日视觉、图片种草", "页面可打开验证，但没有稳定公开 JSON 接口。"),
    manualPlatform("Instagram", makeInstagramTagLink(term), "图片内容、标签语境、生活方式场景", "需要登录/地区上下文，作为人工复核入口。"),
    manualPlatform("Facebook", makeFacebookSearchLink(term), "社群讨论、本地需求、妈妈群/兴趣群反馈", "需要登录和权限，适合手动看评论与帖子。"),
    manualPlatform("Facebook Marketplace", makeFacebookMarketplaceLink(term), "本地交易、二手需求、价格带感知", "需要登录复核，不进入自动评分。"),
    manualPlatform("X", makeXSearchLink(term), "即时话题、吐槽、流行语和事件驱动需求", "受登录和地区影响，作为人工复核入口。"),
    manualPlatform("Threads", makeThreadsSearchLink(term), "轻社交讨论、生活方式语境", "当前作为人工复核入口。")
  ];
}

async function collectSocialRadar(term, geo) {
  const normalizedTerm = translateDiscoveryTerm(term);
  const seeds = makeSocialRadarSeeds(term);
  const candidateMap = new Map();
  const sourceStats = new Map();
  const rawSignals = [];
  const seedResults = await mapWithLimit(seeds, 3, async (seed) => {
    const results = await mapWithLimit(SOCIAL_AUTO_COLLECTORS, 4, async (collector) => {
      const result = await settleSource(collector.name, () => collector.collect(seed, geo));
      return { collector, result, seed };
    });
    return results;
  });

  seedResults.flat().forEach(({ collector, result, seed }) => {
    const stat = sourceStats.get(collector.name) || { source: collector.name, family: collector.family, status: result.status, itemCount: 0, seeds: new Set(), link: result.link || makeKeywordActionLink(collector.name, seed, geo), note: result.note || "" };
    stat.status = stat.status === "live" || result.status === "live" ? "live" : result.status;
    stat.itemCount += Array.isArray(result.items) ? result.items.length : 0;
    stat.seeds.add(seed);
    sourceStats.set(collector.name, stat);
    if (result.status !== "live") return;
    (result.items || []).forEach((rawKeyword, index) => {
      const keyword = normalizeDiscoveryKeyword(rawKeyword);
      if (!isUsefulDiscoveryKeyword(keyword, term)) return;
      const signal = { keyword, source: collector.name, family: collector.family, seed, rank: index + 1, score: Math.max(3, collector.weight - index * 2), link: makeKeywordActionLink(collector.name, keyword, geo) };
      rawSignals.push(signal);
      const key = keyword.toLowerCase();
      const bucket = candidateMap.get(key) || { keyword, intent: classifySocialIntent(keyword), evidence: [], sources: new Set(), families: new Set(), seeds: new Set() };
      const duplicate = bucket.evidence.find((item) => item.source === collector.name);
      if (!duplicate || duplicate.rank > signal.rank) {
        bucket.evidence = bucket.evidence.filter((item) => item.source !== collector.name);
        bucket.evidence.push(signal);
      }
      bucket.sources.add(collector.name);
      bucket.families.add(collector.family);
      bucket.seeds.add(seed);
      candidateMap.set(key, bucket);
    });
  });

  const allCandidates = Array.from(candidateMap.values()).map((bucket) => {
    const evidence = bucket.evidence.sort((a, b) => b.score - a.score).slice(0, 6);
    const score = scoreSocialSignal(bucket.keyword, term, evidence);
    return { keyword: bucket.keyword, intent: bucket.intent, score, level: heatLevel(score), sourceCount: bucket.sources.size, familyCount: bucket.families.size, sources: Array.from(bucket.sources), families: Array.from(bucket.families), seeds: Array.from(bucket.seeds).slice(0, 6), evidence, validationLinks: makeValidationLinks(bucket.keyword, geo).slice(0, 8) };
  }).sort((a, b) => b.score - a.score || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword));

  const currentHot = allCandidates.filter((item) => item.sourceCount >= 2).slice(0, 18);
  const fallbackHot = currentHot.length ? currentHot : allCandidates.slice(0, 12);
  const futureEvents = upcomingSocialEvents().map((event) => {
    const matched = allCandidates.filter((candidate) => socialEventMatch(event, candidate, normalizedTerm || term)).slice(0, 8);
    const score = matched.length ? Math.round(matched.slice(0, 5).reduce((sum, item) => sum + item.score, 0) / Math.min(5, matched.length)) : 0;
    const suggestedQueries = uniqueStrings([...event.seeds.map((seed) => `${seed} ${normalizedTerm}`), ...event.scenes.map((scene) => `${normalizedTerm} ${scene}`), `${normalizedTerm} ${event.label.toLowerCase()}`], 6);
    return { key: event.key, label: event.label, date: isoDay(event.date), scenes: event.scenes, score, level: heatLevel(score), products: matched, suggestedQueries, validationLinks: makeValidationLinks(matched[0]?.keyword || suggestedQueries[0] || normalizedTerm, geo).slice(0, 6) };
  });
  const discussionSignals = rawSignals.filter((item) => /Reddit|News|TikTok|YouTube/i.test(item.source)).sort((a, b) => b.score - a.score || a.rank - b.rank).slice(0, 18).map((item) => ({ keyword: item.keyword, source: item.source, family: item.family, seed: item.seed, rank: item.rank, link: item.link, intent: classifySocialIntent(item.keyword) }));
  const trendSource = await settleSource("Google Trends 曲线", () => getGoogleTrends(normalizedTerm || term, geo));

  return { term: normalizeSeedTerm(term), normalizedTerm, geo, generatedAt: new Date().toISOString(), querySeeds: seeds, sources: Array.from(sourceStats.values()).map((stat) => ({ ...stat, seeds: Array.from(stat.seeds).slice(0, 4) })), platforms: buildSocialPlatformRecommendations(normalizedTerm || term, geo, sourceStats), currentHot: fallbackHot, discussionSignals, futureEvents, lastYearReview: { trend: buildTrendReview(trendSource), risingCandidates: fallbackHot.slice(0, 8), note: "去年/历史回看优先读取 Google Trends 曲线；若平台未返回足够时间点，就只保留官方复核入口，不生成假曲线。" }, note: "自动评分只使用公开推荐词、公开搜索/标题信号；Facebook、Instagram、Pinterest、X、Threads 等登录型平台只作为人工复核入口。" };
}

async function mapWithLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function makeValidationLinks(keyword, geo) {
  return [
    { label: "Google Trends", url: makeGoogleTrendsLink(keyword, geo), type: "trend", scored: false },
    { label: "Google Images", url: makeGoogleImagesLink(keyword), type: "visual", scored: false },
    { label: "Google News", url: makeGoogleNewsLink(keyword, geo), type: "content", scored: false },
    { label: "TikTok", url: makeTikTokLink(keyword), type: "social", scored: false },
    { label: "YouTube", url: makeYouTubeLink(keyword), type: "social", scored: false },
    { label: "Pinterest", url: makePinterestLink(keyword, geo), type: "visual", scored: false },
    { label: "Instagram", url: makeInstagramTagLink(keyword), type: "social", scored: false },
    { label: "Facebook", url: makeFacebookSearchLink(keyword), type: "social", scored: false },
    { label: "Facebook Marketplace", url: makeFacebookMarketplaceLink(keyword), type: "marketplace", scored: false },
    { label: "X", url: makeXSearchLink(keyword), type: "social", scored: false },
    { label: "Threads", url: makeThreadsSearchLink(keyword), type: "social", scored: false },
    { label: "Amazon Best Sellers", url: makeAmazonBestSellersLink(keyword), type: "marketplace", scored: false },
    { label: "Amazon Movers", url: makeAmazonMoversLink(keyword), type: "marketplace", scored: false },
    { label: "Amazon New Releases", url: makeAmazonNewReleasesLink(keyword), type: "marketplace", scored: false },
    { label: "Amazon Most Wished", url: makeAmazonMostWishedLink(keyword), type: "marketplace", scored: false },
    { label: "Etsy", url: makeEtsyLink(keyword), type: "marketplace", scored: false },
    { label: "Walmart", url: makeWalmartLink(keyword), type: "marketplace", scored: false },
    { label: "Target", url: makeTargetLink(keyword), type: "marketplace", scored: false },
    { label: "Home Depot", url: makeHomeDepotLink(keyword), type: "marketplace", scored: false },
    { label: "Lowe's", url: makeLowesLink(keyword), type: "marketplace", scored: false },
    { label: "Wayfair", url: makeWayfairLink(keyword), type: "marketplace", scored: false },
    { label: "AliExpress", url: makeAliExpressLink(keyword), type: "sourcing", scored: false },
    { label: "Temu", url: makeTemuLink(keyword), type: "marketplace", scored: false },
    { label: "SHEIN", url: makeSheinLink(keyword), type: "marketplace", scored: false },
    { label: "Meta Ads Library", url: makeMetaAdsLibraryLink(keyword), type: "ads", scored: false },
    { label: "Kickstarter", url: makeKickstarterLink(keyword), type: "launch", scored: false },
    { label: "Product Hunt", url: makeProductHuntLink(keyword), type: "launch", scored: false },
    { label: "Quora", url: makeQuoraLink(keyword), type: "community", scored: false },
    { label: "TrendHunter", url: makeTrendHunterLink(keyword), type: "trend", scored: false },
    { label: "Exploding Topics", url: makeExplodingTopicsLink(keyword), type: "trend", scored: false },
    { label: "Reddit", url: makeRedditLink(keyword), type: "community", scored: false }
  ];
}

function heatLevel(heat) {
  if (heat >= 85) return "hot";
  if (heat >= 65) return "strong";
  if (heat >= 45) return "watch";
  return "weak";
}

function normalizeSeedTerm(term) {
  return String(term || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function makeCategoryKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function withPrefix(prefix, term) {
  const cleanTerm = normalizeSeedTerm(term);
  if (!cleanTerm) return prefix;
  return cleanTerm.toLowerCase().includes(prefix.toLowerCase()) ? cleanTerm : `${prefix} ${cleanTerm}`;
}

function withSuffix(term, suffix) {
  const cleanTerm = normalizeSeedTerm(term);
  if (!cleanTerm) return suffix;
  return cleanTerm.toLowerCase().includes(suffix.toLowerCase()) ? cleanTerm : `${cleanTerm} ${suffix}`;
}

function replacePetTerm(term, replacement) {
  const cleanTerm = normalizeSeedTerm(term);
  const replaced = cleanTerm.replace(/\bpet\b/i, replacement);
  return replaced === cleanTerm ? `${cleanTerm} ${replacement}` : replaced;
}

function buildContextualCategoryGroups(term) {
  const baseTerm = normalizeSeedTerm(term);
  if (!baseTerm) return HOLIDAY_CATEGORY_GROUPS;

  const isPetTerm = /\b(pet|dog|cat|puppy|kitten)\b/i.test(baseTerm);
  const audienceSubcategories = isPetTerm
    ? [
      { label: "Dog Direction", event: "Pet Audience", season: "全年", seed: replacePetTerm(baseTerm, "dog") },
      { label: "Cat Direction", event: "Pet Audience", season: "全年", seed: replacePetTerm(baseTerm, "cat") },
      { label: "Small Pet Direction", event: "Pet Audience", season: "全年", seed: withPrefix("small", baseTerm) },
      { label: "Outdoor Pet Direction", event: "Pet Scene", season: "冬季", seed: withPrefix("outdoor", baseTerm) },
      { label: "Indoor Pet Direction", event: "Pet Scene", season: "冬季", seed: withPrefix("indoor", baseTerm) },
      { label: "Pet Owner Gift", event: "Gift", season: "节日", seed: `${baseTerm} gift` }
    ]
    : [
      { label: "For Home", event: "Audience", season: "全年", seed: `${baseTerm} for home` },
      { label: "For Women", event: "Audience", season: "全年", seed: `${baseTerm} for women` },
      { label: "For Men", event: "Audience", season: "全年", seed: `${baseTerm} for men` },
      { label: "For Kids", event: "Audience", season: "全年", seed: `${baseTerm} for kids` },
      { label: "Gift Direction", event: "Gift", season: "节日", seed: `${baseTerm} gift` },
      { label: "Bulk Direction", event: "B2B", season: "全年", seed: `${baseTerm} bulk` }
    ];

  return [
    {
      key: "input-core",
      label: "输入词核心扩展",
      description: `围绕 ${baseTerm} 的主词、购买词和灵感词，判断基础需求是否真实存在。`,
      subcategories: [
        { label: "Base Query", event: "Core", season: "全年", seed: baseTerm },
        { label: "Ideas", event: "Inspiration", season: "全年", seed: withSuffix(baseTerm, "ideas") },
        { label: "Decor", event: "Home Decor", season: "全年", seed: withSuffix(baseTerm, "decor") },
        { label: "Set", event: "Product Bundle", season: "全年", seed: withSuffix(baseTerm, "set") },
        { label: "Amazon Buying", event: "Marketplace", season: "全年", seed: withSuffix(baseTerm, "amazon") },
        { label: "Best", event: "Buying Intent", season: "全年", seed: withPrefix("best", baseTerm) }
      ]
    },
    {
      key: "seasonal-events",
      label: "季节节日场景",
      description: `把 ${baseTerm} 放进美国常见季节和节日语境，看需求是否集中在某些月份。`,
      subcategories: [
        { label: "Winter", event: "Winter", season: "冬季", seed: withPrefix("winter", baseTerm) },
        { label: "Christmas", event: "Christmas", season: "冬季", seed: withPrefix("christmas", baseTerm) },
        { label: "Holiday", event: "Holiday", season: "冬季", seed: withPrefix("holiday", baseTerm) },
        { label: "Fall", event: "Fall", season: "秋季", seed: withPrefix("fall", baseTerm) },
        { label: "Halloween", event: "Halloween", season: "秋季", seed: withPrefix("halloween", baseTerm) },
        { label: "Thanksgiving", event: "Thanksgiving", season: "秋季", seed: withPrefix("thanksgiving", baseTerm) }
      ]
    },
    {
      key: "audience-objects",
      label: isPetTerm ? "宠物对象细分" : "人群对象细分",
      description: `拆分 ${baseTerm} 的购买对象，找更容易出单的细分人群或使用对象。`,
      subcategories: audienceSubcategories
    },
    {
      key: "usage-scenes",
      label: "使用场景细分",
      description: `从室内、户外、DIY、布置和审美内容方向验证 ${baseTerm} 的场景热度。`,
      subcategories: [
        { label: "Indoor", event: "Usage Scene", season: "全年", seed: withPrefix("indoor", baseTerm) },
        { label: "Outdoor", event: "Usage Scene", season: "全年", seed: withPrefix("outdoor", baseTerm) },
        { label: "DIY", event: "DIY", season: "全年", seed: withSuffix(baseTerm, "diy") },
        { label: "Setup", event: "How To", season: "全年", seed: withSuffix(baseTerm, "setup") },
        { label: "Aesthetic", event: "Social Style", season: "全年", seed: withSuffix(baseTerm, "aesthetic") },
        { label: "Cozy", event: "Home Style", season: "冬季", seed: withPrefix("cozy", baseTerm) }
      ]
    },
    {
      key: "shopping-modifiers",
      label: "购物规格细分",
      description: `加入规格、材质、套装和价格意图，判断 ${baseTerm} 是否有明确购物需求。`,
      subcategories: [
        { label: "Large", event: "Specification", season: "全年", seed: withSuffix(baseTerm, "large") },
        { label: "Small", event: "Specification", season: "全年", seed: withSuffix(baseTerm, "small") },
        { label: "Waterproof", event: "Feature", season: "全年", seed: withSuffix(baseTerm, "waterproof") },
        { label: "Washable", event: "Feature", season: "全年", seed: withSuffix(baseTerm, "washable") },
        { label: "4 Pack", event: "Bundle", season: "全年", seed: withSuffix(baseTerm, "4 pack") },
        { label: "Cheap", event: "Price", season: "全年", seed: withPrefix("cheap", baseTerm) }
      ]
    },
    {
      key: "social-content",
      label: "社媒内容验证",
      description: `把 ${baseTerm} 放进 TikTok、YouTube、Pinterest 常见内容语境，看是否适合做内容种草。`,
      subcategories: [
        { label: "TikTok", event: "TikTok", season: "全年", seed: withSuffix(baseTerm, "tiktok") },
        { label: "Pinterest", event: "Pinterest", season: "全年", seed: withSuffix(baseTerm, "pinterest") },
        { label: "Review", event: "Review", season: "全年", seed: withSuffix(baseTerm, "review") },
        { label: "Unboxing", event: "Unboxing", season: "全年", seed: withSuffix(baseTerm, "unboxing") },
        { label: "Tutorial", event: "Tutorial", season: "全年", seed: withSuffix(baseTerm, "tutorial") },
        { label: "How To Use", event: "How To", season: "全年", seed: withPrefix("how to use", baseTerm) }
      ]
    }
  ].map((category) => ({
    ...category,
    key: makeCategoryKey(category.key || category.label)
  }));
}

async function collectHolidaySubcategory(subcategory, geo) {
  const results = await mapWithLimit(SEASONAL_SOURCE_COLLECTORS, 4, async (collector) => ({
    collector,
    result: await settleSource(collector.name, () => collector.collect(subcategory.seed, geo))
  }));

  return results.flatMap(({ collector, result }) => {
    if (result.status !== "live" || !Array.isArray(result.items)) return [];
    return result.items
      .map((keyword) => String(keyword || "").trim())
      .filter(isUsefulSeasonalKeyword)
      .slice(0, collector.maxItems)
      .map((keyword, index) => ({
        event: subcategory.event,
        season: subcategory.season,
        subcategory: subcategory.label,
        seed: subcategory.seed,
        keyword,
        source: result.source,
        rank: index + 1,
        score: Math.max(6, collector.weight - index * 4),
        link: makeKeywordActionLink(result.source, keyword, geo),
        sourceNote: result.note,
        trendsLink: makeGoogleTrendsLink(keyword, geo),
        validationLinks: makeValidationLinks(keyword, geo)
      }));
  });
}

function aggregateKeywordSignals(signals, geo) {
  const buckets = new Map();

  signals.forEach((item) => {
    const key = item.keyword.toLowerCase();
    if (!buckets.has(key)) {
      buckets.set(key, {
        keyword: item.keyword,
        events: new Set(),
        seasons: new Set(),
        subcategories: new Set(),
        seeds: new Set(),
        sources: new Set(),
        signalKeys: new Set(),
        links: new Map(),
        score: 0,
        bestRank: item.rank
      });
    }

    const bucket = buckets.get(key);
    const signalKey = `${item.source}:${key}`;
    if (bucket.signalKeys.has(signalKey)) return;

    bucket.signalKeys.add(signalKey);
    bucket.events.add(item.event);
    bucket.seasons.add(item.season);
    bucket.subcategories.add(item.subcategory);
    bucket.seeds.add(item.seed);
    bucket.sources.add(item.source);
      bucket.links.set(item.source, {
        source: item.source,
        url: item.link,
        scored: true
      });
      bucket.score += item.score;
      bucket.bestRank = Math.min(bucket.bestRank, item.rank);
  });

  return Array.from(buckets.values())
    .map((bucket) => {
      const coverageBonus = Math.max(0, bucket.sources.size - 1) * 5;
      const rankBonus = Math.max(0, 5 - bucket.bestRank) * 2;
      const rawHeat = bucket.score + coverageBonus + rankBonus;
      const heat = Math.min(100, Math.round(18 + rawHeat * 0.42));
      return {
        keyword: bucket.keyword,
        heat,
        heatLevel: heatLevel(heat),
        sourceCount: bucket.sources.size,
        events: Array.from(bucket.events),
        seasons: Array.from(bucket.seasons),
        subcategories: Array.from(bucket.subcategories),
        seeds: Array.from(bucket.seeds),
        sources: Array.from(bucket.sources),
        links: Array.from(bucket.links.values()),
        trendsLink: makeGoogleTrendsLink(bucket.keyword, geo),
        validationLinks: makeValidationLinks(bucket.keyword, geo)
      };
    })
    .sort((a, b) => b.heat - a.heat || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword));
}

async function buildSeasonalKeywords(geo, term = "") {
  const seedTerm = normalizeSeedTerm(term);
  const categoryGroups = buildContextualCategoryGroups(seedTerm);
  const categories = await mapWithLimit(categoryGroups, 2, async (category) => {
    const subcategories = await mapWithLimit(category.subcategories, 3, async (subcategory) => {
      const signals = await collectHolidaySubcategory(subcategory, geo);
      const items = aggregateKeywordSignals(signals, geo).slice(0, 8);
      const topItems = items.slice(0, 5);
      const score = topItems.length
        ? Math.round(topItems.reduce((sum, item) => sum + item.heat, 0) / topItems.length)
        : 0;

      return {
        label: subcategory.label,
        event: subcategory.event,
        season: subcategory.season,
        seed: subcategory.seed,
        score,
        heatLevel: heatLevel(score),
        topKeyword: items[0]?.keyword || "",
        liveSignalCount: signals.length,
        items
      };
    });

    const categoryItems = subcategories.flatMap((subcategory) => subcategory.items.map((item) => ({
      ...item,
      subcategory: subcategory.label,
      event: subcategory.event,
      season: subcategory.season
    })));
    const topItems = categoryItems
      .sort((a, b) => b.heat - a.heat || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword))
      .slice(0, 8);
    const score = topItems.length
      ? Math.round(topItems.reduce((sum, item) => sum + item.heat, 0) / topItems.length)
      : 0;

    return {
      key: category.key,
      label: category.label,
      description: category.description,
      score,
      heatLevel: heatLevel(score),
      topKeyword: topItems[0]?.keyword || "",
      subcategories
    };
  });

  const highPotentialPool = categories
    .flatMap((category) => category.subcategories.flatMap((subcategory) => subcategory.items.map((item) => ({
      ...item,
      category: category.label,
      subcategory: subcategory.label,
      event: subcategory.event,
      season: subcategory.season
    }))));
  const highPotentialMap = new Map();
  highPotentialPool.forEach((item) => {
    const key = item.keyword.toLowerCase();
    const existing = highPotentialMap.get(key);
    if (!existing || item.heat > existing.heat || item.sourceCount > existing.sourceCount) {
      highPotentialMap.set(key, item);
    }
  });
  const highPotential = Array.from(highPotentialMap.values())
    .sort((a, b) => b.heat - a.heat || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword))
    .slice(0, 24);

  return {
    geo,
    term: seedTerm,
    mode: seedTerm ? "keyword-context" : "holiday-default",
    generatedAt: new Date().toISOString(),
    sources: SEASONAL_SOURCE_COLLECTORS.map((source) => source.name),
    verificationOnlySources: ["Google Trends", "Pinterest", "Google Images", "Google News", "Instagram", "Etsy", "Walmart", "Target", "Home Depot", "Lowe's", "Wayfair", "Meta Ads Library", "Reddit", "TrendHunter", "Exploding Topics"],
    note: seedTerm
      ? `热度为真实来源热度指数：当前围绕 ${seedTerm} 生成细分词；只按实时 autocomplete 返回词、排名、平台覆盖数和来源权重计算；验证入口不参与评分，不等同于官方搜索量。`
      : "热度为真实来源热度指数：只按实时 autocomplete 返回词、排名、平台覆盖数和来源权重计算；验证入口不参与评分，不等同于官方搜索量。",
    reliability: {
      scoringRule: "只统计 status=live 且实时返回 items 的来源。",
      scoringSources: SEASONAL_SOURCE_COLLECTORS.map((source) => source.name),
      verificationOnlySources: ["Google Trends", "Pinterest", "Google Images", "Google News", "Instagram", "Etsy", "Walmart", "Target", "Home Depot", "Lowe's", "Wayfair", "Meta Ads Library", "Reddit", "TrendHunter", "Exploding Topics"],
      cacheMinutes: Math.round(SEASONAL_CACHE_TTL_MS / 60000)
    },
    categories,
    highPotential
  };
}

function summarizeSeries(series) {
  const values = series.map((point) => Number(point.value) || 0);
  const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const first = values[0] || 0;
  const last = values[values.length - 1] || 0;
  const growth = first ? Math.round(((last - first) / first) * 100) : 0;
  const peak = Math.max(...values, 0);

  let pace = "Steady";
  let paceType = "Moderate";
  if (growth >= 55) {
    pace = "Growing";
    paceType = "Rapid";
  } else if (growth >= 18) {
    pace = "Growing";
    paceType = "Steady";
  } else if (growth <= -18) {
    pace = "Declining";
    paceType = "Cooling";
  }

  return { average, growth, peak, pace, paceType };
}

function makeUnavailableTrendResponse(term, geo, view, reason) {
  return {
    mode: "unconfigured",
    source: "未接入真实趋势源",
    warning: reason || "尚未配置 Treendly UID 和 password；当前不展示趋势曲线，只显示可实时抓取的平台推荐词。",
    term,
    geo,
    view: Number(view) === 1 ? 1 : 5,
    summary: {
      average: null,
      growth: null,
      peak: null,
      pace: "Check",
      paceType: "Check",
      opportunity: "Check",
      monthlySearches: null,
      updated: formatDate(new Date())
    },
    series: [],
    related: [],
    raw: null
  };
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.term || item.keyword || item.query || item.name || "";
      return "";
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeTreendlyResponse(raw, term, geo, view) {
  const trendArray = Array.isArray(raw.trend)
    ? raw.trend
    : Array.isArray(raw?.data?.values)
      ? raw.data.values
      : Array.isArray(raw?.attributes?.data?.values)
        ? raw.attributes.data.values
        : [];

  const series = trendArray.map((point) => {
    const stamp = point.time || point.timestamp || point[0];
    const numeric = Number(stamp);
    const date = numeric > 1000000000
      ? new Date(numeric * 1000)
      : new Date(stamp || Date.now());

    return {
      date: formatDate(date),
      value: Number(point.value ?? point[1] ?? 0)
    };
  });

  const fallbackSummary = summarizeSeries(series);
  const trend = raw?.attributes?.trend || raw?.trendObject || raw?.data?.trend || {};
  const stats = raw?.data?.stats || raw?.attributes?.data?.stats || {};
  const microdata = raw?.microdata || raw?.attributes?.microdata || {};
  const related = raw?.related || raw?.attributes?.related || {};

  return {
    mode: "live",
    source: "Treendly API",
    warning: "",
    term,
    geo,
    view: Number(view) === 1 ? 1 : 5,
    summary: {
      average: Number(trend.average ?? stats.avgValue ?? fallbackSummary.average),
      growth: Number(raw?.pace?.growth ?? fallbackSummary.growth),
      peak: Number(stats.maxValue ?? fallbackSummary.peak),
      pace: String(trend.pace || raw?.pace?.formatted || fallbackSummary.pace),
      paceType: String(trend.pace_type || raw?.pace?.type?.formatted || fallbackSummary.paceType),
      opportunity: String(raw?.opportunity?.formatted || raw?.attributes?.opportunity?.formatted || "Check"),
      monthlySearches: Number(microdata?.searches?.average || 0),
      updated: raw.updated ? formatDate(new Date(Number(raw.updated) * 1000)) : formatDate(new Date())
    },
    series,
    related: {
      googleRising: normalizeArray(related?.google?.rising),
      googleTop: normalizeArray(related?.google?.top),
      amazon: normalizeArray(related?.amazon),
      youtube: normalizeArray(related?.youtube)
    },
    raw
  };
}

async function callTreendly(term, geo, view) {
  const endpoint = `${TREENDLY_BASE}/quick-get`;
  const url = new URL(endpoint);
  url.searchParams.set("term", term);
  url.searchParams.set("geo", geo);
  url.searchParams.set("view", String(view));

  const body = new URLSearchParams({
    uid: TREENDLY_UID,
    password: TREENDLY_PASSWORD,
    term,
    geo,
    view: String(view)
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Via": "api",
        "User-Agent": "Treendly"
      },
      body,
      signal: controller.signal
    });

    const text = await response.text();
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw new Error(`Treendly 返回的不是 JSON：${text.slice(0, 120)}`);
    }

    if (!response.ok || raw.status !== 200 || raw.code !== 1) {
      throw new Error(raw.data || `Treendly API status ${raw.status || response.status}`);
    }

    return normalizeTreendlyResponse(raw, term, geo, view);
  } finally {
    clearTimeout(timer);
  }
}

function getSearchParams(req) {
  return new URL(req.url, `http://${req.headers.host}`).searchParams;
}

async function handleQuickGet(req, res) {
  const params = getSearchParams(req);
  const term = (params.get("term") || "candle holder wreath").trim().slice(0, 80);
  const geo = (params.get("geo") || "US").trim().toUpperCase().slice(0, 2);
  const view = params.get("view") === "1" ? 1 : 5;

  if (!HAS_TREENDLY_CREDENTIALS) {
    sendJson(res, 200, makeUnavailableTrendResponse(term, geo, view));
    return;
  }

  try {
    const live = await callTreendly(term, geo, view);
    sendJson(res, 200, live);
  } catch (error) {
    const unavailable = makeUnavailableTrendResponse(term, geo, view, `Treendly 实时请求失败：${error.message}。当前不展示趋势曲线，只显示可实时抓取的平台推荐词。`);
    sendJson(res, 200, unavailable);
  }
}

async function handleCompare(req, res) {
  const params = getSearchParams(req);
  const geo = (params.get("geo") || "US").trim().toUpperCase().slice(0, 2);
  const view = params.get("view") === "1" ? 1 : 5;
  const terms = (params.get("terms") || "candle holder wreath,christmas wreath,mahjong set")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 5);

  const results = await Promise.all(terms.map(async (term) => {
    if (!HAS_TREENDLY_CREDENTIALS) return makeUnavailableTrendResponse(term, geo, view);
    try {
      return await callTreendly(term, geo, view);
    } catch (error) {
      return makeUnavailableTrendResponse(term, geo, view, `关键词 "${term}" 的 Treendly 实时请求失败：${error.message}`);
    }
  }));

  sendJson(res, 200, {
    mode: HAS_TREENDLY_CREDENTIALS && results.every((item) => item.mode === "live") ? "live" : "unconfigured",
    geo,
    view,
    results
  });
}

async function handleSourceCheck(req, res) {
  const params = getSearchParams(req);
  const term = (params.get("term") || "candle holder wreath").trim().slice(0, 80);
  const geo = (params.get("geo") || "US").trim().toUpperCase().slice(0, 2);
  const tiktokCreativeLink = "https://ads.tiktok.com/creative/creativeCenter/trends/hashtag/13873640?region=US&period=90";

  const [
    googleSuggest,
    googleShoppingSuggest,
    googleImagesSuggest,
    googleNewsSuggest,
    bingSuggest,
    duckDuckGoSuggest,
    amazonSuggest,
    ebaySuggest,
    etsySource,
    tiktokSuggest,
    youtubeSuggest,
    googleTrends,
    redditSearch
  ] = await Promise.all([
    settleSource("Google 输入框推荐词", () => getGoogleSuggest(term, geo)),
    settleSource("Google Shopping 推荐词", () => getGoogleShoppingSuggest(term, geo)),
    settleSource("Google Images 推荐词", () => getGoogleImagesSuggest(term, geo)),
    settleSource("Google News 推荐词", () => getGoogleNewsSuggest(term, geo)),
    settleSource("Bing 搜索推荐词", () => getBingSuggest(term)),
    settleSource("DuckDuckGo 推荐词", () => getDuckDuckGoSuggest(term)),
    settleSource("Amazon 美国站推荐词", () => getAmazonSuggest(term)),
    settleSource("eBay 购物推荐词", () => getEbaySuggest(term)),
    HAS_ETSY_CREDENTIALS
      ? settleSource("Etsy Open API", () => getEtsyListings(term))
      : Promise.resolve(sourceResult("Etsy Marketplace", "link-only", {
        link: makeEtsyLink(term),
        note: "用于验证手作/礼品/装饰类电商供给和风格；配置 ETSY_API_KEY 后可自动读取 Etsy Open API 公开 listing。"
      })),
    settleSource("TikTok 搜索框推荐词", () => getTikTokSuggest(term)),
    settleSource("YouTube 推荐词", () => getYouTubeSuggest(term, geo)),
    settleSource("Google Trends 曲线", () => getGoogleTrends(term, geo)),
    settleSource("Reddit Search", () => getRedditSearch(term))
  ]);

  sendJson(res, 200, {
    term,
    geo,
    generatedAt: new Date().toISOString(),
    googleTrendsGuard: googleTrendsGuardStatus(),
    platformGuards: platformGuardsStatus(),
    sources: [
      googleSuggest,
      googleShoppingSuggest,
      googleImagesSuggest.status === "blocked"
        ? { ...googleImagesSuggest, link: makeGoogleImagesLink(term), note: `${googleImagesSuggest.note}。已保留 Google Images 页面供视觉复核。` }
        : googleImagesSuggest,
      googleNewsSuggest.status === "blocked"
        ? { ...googleNewsSuggest, link: makeGoogleNewsLink(term, geo), note: `${googleNewsSuggest.note}。已保留 Google News 页面供内容复核。` }
        : googleNewsSuggest,
      bingSuggest,
      duckDuckGoSuggest,
      googleTrends.status === "blocked"
        ? { ...googleTrends, link: makeGoogleTrendsLink(term, geo), note: `${googleTrends.note}。已保留官方 Trends 链接供手动验证。` }
        : googleTrends,
      amazonSuggest,
      ebaySuggest,
      tiktokSuggest,
      youtubeSuggest,
      sourceResult("TikTok Creative Center", "link-only", {
        link: tiktokCreativeLink,
        note: "用户提供的 Creative Center 页面可打开验证；详情接口当前返回 no permission，不能稳定抓取数据。"
      }),
      sourceResult("Pinterest Trends", "link-only", {
        link: makePinterestLink(term, geo),
        note: "Pinterest Trends 页面可按 US 打开验证；未发现稳定公开 JSON API。"
      }),
      etsySource.status === "blocked"
        ? { ...etsySource, link: makeEtsyLink(term), note: `${etsySource.note}。已保留 Etsy 搜索页供人工复核。` }
        : etsySource,
      sourceResult("Walmart Search", "link-only", {
        link: makeWalmartLink(term),
        note: "用于验证美国大卖场搜索结果和价格带；无稳定公开推荐词接口，不参与自动评分。"
      }),
      sourceResult("Target Search", "link-only", {
        link: makeTargetLink(term),
        note: "用于验证美国零售渠道搜索结果和场景图方向；不参与自动评分。"
      }),
      sourceResult("Amazon Best Sellers", "link-only", {
        link: makeAmazonBestSellersLink(term),
        note: "Manual review only: Amazon Best Sellers validates shelf demand; it is not counted in automatic scoring."
      }),
      sourceResult("Amazon Movers & Shakers", "link-only", {
        link: makeAmazonMoversLink(term),
        note: "Manual review only: short-term Amazon movers; not counted in automatic scoring."
      }),
      sourceResult("Amazon New Releases", "link-only", {
        link: makeAmazonNewReleasesLink(term),
        note: "Manual review only: new product directions; not counted in automatic scoring."
      }),
      sourceResult("Amazon Most Wished For", "link-only", {
        link: makeAmazonMostWishedLink(term),
        note: "Manual review only: gift and interest demand; not counted in automatic scoring."
      }),
      sourceResult("Home Depot", "link-only", {
        link: makeHomeDepotLink(term),
        note: "Manual review only: home improvement shelf validation; not counted in automatic scoring."
      }),
      sourceResult("Lowe's", "link-only", {
        link: makeLowesLink(term),
        note: "Manual review only: home improvement shelf validation; not counted in automatic scoring."
      }),
      sourceResult("Wayfair", "link-only", {
        link: makeWayfairLink(term),
        note: "Manual review only: home and furniture shelf validation; not counted in automatic scoring."
      }),
      sourceResult("AliExpress", "link-only", {
        link: makeAliExpressLink(term),
        note: "Manual review only: sourcing and style reference; not counted in automatic scoring."
      }),
      sourceResult("Temu", "link-only", {
        link: makeTemuLink(term),
        note: "Manual review only: low-price shelf and price-band reference; not counted in automatic scoring."
      }),
      sourceResult("SHEIN", "link-only", {
        link: makeSheinLink(term),
        note: "Manual review only: fashion/home style reference; not counted in automatic scoring."
      }),
      sourceResult("Meta Ads Library", "link-only", {
        link: makeMetaAdsLibraryLink(term),
        note: "Manual review only: ad demand and creative angle validation; not counted in automatic scoring."
      }),
      sourceResult("Kickstarter", "link-only", {
        link: makeKickstarterLink(term),
        note: "Manual review only: new-product and crowdfunding validation; not counted in automatic scoring."
      }),
      sourceResult("Product Hunt", "link-only", {
        link: makeProductHuntLink(term),
        note: "Manual review only: new product/topic validation; not counted in automatic scoring."
      }),
      sourceResult("Quora", "link-only", {
        link: makeQuoraLink(term),
        note: "Manual review only: question and pain-point language; not counted in automatic scoring."
      }),
      sourceResult("TrendHunter", "link-only", {
        link: makeTrendHunterLink(term),
        note: "Manual review only: trend case reference; not counted in automatic scoring."
      }),
      sourceResult("Exploding Topics", "link-only", {
        link: makeExplodingTopicsLink(term),
        note: "Manual review only: rising topic reference; not counted in automatic scoring."
      }),
      sourceResult("Instagram Hashtag", "link-only", {
        link: makeInstagramTagLink(term),
        note: "用于验证社媒图片内容和标签语境；受登录/地区影响，不参与自动评分。"
      }),
      sourceResult("Facebook Search", "link-only", {
        link: makeFacebookSearchLink(term),
        note: "用于验证 Facebook 公开帖子、社群讨论和本地需求；受登录、地区和权限影响，不参与自动评分。"
      }),
      sourceResult("Facebook Marketplace", "link-only", {
        link: makeFacebookMarketplaceLink(term),
        note: "用于验证 Facebook Marketplace 的本地购物和二手交易需求；需要登录后人工复核，不参与自动评分。"
      }),
      sourceResult("X Search", "link-only", {
        link: makeXSearchLink(term),
        note: "用于验证 X/Twitter 的实时话题、吐槽和趋势语境；受登录和地区影响，不参与自动评分。"
      }),
      sourceResult("Threads Search", "link-only", {
        link: makeThreadsSearchLink(term),
        note: "用于验证 Threads 的社媒讨论语境；当前只作为人工复核入口。"
      }),
      redditSearch.status === "blocked"
        ? { ...redditSearch, link: makeRedditLink(term), note: `${redditSearch.note}。已保留 Reddit 搜索页供登录验证。` }
        : redditSearch,
      sourceResult("SEO.com Soovle", "link-only", {
        link: "https://www.seo.com/soovle/",
        note: "Soovle 是多平台推荐词工具页面；未发现稳定公开 API，建议作为人工复核入口。"
      })
    ]
  });
}

async function handleHotKeywords(req, res) {
  const params = getSearchParams(req);
  const term = (params.get("term") || "").trim().slice(0, 80);
  const geo = (params.get("geo") || "US").trim().toUpperCase().slice(0, 2);

  if (!term) {
    sendJson(res, 200, {
      term: "",
      normalizedTerm: "",
      geo,
      generatedAt: new Date().toISOString(),
      querySeeds: [],
      sources: [],
      candidates: [],
      strictCrossVerified: false,
      note: "等待输入关键词。"
    });
    return;
  }

  const cacheKey = `hot:${geo}:${term.toLowerCase()}`;
  const cached = HOT_KEYWORD_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < HOT_KEYWORD_CACHE_TTL_MS) {
    sendJson(res, 200, { ...cached.data, cached: true });
    return;
  }

  const data = await collectHotKeywords(term, geo);
  HOT_KEYWORD_CACHE.set(cacheKey, { cachedAt: Date.now(), data });
  sendJson(res, 200, data);
}

async function handleSocialRadar(req, res) {
  const params = getSearchParams(req);
  const term = (params.get("term") || "").trim().slice(0, 80);
  const geo = (params.get("geo") || "US").trim().toUpperCase().slice(0, 2);

  if (!term) {
    sendJson(res, 200, {
      term: "",
      normalizedTerm: "",
      geo,
      generatedAt: new Date().toISOString(),
      querySeeds: [],
      sources: [],
      platforms: [],
      currentHot: [],
      discussionSignals: [],
      futureEvents: [],
      lastYearReview: {
        trend: { status: "unavailable", note: "等待输入关键词。" },
        risingCandidates: [],
        note: "等待输入关键词。"
      },
      note: "等待输入关键词。"
    });
    return;
  }

  const cacheKey = `social:${geo}:${term.toLowerCase()}`;
  const cached = SOCIAL_RADAR_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SOCIAL_RADAR_CACHE_TTL_MS) {
    sendJson(res, 200, { ...cached.data, cached: true });
    return;
  }

  const data = await collectSocialRadar(term, geo);
  SOCIAL_RADAR_CACHE.set(cacheKey, { cachedAt: Date.now(), data });
  sendJson(res, 200, data);
}

async function handleSeasonalKeywords(req, res) {
  const params = getSearchParams(req);
  const geo = (params.get("geo") || "US").trim().toUpperCase().slice(0, 2);
  const term = normalizeSeedTerm(params.get("term") || "");
  const refresh = params.get("refresh") === "1";
  const cacheKey = `seasonal:${geo}:${term.toLowerCase()}`;
  const cached = SEASONAL_CACHE.get(cacheKey);
  const now = Date.now();

  if (!refresh && cached && now - cached.cachedAt < SEASONAL_CACHE_TTL_MS) {
    sendJson(res, 200, {
      ...cached.data,
      cache: {
        status: "hit",
        cachedAt: new Date(cached.cachedAt).toISOString()
      }
    });
    return;
  }

  const data = await buildSeasonalKeywords(geo, term);
  SEASONAL_CACHE.set(cacheKey, { cachedAt: now, data });
  sendJson(res, 200, {
    ...data,
    cache: {
      status: "fresh",
      cachedAt: new Date(now).toISOString()
    }
  });
}

function handleConfig(res) {
  sendJson(res, 200, {
    treendlyConfigured: HAS_TREENDLY_CREDENTIALS,
    etsyConfigured: HAS_ETSY_CREDENTIALS,
    googleTrendsGuard: googleTrendsGuardStatus(),
    platformGuards: platformGuardsStatus(),
    baseUrl: TREENDLY_BASE,
    endpoint: "POST /quick-get",
    credentials: HAS_TREENDLY_CREDENTIALS ? "已在服务端配置" : "缺少 TREENDLY_UID 和 TREENDLY_PASSWORD",
    docs: "https://treendly.com/docs",
    rateLimit: "每分钟 60 次请求"
  });
}

function handleLocalCloudStatus(res) {
  sendJson(res, 200, {
    ok: true,
    mode: "local",
    d1Connected: false,
    scheduledCollection: false,
    database: {
      seeds: 0,
      snapshots: 0,
      evidence: 0
    },
    latestRun: null,
    message: "当前是本地模式。部署 Cloudflare Worker 并绑定 D1 后，这里会显示云端历史库和定时采集状态。",
    truthRules: [
      "推荐词不等于搜索量或销量。",
      "本地实时采集只用于当前页面判断，不会长期保存历史。",
      "云端 D1 接入后才会保存每周/每日证据链。"
    ]
  });
}

function handleLocalCloudHistory(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const term = requestUrl.searchParams.get("term") || "";
  const geo = requestUrl.searchParams.get("geo") || "US";
  sendJson(res, 200, {
    ok: true,
    mode: "local",
    d1Connected: false,
    term,
    geo,
    snapshots: [],
    evidence: [],
    manualVerification: [],
    message: "本地模式没有 D1 历史记录。部署 Cloudflare 后会自动读取云端历史证据链。"
  });
}

function handleLocalCloudReport(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const term = requestUrl.searchParams.get("term") || "";
  const geo = requestUrl.searchParams.get("geo") || "US";
  sendJson(res, 200, {
    ok: true,
    mode: "local",
    d1Connected: false,
    term,
    geo,
    summary: {
      opportunityCount: 0,
      strongCount: 0,
      observationCount: 0
    },
    opportunities: [],
    markdown: "本地模式尚未连接云端 D1。部署 Cloudflare Worker 后会生成基于历史证据链的中文选品报告。"
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/radar-api/")) {
      req.url = req.url.replace(/^\/radar-api/, "/api");
    }

    if (req.url.startsWith("/api/health")) {
      sendJson(res, 200, { ok: true, time: new Date().toISOString() });
      return;
    }

    if (req.url.startsWith("/api/config")) {
      handleConfig(res);
      return;
    }

    if (req.url.startsWith("/api/cloud/status")) {
      handleLocalCloudStatus(res);
      return;
    }

    if (req.url.startsWith("/api/history")) {
      handleLocalCloudHistory(req, res);
      return;
    }

    if (req.url.startsWith("/api/report")) {
      handleLocalCloudReport(req, res);
      return;
    }

    if (req.url.startsWith("/api/quick-get")) {
      await handleQuickGet(req, res);
      return;
    }

    if (req.url.startsWith("/api/compare")) {
      await handleCompare(req, res);
      return;
    }

    if (req.url.startsWith("/api/source-check")) {
      await handleSourceCheck(req, res);
      return;
    }

    if (req.url.startsWith("/api/hot-keywords")) {
      await handleHotKeywords(req, res);
      return;
    }

    if (req.url.startsWith("/api/social-radar")) {
      await handleSocialRadar(req, res);
      return;
    }

    if (req.url.startsWith("/api/open-external")) {
      handleOpenExternal(req, res);
      return;
    }

    if (req.url.startsWith("/api/seasonal-keywords")) {
      await handleSeasonalKeywords(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

function start(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && port < PORT + 20) {
      start(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, HOST, () => {
    const address = server.address();
    console.log(`趋势雷达已启动：http://127.0.0.1:${address.port}`);
  });
}

start(PORT);
