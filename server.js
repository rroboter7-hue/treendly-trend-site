const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL, URLSearchParams } = require("url");

const PORT = Number(process.env.PORT || 4177);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const TREENDLY_BASE = (process.env.TREENDLY_API_BASE || "https://treendly.com/api").replace(/\/+$/, "");
const TREENDLY_UID = process.env.TREENDLY_UID || "";
const TREENDLY_PASSWORD = process.env.TREENDLY_PASSWORD || "";
const HAS_TREENDLY_CREDENTIALS = Boolean(TREENDLY_UID && TREENDLY_PASSWORD);
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9"
};

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

function makeDemoSeries(term, view) {
  const months = Number(view) === 1 ? 12 : 60;
  const rand = seededRandom(seedFromTerm(term));
  const now = new Date();
  now.setUTCDate(1);

  const base = 24 + Math.round(rand() * 24);
  const slope = 22 + Math.round(rand() * 26);
  const season = 8 + Math.round(rand() * 10);
  const phase = rand() * Math.PI * 2;

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + index + 1, 1));
    const progress = index / Math.max(1, months - 1);
    const noise = Math.round((rand() - 0.5) * 12);
    const seasonalWave = Math.sin(index / 3 + phase) * season;
    const holidayBump = date.getUTCMonth() >= 8 ? 10 + Math.round(rand() * 12) : 0;
    const value = Math.max(4, Math.min(100, Math.round(base + slope * progress + seasonalWave + holidayBump + noise)));
    return { date: formatDate(date), value };
  });
}

function makeRelatedTerms(term) {
  const clean = String(term || "trend").trim().toLowerCase();
  const base = clean || "trend";
  return {
    googleRising: [
      `${base} ideas`,
      `${base} 2026`,
      `${base} aesthetic`,
      `${base} diy`
    ],
    googleTop: [
      `${base} near me`,
      `${base} amazon`,
      `${base} decor`,
      `${base} set`
    ],
    amazon: [
      `${base} 4 pack`,
      `${base} with led lights`,
      `${base} centerpiece`,
      `${base} bulk`
    ],
    youtube: [
      `how to use ${base}`,
      `${base} review`,
      `${base} tutorial`,
      `${base} unboxing`
    ]
  };
}

function makeGoogleTrendsLink(term, geo) {
  return `https://trends.google.com/explore?q=${encodeURIComponent(term)}&date=today%205-y&geo=${encodeURIComponent(geo || "US")}`;
}

function makePinterestLink(term, geo = "US") {
  return `https://trends.pinterest.com/search/?country=${encodeURIComponent(geo || "US")}&q=${encodeURIComponent(term)}&trendsPreset=2`;
}

function makeGoogleSearchLink(term) {
  return `https://www.google.com/search?q=${encodeURIComponent(term)}`;
}

function makeGoogleShoppingLink(term) {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term)}`;
}

function makeAmazonLink(term) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(term)}`;
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

function makeKeywordActionLink(sourceName, term, geo) {
  if (sourceName.includes("Amazon")) return makeAmazonLink(term);
  if (sourceName.includes("eBay")) return makeEbayLink(term);
  if (sourceName.includes("TikTok")) return makeTikTokLink(term);
  if (sourceName.includes("YouTube")) return makeYouTubeLink(term);
  if (sourceName.includes("Shopping")) return makeGoogleShoppingLink(term);
  if (sourceName.includes("Bing")) return `https://www.bing.com/search?q=${encodeURIComponent(term)}&cc=${encodeURIComponent(geo || "US")}`;
  if (sourceName.includes("DuckDuckGo")) return `https://duckduckgo.com/?q=${encodeURIComponent(term)}&kl=us-en`;
  return makeGoogleSearchLink(term);
}

async function fetchExternalJson(url, options = {}) {
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
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    }
    return JSON.parse(text.replace(/^\)\]\}',?\n?/, ""));
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExternalText(url, options = {}) {
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
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    }
    return text;
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

  return sourceResult("Google Trends 曲线", "live", {
    items: points.map((point) => `${point.date}: ${point.value}`).slice(-8),
    link: makeGoogleTrendsLink(term, geo),
    note: "来自 Google Trends 网页接口，非官方 API，可能被 429 限流。",
    meta: {
      pointCount: points.length,
      latest: points.at(-1) || null
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
    { label: "TikTok", url: makeTikTokLink(keyword), type: "social", scored: false },
    { label: "YouTube", url: makeYouTubeLink(keyword), type: "social", scored: false },
    { label: "Pinterest", url: makePinterestLink(keyword, geo), type: "visual", scored: false },
    { label: "Instagram", url: makeInstagramTagLink(keyword), type: "social", scored: false },
    { label: "Etsy", url: makeEtsyLink(keyword), type: "marketplace", scored: false }
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

  const highPotential = categories
    .flatMap((category) => category.subcategories.flatMap((subcategory) => subcategory.items.map((item) => ({
      ...item,
      category: category.label,
      subcategory: subcategory.label,
      event: subcategory.event,
      season: subcategory.season
    }))))
    .sort((a, b) => b.heat - a.heat || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword))
    .slice(0, 24);

  return {
    geo,
    term: seedTerm,
    mode: seedTerm ? "keyword-context" : "holiday-default",
    generatedAt: new Date().toISOString(),
    sources: SEASONAL_SOURCE_COLLECTORS.map((source) => source.name),
    verificationOnlySources: ["Google Trends", "Pinterest", "Instagram", "Etsy"],
    note: seedTerm
      ? `热度为真实来源热度指数：当前围绕 ${seedTerm} 生成细分词；只按实时 autocomplete 返回词、排名、平台覆盖数和来源权重计算；验证入口不参与评分，不等同于官方搜索量。`
      : "热度为真实来源热度指数：只按实时 autocomplete 返回词、排名、平台覆盖数和来源权重计算；验证入口不参与评分，不等同于官方搜索量。",
    reliability: {
      scoringRule: "只统计 status=live 且实时返回 items 的来源。",
      scoringSources: SEASONAL_SOURCE_COLLECTORS.map((source) => source.name),
      verificationOnlySources: ["Google Trends", "Pinterest", "Instagram", "Etsy"],
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

function makeDemoResponse(term, geo, view, reason) {
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
    sendJson(res, 200, makeDemoResponse(term, geo, view));
    return;
  }

  try {
    const live = await callTreendly(term, geo, view);
    sendJson(res, 200, live);
  } catch (error) {
    const demo = makeDemoResponse(term, geo, view, `Treendly 实时请求失败：${error.message}。当前不展示趋势曲线，只显示可实时抓取的平台推荐词。`);
    sendJson(res, 200, demo);
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
    if (!HAS_TREENDLY_CREDENTIALS) return makeDemoResponse(term, geo, view);
    try {
      return await callTreendly(term, geo, view);
    } catch (error) {
      return makeDemoResponse(term, geo, view, `关键词 "${term}" 的 Treendly 实时请求失败：${error.message}`);
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
    bingSuggest,
    duckDuckGoSuggest,
    amazonSuggest,
    ebaySuggest,
    tiktokSuggest,
    youtubeSuggest,
    googleTrends
  ] = await Promise.all([
    settleSource("Google 输入框推荐词", () => getGoogleSuggest(term, geo)),
    settleSource("Google Shopping 推荐词", () => getGoogleShoppingSuggest(term, geo)),
    settleSource("Bing 搜索推荐词", () => getBingSuggest(term)),
    settleSource("DuckDuckGo 推荐词", () => getDuckDuckGoSuggest(term)),
    settleSource("Amazon 美国站推荐词", () => getAmazonSuggest(term)),
    settleSource("eBay 购物推荐词", () => getEbaySuggest(term)),
    settleSource("TikTok 搜索框推荐词", () => getTikTokSuggest(term)),
    settleSource("YouTube 推荐词", () => getYouTubeSuggest(term, geo)),
    settleSource("Google Trends 曲线", () => getGoogleTrends(term, geo))
  ]);

  sendJson(res, 200, {
    term,
    geo,
    generatedAt: new Date().toISOString(),
    sources: [
      googleSuggest,
      googleShoppingSuggest,
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
      sourceResult("SEO.com Soovle", "link-only", {
        link: "https://www.seo.com/soovle/",
        note: "Soovle 是多平台推荐词工具页面；未发现稳定公开 API，建议作为人工复核入口。"
      })
    ]
  });
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
    baseUrl: TREENDLY_BASE,
    endpoint: "POST /quick-get",
    credentials: HAS_TREENDLY_CREDENTIALS ? "已在服务端配置" : "缺少 TREENDLY_UID 和 TREENDLY_PASSWORD",
    docs: "https://treendly.com/docs",
    rateLimit: "每分钟 60 次请求"
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/health")) {
      sendJson(res, 200, { ok: true, time: new Date().toISOString() });
      return;
    }

    if (req.url.startsWith("/api/config")) {
      handleConfig(res);
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
