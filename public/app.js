const state = {
  current: null,
  config: null,
  sourceCheck: null,
  holidayRequestId: 0
};

const termInput = document.querySelector("#termInput");
const geoInput = document.querySelector("#geoInput");
const viewInput = document.querySelector("#viewInput");
const searchBtn = document.querySelector("#searchBtn");
const compareInput = document.querySelector("#compareInput");
const compareBtn = document.querySelector("#compareBtn");
const rawToggle = document.querySelector("#rawToggle");
const rawJson = document.querySelector("#rawJson");

const averageMetric = document.querySelector("#averageMetric");
const averageLabel = document.querySelector("#averageLabel");
const averageNote = document.querySelector("#averageNote");
const growthMetric = document.querySelector("#growthMetric");
const growthLabel = document.querySelector("#growthLabel");
const growthNote = document.querySelector("#growthNote");
const paceMetric = document.querySelector("#paceMetric");
const paceLabel = document.querySelector("#paceLabel");
const paceNote = document.querySelector("#paceNote");
const searchMetric = document.querySelector("#searchMetric");
const searchLabel = document.querySelector("#searchLabel");
const searchNote = document.querySelector("#searchNote");
const chartTitle = document.querySelector("#chartTitle");
const chartSubtitle = document.querySelector("#chartSubtitle");
const trendChart = document.querySelector("#trendChart");
const modeBadge = document.querySelector("#modeBadge");
const apiStatus = document.querySelector("#apiStatus");
const sourceLinks = document.querySelector("#sourceLinks");
const sourceDataGrid = document.querySelector("#sourceDataGrid");
const platformHeatGrid = document.querySelector("#platformHeatGrid");
const seasonPanel = document.querySelector(".season-panel");
const trendGrid = document.querySelector(".main-grid");
const seasonalityGrid = document.querySelector("#seasonalityGrid");
const seasonalitySummary = document.querySelector("#seasonalitySummary");
const holidayKeywordGrid = document.querySelector("#holidayKeywordGrid");
const relatedRows = document.querySelector("#relatedRows");
const compareList = document.querySelector("#compareList");
const themeExpansionGrid = document.querySelector("#themeExpansionGrid");

function compactNumber(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(number);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`请求失败：${response.status}`);
  return response.json();
}

function setLoading(isLoading) {
  document.body.classList.toggle("loading", isLoading);
  searchBtn.disabled = isLoading;
  compareBtn.disabled = isLoading;
}

function renderApiStatus() {
  const configured = state.config?.treendlyConfigured;
  apiStatus.classList.toggle("live", configured);
  apiStatus.classList.toggle("demo", !configured);
  apiStatus.querySelector("span:last-child").textContent = configured
    ? "Treendly 账号已配置"
    : "Treendly 未接入：仅显示真实平台推荐词";
}

function localizePace(value) {
  const map = {
    Growing: "上升",
    Rapid: "快速",
    Steady: "稳定",
    Moderate: "中等",
    Declining: "下降",
    Cooling: "降温",
    Check: "待确认",
    High: "高",
    Medium: "中",
    Low: "低"
  };
  return map[value] || value || "--";
}

function setTrendMetricLabels() {
  averageLabel.textContent = "平均热度";
  growthLabel.textContent = "增长幅度";
  paceLabel.textContent = "趋势节奏";
  searchLabel.textContent = "搜索需求";
}

function setPlatformMetricLabels() {
  averageLabel.textContent = "跨平台热度";
  growthLabel.textContent = "平台覆盖";
  paceLabel.textContent = "强势平台";
  searchLabel.textContent = "验证状态";
}

function setTrendSectionsVisible(isVisible) {
  if (seasonPanel) seasonPanel.hidden = !isVisible;
  if (trendGrid) trendGrid.hidden = !isVisible;
}

function renderMetrics(data) {
  if (data.mode !== "live") {
    setPlatformMetricLabels();
    averageMetric.textContent = "--";
    averageNote.textContent = "等待实时平台推荐词";
    growthMetric.textContent = "--";
    growthNote.textContent = "等待平台覆盖结果";
    paceMetric.textContent = "待接入";
    paceNote.textContent = "等待强势平台";
    searchMetric.textContent = "待确认";
    searchNote.textContent = "Google Trends / Pinterest 等入口";
    return;
  }

  setTrendMetricLabels();
  const summary = data.summary || {};
  averageMetric.textContent = Math.round(summary.average || 0);
  averageNote.textContent = `峰值 ${Math.round(summary.peak || 0)} / 100`;

  const growth = Math.round(summary.growth || 0);
  growthMetric.textContent = `${growth > 0 ? "+" : ""}${growth}%`;
  growthNote.textContent = data.view === 1 ? "近 12 个月" : "近 5 年";

  paceMetric.textContent = localizePace(summary.pace);
  paceNote.textContent = localizePace(summary.paceType) || "Treendly 分类";

  searchMetric.textContent = summary.monthlySearches ? compactNumber(summary.monthlySearches) : "待确认";
  searchNote.textContent = summary.monthlySearches ? "月均搜索量" : "接口未返回";
}

function renderChart(data) {
  const series = data.series || [];
  const width = 760;
  const height = 320;
  const pad = { top: 26, right: 26, bottom: 38, left: 44 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  if (!series.length) {
    trendChart.innerHTML = `
      <text x="50%" y="45%" text-anchor="middle" class="axis-label">暂无真实趋势曲线</text>
      <text x="50%" y="55%" text-anchor="middle" class="axis-label">请查看下方不同平台实时推荐热度</text>
    `;
    return;
  }

  const values = series.map((point) => Number(point.value) || 0);
  const max = Math.max(100, ...values);
  const min = 0;
  const points = series.map((point, index) => {
    const x = pad.left + (index / Math.max(1, series.length - 1)) * plotWidth;
    const y = pad.top + (1 - ((Number(point.value) || 0) - min) / (max - min)) * plotHeight;
    return { x, y, date: point.date, value: Number(point.value) || 0 };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${points.at(-1).x.toFixed(2)} ${height - pad.bottom} L ${points[0].x.toFixed(2)} ${height - pad.bottom} Z`;
  const grid = [0, 25, 50, 75, 100].map((tick) => {
    const y = pad.top + (1 - tick / 100) * plotHeight;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#e8eef4" />
      <text x="${pad.left - 12}" y="${y + 4}" text-anchor="end" class="axis-label">${tick}</text>
    `;
  }).join("");

  const firstDate = series[0]?.date?.slice(0, 7) || "";
  const midDate = series[Math.floor(series.length / 2)]?.date?.slice(0, 7) || "";
  const lastDate = series.at(-1)?.date?.slice(0, 7) || "";
  const lastPoint = points.at(-1);

  trendChart.innerHTML = `
    <defs>
      <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f8a8a" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#0f8a8a" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    ${grid}
    <path d="${areaPath}" fill="url(#areaFill)" />
    <path d="${linePath}" fill="none" stroke="#0f8a8a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="6" fill="#ffffff" stroke="#e15b4f" stroke-width="4" />
    <text x="${pad.left}" y="${height - 12}" class="axis-label">${firstDate}</text>
    <text x="${width / 2}" y="${height - 12}" text-anchor="middle" class="axis-label">${midDate}</text>
    <text x="${width - pad.right}" y="${height - 12}" text-anchor="end" class="axis-label">${lastDate}</text>
  `;
}

function sourceUrl(label, term, geo) {
  const q = encodeURIComponent(term || "candle holder wreath");
  const country = encodeURIComponent(geo || "US");
  const urls = {
    "Google Trends": `https://trends.google.com/explore?q=${q}&date=today%205-y&geo=${country}`,
    "Google Search": `https://www.google.com/search?q=${q}`,
    "Google Shopping": `https://www.google.com/search?tbm=shop&q=${q}`,
    "Pinterest Trends": `https://trends.pinterest.com/search/?country=${country}&q=${q}&trendsPreset=2`,
    "TikTok": `https://www.tiktok.com/search?q=${q}`,
    "TikTok Creative Center": `https://ads.tiktok.com/creative/creativeCenter/trends/hashtag/13873640?region=${country}&period=90`,
    "Amazon": `https://www.amazon.com/s?k=${q}`,
    "YouTube": `https://www.youtube.com/results?search_query=${q}`,
    "Bing": `https://www.bing.com/search?q=${q}&cc=${country}`,
    "eBay": `https://www.ebay.com/sch/i.html?_nkw=${q}`,
    "Soovle": "https://www.seo.com/soovle/"
  };
  return urls[label] || `https://www.google.com/search?q=${q}`;
}

function sourceStatusMeta(status) {
  const map = {
    live: { label: "可自动抓取", tone: "live" },
    "link-only": { label: "仅人工验证", tone: "manual" },
    blocked: { label: "当前被限制", tone: "blocked" },
    pending: { label: "等待检测", tone: "pending" }
  };
  return map[status] || map.pending;
}

function sourceForChannel(label) {
  const matchers = {
    "Google Trends": /Google Trends/i,
    "Pinterest Trends": /Pinterest Trends/i,
    "TikTok": /TikTok 搜索框/i,
    "TikTok Creative Center": /TikTok Creative Center/i,
    "Amazon": /Amazon/i,
    "Google Shopping": /Google Shopping/i,
    "YouTube": /YouTube/i,
    "Google Search": /Google 输入框/i,
    "Bing": /Bing/i,
    "eBay": /eBay/i,
    "Soovle": /Soovle/i
  };
  const matcher = matchers[label];
  if (!matcher) return null;
  return (state.sourceCheck?.sources || []).find((source) => matcher.test(source.source));
}

function renderSources(data) {
  const channels = [
    ["Google Trends", "搜索趋势曲线", "primary"],
    ["Pinterest Trends", "图片/家居趋势"],
    ["TikTok", "短视频搜索验证"],
    ["TikTok Creative Center", "TikTok 热门趋势"],
    ["Amazon", "美国站搜索结果"],
    ["Google Shopping", "购物搜索结果"],
    ["YouTube", "教程与测评需求"],
    ["Google Search", "自然搜索验证"],
    ["Bing", "搜索补充验证"],
    ["eBay", "二级市场/复古词"],
    ["Soovle", "多平台联想工具"]
  ];

  sourceLinks.innerHTML = channels.map(([label, description, variant]) => {
    const source = sourceForChannel(label);
    const status = sourceStatusMeta(source?.status || "pending");
    return `
    <a class="source-link ${variant === "primary" ? "primary" : ""} status-${status.tone}" href="${sourceUrl(label, data.term, data.geo)}" target="_blank" rel="noreferrer">
      <span>${label}<small>${description}</small></span>
      <em class="source-link-status ${status.tone}">${status.label}</em>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
    </a>
  `;
  }).join("");
}

function seasonOfMonth(monthIndex) {
  if ([2, 3, 4].includes(monthIndex)) return "spring";
  if ([5, 6, 7].includes(monthIndex)) return "summer";
  if ([8, 9, 10].includes(monthIndex)) return "fall";
  return "winter";
}

function seasonMeta(key) {
  const map = {
    spring: { label: "春季", range: "3-5月" },
    summer: { label: "夏季", range: "6-8月" },
    fall: { label: "秋季", range: "9-11月" },
    winter: { label: "冬季", range: "12-2月" }
  };
  return map[key];
}

function renderSeasonality(data) {
  const recent = (data.series || []).slice(-12).map((point) => {
    const date = new Date(`${point.date}T00:00:00Z`);
    return {
      date,
      label: point.date.slice(0, 7),
      value: Number(point.value) || 0,
      season: seasonOfMonth(date.getUTCMonth())
    };
  });

  if (!recent.length) {
    seasonalityGrid.innerHTML = `<div class="source-data-empty">没有足够的近一年趋势数据</div>`;
    seasonalitySummary.textContent = "没有足够的近一年趋势数据，无法判断季节性。";
    return;
  }

  const keys = ["spring", "summer", "fall", "winter"];
  const rows = keys.map((key) => {
    const points = recent.filter((point) => point.season === key);
    const values = points.map((point) => point.value);
    const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const peak = values.length ? Math.max(...values) : 0;
    return {
      ...seasonMeta(key),
      key,
      average,
      peak,
      months: points.map((point) => `${point.label}(${point.value})`)
    };
  });

  const maxAverage = Math.max(...rows.map((row) => row.average), 1);
  const strongest = rows.reduce((best, row) => row.average > best.average ? row : best, rows[0]);
  const weakest = rows.reduce((best, row) => row.average < best.average ? row : best, rows[0]);
  const gap = strongest.average - weakest.average;
  const signal = gap >= 25 ? "季节性明显" : gap >= 12 ? "季节性中等" : "季节性偏弱";
  const sourceText = data.mode === "live" ? "真实 Treendly 数据" : "未接入真实趋势源";

  seasonalitySummary.textContent = `${sourceText} / ${signal}：${strongest.label}平均热度最高，${weakest.label}最低。`;
  seasonalityGrid.innerHTML = rows.map((row) => {
    const width = Math.max(6, Math.round((row.average / maxAverage) * 100));
    return `
      <article class="season-card">
        <div class="season-head">
          <strong>${row.label}</strong>
          <span>${row.range}</span>
        </div>
        <div class="season-value">${row.average}<small>均值</small></div>
        <div class="season-bar" aria-label="${row.label}平均热度 ${row.average}">
          <span style="width:${width}%"></span>
        </div>
        <div class="season-detail">
          <span>峰值 ${row.peak}</span>
          <span>${row.months.join(" / ") || "无数据"}</span>
        </div>
      </article>
    `;
  }).join("");
}

function termActionUrl(keyword, geo) {
  return `https://trends.google.com/explore?q=${encodeURIComponent(keyword)}&date=today%205-y&geo=${encodeURIComponent(geo)}`;
}

function recommendationActionUrl(sourceName, keyword, geo) {
  if (sourceName.includes("Amazon")) return `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
  if (sourceName.includes("eBay")) return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}`;
  if (sourceName.includes("TikTok")) return `https://www.tiktok.com/search?q=${encodeURIComponent(keyword)}`;
  if (sourceName.includes("Shopping")) return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(keyword)}`;
  if (sourceName.includes("Bing")) return `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&cc=US`;
  if (sourceName.includes("DuckDuckGo")) return `https://duckduckgo.com/?q=${encodeURIComponent(keyword)}&kl=us-en`;
  return `https://trends.google.com/explore?q=${encodeURIComponent(keyword)}&date=today%205-y&geo=${encodeURIComponent(geo)}`;
}

function renderRecommendationLoading() {
  relatedRows.innerHTML = `
    <tr>
      <td colspan="3">正在等待实时来源返回推荐词...</td>
    </tr>
  `;
}

function renderLiveRecommendations(data) {
  const seen = new Set();
  const rows = [];
  const perSourceLimit = 5;

  (data.sources || []).forEach((source) => {
    if (source.status !== "live") return;
    let sourceCount = 0;
    (source.items || []).forEach((keyword) => {
      if (sourceCount >= perSourceLimit) return;
      const clean = String(keyword || "").trim();
      const key = `${source.source}:${clean.toLowerCase()}`;
      if (!clean || seen.has(key)) return;
      seen.add(key);
      rows.push([source.source, clean, recommendationActionUrl(source.source, clean, data.geo || "US")]);
      sourceCount += 1;
    });
  });

  const visibleRows = rows;
  if (!visibleRows.length) {
    relatedRows.innerHTML = `
      <tr>
        <td colspan="3">当前实时来源没有返回推荐词。</td>
      </tr>
    `;
    return;
  }

  relatedRows.innerHTML = visibleRows.map(([channel, keyword, url]) => `
    <tr>
      <td><span class="channel-chip">${escapeHtml(channel)}</span></td>
      <td>${escapeHtml(keyword)}</td>
      <td><a class="row-action" href="${url}" target="_blank" rel="noreferrer">打开</a></td>
    </tr>
  `).join("");
}

function collectLiveKeywordSignals(data) {
  const buckets = new Map();
  (data?.sources || []).forEach((source) => {
    if (source.status !== "live") return;
    (source.items || []).forEach((item, index) => {
      const keyword = String(item || "").trim();
      if (!keyword) return;
      const key = keyword.toLowerCase();
      if (!buckets.has(key)) {
        buckets.set(key, {
          keyword,
          sources: new Set(),
          bestRank: index + 1,
          score: 0
        });
      }
      const bucket = buckets.get(key);
      bucket.sources.add(source.source);
      bucket.bestRank = Math.min(bucket.bestRank, index + 1);
      bucket.score += Math.max(4, 18 - index * 2);
    });
  });

  return Array.from(buckets.values()).map((bucket) => {
    const text = bucket.keyword.toLowerCase();
    const buyingIntent = /(buy|shop|amazon|nearby|for sale|bulk|pack|set|large|small|outdoor|indoor|decoration|decor|ornament|gift|with|holder|centerpiece|waterproof|led|lights|diy|craft|review|best)/i.test(text);
    const modifierCount = (text.match(/\b(for|with|outdoor|indoor|large|small|bulk|pack|set|diy|ideas|decor|decoration|gift|review|best|led|lights)\b/g) || []).length;
    const heat = Math.min(100, Math.round(bucket.score + bucket.sources.size * 9 + Math.max(0, 8 - bucket.bestRank) * 3 + modifierCount * 4 + (buyingIntent ? 12 : 0)));
    return {
      keyword: bucket.keyword,
      heat,
      sourceCount: bucket.sources.size,
      sources: Array.from(bucket.sources),
      buyingIntent,
      bestRank: bucket.bestRank
    };
  }).sort((a, b) => b.heat - a.heat || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword));
}

function evidenceFor(signals, patterns, limit = 3) {
  return signals
    .filter((item) => patterns.some((pattern) => pattern.test(item.keyword)))
    .slice(0, limit)
    .map((item) => item.keyword);
}

const CHRISTMAS_THEME_GROUPS = [
  {
    label: "圣诞装饰",
    scene: "树饰 / 挂件 / 家居摆件",
    patterns: [/christmas|holiday|decor|decoration|ornament|tree|garland/i],
    seeds: ["christmas decorations", "christmas decor", "christmas tree decorations", "christmas ornaments", "christmas garland"]
  },
  {
    label: "圣诞花环",
    scene: "门饰 / 桌面 / 蜡烛中心装饰",
    patterns: [/wreath|garland|centerpiece|candle|holder|door/i],
    seeds: ["christmas wreath", "christmas wreath for front door", "christmas candle holder wreath", "christmas table centerpiece", "christmas garland with lights"]
  },
  {
    label: "人物角色",
    scene: "圣诞老人 / 雪人 / 驯鹿 / 胡桃夹子",
    patterns: [/santa|snowman|reindeer|nutcracker|elf|gnome/i],
    seeds: ["santa claus decorations", "snowman christmas decorations", "reindeer christmas decorations", "nutcracker christmas decorations", "christmas gnome decorations"]
  },
  {
    label: "空间场景",
    scene: "户外 / 门廊 / 壁炉 / 餐桌",
    patterns: [/outdoor|porch|front door|mantel|fireplace|table|yard|window/i],
    seeds: ["outdoor christmas decorations", "christmas porch decorations", "front door christmas decor", "christmas mantel decor", "christmas table decor"]
  },
  {
    label: "礼品派对",
    scene: "送礼 / 包装 / 聚会 / 套装",
    patterns: [/gift|party|stocking|wrap|set|pack|bulk|basket/i],
    seeds: ["christmas party decorations", "christmas gift wrap", "christmas stocking stuffers", "christmas ornament set", "christmas gift basket"]
  },
  {
    label: "风格材质",
    scene: "灯串 / 农舍 / 复古 / 红绿配色",
    patterns: [/led|light|lights|rustic|farmhouse|vintage|red|green|aesthetic/i],
    seeds: ["lighted christmas decorations", "led christmas wreath", "rustic christmas decor", "farmhouse christmas decor", "vintage christmas decorations"]
  }
];

function isChristmasLikeTerm(term) {
  return /christmas|xmas|holiday|santa|wreath|ornament|garland|nutcracker|snowman|reindeer/i.test(String(term || ""));
}

function genericThemeGroups(term) {
  const base = String(term || "holiday decor").trim() || "holiday decor";
  return [
    {
      label: "核心搜索",
      scene: "主词 / 同义词 / 购买词",
      patterns: [new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), /buy|shop|best|ideas/i],
      seeds: [`${base} ideas`, `${base} decor`, `${base} amazon`, `${base} best`, `${base} set`]
    },
    {
      label: "场景空间",
      scene: "户外 / 桌面 / 门口 / 家居",
      patterns: [/outdoor|indoor|table|door|porch|home|room|wall/i],
      seeds: [`outdoor ${base}`, `${base} for table`, `${base} for front door`, `${base} for home`, `${base} wall decor`]
    },
    {
      label: "风格人群",
      scene: "审美 / 礼品 / DIY / 家庭",
      patterns: [/aesthetic|gift|diy|craft|family|kids|women|men/i],
      seeds: [`${base} aesthetic`, `${base} gift`, `${base} diy`, `${base} craft`, `${base} for family`]
    }
  ];
}

function keywordOverlapScore(a, b) {
  const aWords = String(a || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  const bText = String(b || "").toLowerCase();
  if (!aWords.length || !bText) return 0;
  return aWords.filter((word) => bText.includes(word)).length;
}

function matchingSignalsForKeyword(signals, keyword) {
  const key = String(keyword || "").toLowerCase();
  return signals.filter((signal) => {
    const text = String(signal.keyword || "").toLowerCase();
    return text === key || text.includes(key) || key.includes(text) || keywordOverlapScore(keyword, text) >= 2;
  });
}

function themeTermFromSignal(signal, group) {
  return group.patterns.some((pattern) => pattern.test(signal.keyword));
}

function buildThemeExpansions(data) {
  const baseTerm = data?.term || termInput.value.trim() || "christmas";
  const geo = data?.geo || geoInput.value || "US";
  const signals = collectLiveKeywordSignals(data);
  const groups = isChristmasLikeTerm(baseTerm) ? CHRISTMAS_THEME_GROUPS : genericThemeGroups(baseTerm);

  return {
    baseTerm,
    platformCount: (data?.sources || []).filter((source) => source.status === "live").length,
    groups: groups.map((group, groupIndex) => {
      const candidateMap = new Map();
      group.seeds.forEach((seed, seedIndex) => {
        candidateMap.set(seed.toLowerCase(), {
          keyword: seed,
          seedRank: seedIndex,
          source: "seed"
        });
      });
      signals
        .filter((signal) => themeTermFromSignal(signal, group))
        .slice(0, 8)
        .forEach((signal, signalIndex) => {
          const key = signal.keyword.toLowerCase();
          if (!candidateMap.has(key)) {
            candidateMap.set(key, {
              keyword: signal.keyword,
              seedRank: signalIndex,
              source: "live"
            });
          }
        });

      const items = Array.from(candidateMap.values()).map((candidate) => {
        const matches = matchingSignalsForKeyword(signals, candidate.keyword);
        const sourceSet = new Set(matches.flatMap((match) => match.sources || []));
        const bestSignal = matches.sort((a, b) => b.heat - a.heat)[0];
        const score = bestSignal
          ? Math.min(100, Math.round(bestSignal.heat + sourceSet.size * 4))
          : Math.max(38, 64 - groupIndex * 3 - candidate.seedRank * 4);
        return {
          keyword: candidate.keyword,
          score,
          sourceCount: sourceSet.size,
          sources: Array.from(sourceSet).slice(0, 4),
          evidenceType: sourceSet.size ? "平台信号" : "主题延伸",
          url: termActionUrl(candidate.keyword, geo)
        };
      }).sort((a, b) => b.score - a.score || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword));

      return {
        label: group.label,
        scene: group.scene,
        items: items.slice(0, 6)
      };
    })
  };
}

function renderThemeLoading() {
  if (!themeExpansionGrid) return;
  themeExpansionGrid.innerHTML = `<div class="source-data-empty">正在结合多平台推荐词生成主题场景延伸...</div>`;
}

function renderThemeExpansions(data = state.sourceCheck) {
  if (!themeExpansionGrid) return;
  if (!data) {
    renderThemeLoading();
    return;
  }

  const expansion = buildThemeExpansions(data);
  themeExpansionGrid.innerHTML = `
    <section class="theme-extension-summary">
      <strong>${escapeHtml(expansion.baseTerm)}</strong>
      <span>${expansion.platformCount} 个实时平台参与判断；绿色为平台已出现，灰色为主题延伸。</span>
    </section>
    ${expansion.groups.map((group) => `
      <article class="theme-extension-card">
        <div class="theme-extension-head">
          <strong>${escapeHtml(group.label)}</strong>
          <span>${escapeHtml(group.scene)}</span>
        </div>
        <ul class="theme-extension-list">
          ${group.items.map((item) => `
            <li class="${item.sourceCount ? "has-signal" : ""}">
              <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.keyword)}</a>
              <div class="theme-extension-meta">
                <span>${item.score}/100</span>
                <em>${escapeHtml(item.evidenceType)}</em>
              </div>
              <div class="theme-extension-bar"><span style="width:${Math.max(8, Math.min(100, item.score))}%"></span></div>
              <small>${escapeHtml(item.sources.length ? item.sources.map((source) => source.replace("推荐词", "").replace("搜索框", "").trim()).join(" / ") : "建议跳转验证")}</small>
            </li>
          `).join("")}
        </ul>
      </article>
    `).join("")}
  `;
}

function buildOpportunityInsights(data, manualTerms = "") {
  const signals = collectLiveKeywordSignals(data);
  const manualSignals = manualTerms
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .map((keyword) => ({
      keyword,
      heat: 45,
      sourceCount: 0,
      sources: ["手动输入"],
      buyingIntent: true,
      bestRank: 99
    }));
  const merged = [...signals, ...manualSignals].filter((item, index, arr) =>
    arr.findIndex((candidate) => candidate.keyword.toLowerCase() === item.keyword.toLowerCase()) === index
  );
  const baseTerm = data?.term || termInput.value.trim() || "";

  const highIntent = merged
    .filter((item) => item.buyingIntent || item.sourceCount >= 2)
    .slice(0, 8);

  const audienceRules = [
    { label: "节日家居装饰买家", patterns: [/christmas|holiday|wreath|ornament|decor|decoration|centerpiece|garland/i], reason: "关注节日氛围、门饰、桌面摆件和家庭布置。" },
    { label: "派对/聚会布置人群", patterns: [/party|table|centerpiece|bell|bells|garland|decor/i], reason: "更在意拍照效果、场景完整度和成套购买。" },
    { label: "DIY 手作与创意人群", patterns: [/diy|craft|ideas|how to|tutorial|drawing/i], reason: "会搜索教程、灵感和可改造材料。" },
    { label: "礼品购买人群", patterns: [/gift|for women|for men|for mom|for kids|teacher|stocking/i], reason: "搜索更偏送礼对象、节日节点和包装感。" },
    { label: "宠物家庭用户", patterns: [/pet|dog|cat|puppy|kitten|animal/i], reason: "关注冬季保暖、室内外使用和安全性。" },
    { label: "内容种草/测评受众", patterns: [/review|unboxing|tiktok|youtube|aesthetic|ideas/i], reason: "适合做短视频、教程、对比测评和场景图。" }
  ];

  const sceneRules = [
    { label: "前门/门廊/户外布置", patterns: [/door|porch|outdoor|yard|window|wreath/i] },
    { label: "餐桌/壁炉/桌面中心装饰", patterns: [/table|centerpiece|mantel|candle|holder|ring/i] },
    { label: "节日礼品/套装组合", patterns: [/gift|set|pack|bulk|box|ornament/i] },
    { label: "DIY 教程/素材包", patterns: [/diy|craft|tutorial|how to|ideas|drawing/i] },
    { label: "灯光氛围升级", patterns: [/led|light|lights|battery|fairy|glow/i] },
    { label: "社媒视觉内容", patterns: [/aesthetic|tiktok|youtube|review|unboxing|ideas/i] }
  ];

  const angleRules = [
    { label: "高配组合", patterns: [/with|set|pack|bulk|kit|bundle/i], tip: "可做成多件套、配件齐全、开箱即用。" },
    { label: "氛围升级", patterns: [/led|lights|candle|glow|aesthetic/i], tip: "强调灯效、拍照氛围和夜间场景。" },
    { label: "户外耐用", patterns: [/outdoor|waterproof|yard|porch|door/i], tip: "强调耐候、防水、可挂门廊/院子。" },
    { label: "尺寸/数量细分", patterns: [/large|small|mini|4 pack|2 pack|bulk/i], tip: "按尺寸、数量、场景做变体。" },
    { label: "内容营销", patterns: [/review|unboxing|tutorial|ideas|diy/i], tip: "适合做教程、对比、改造前后、场景短视频。" }
  ];

  const audiences = audienceRules
    .map((rule) => ({ ...rule, evidence: evidenceFor(merged, rule.patterns) }))
    .filter((rule) => rule.evidence.length)
    .slice(0, 4);

  const scenes = sceneRules
    .map((rule) => ({ ...rule, evidence: evidenceFor(merged, rule.patterns) }))
    .filter((rule) => rule.evidence.length)
    .slice(0, 5);

  const angles = angleRules
    .map((rule) => ({ ...rule, evidence: evidenceFor(merged, rule.patterns) }))
    .filter((rule) => rule.evidence.length)
    .slice(0, 5);

  return {
    baseTerm,
    platformCount: (data?.sources || []).filter((source) => source.status === "live").length,
    signalCount: signals.length,
    highIntent,
    audiences,
    scenes,
    angles
  };
}

function renderInsightLoading() {
  compareList.innerHTML = `<div class="source-data-empty">等待多平台推荐词，生成机会洞察...</div>`;
}

function renderOpportunityInsights(data = state.sourceCheck) {
  if (!data) {
    renderInsightLoading();
    return;
  }

  const insights = buildOpportunityInsights(data, compareInput.value || "");
  const highKeywords = insights.highIntent.length
    ? insights.highIntent.slice(0, 6).map((item) => `
      <article class="insight-keyword-card">
        <strong>${escapeHtml(item.keyword)}</strong>
        <span>${item.sourceCount || "手动"} 个来源 · ${item.heat}/100</span>
        <div class="mini-bar"><span style="width:${Math.max(8, Math.min(100, item.heat))}%"></span></div>
      </article>
    `).join("")
    : `<div class="source-data-empty">还没有足够的高意图关键词。</div>`;

  const renderInsightGroup = (title, items, emptyText) => `
    <section class="insight-group">
      <h3>${escapeHtml(title)}</h3>
      ${items.length ? items.map((item) => `
        <div class="insight-row">
          <strong>${escapeHtml(item.label)}</strong>
          ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}
          ${item.tip ? `<p>${escapeHtml(item.tip)}</p>` : ""}
          <small>依据：${escapeHtml(item.evidence.join(" / "))}</small>
        </div>
      `).join("") : `<div class="source-data-empty">${escapeHtml(emptyText)}</div>`}
    </section>
  `;

  compareList.innerHTML = `
    <div class="insight-summary">
      <strong>${escapeHtml(insights.baseTerm || "当前关键词")}</strong>
      <span>${insights.platformCount} 个实时平台 · ${insights.signalCount} 条推荐词信号</span>
    </div>
    <section class="insight-group">
      <h3>高配关键词</h3>
      <div class="insight-keyword-grid">${highKeywords}</div>
    </section>
    ${renderInsightGroup("人群预测", insights.audiences, "暂未识别到明确人群信号。")}
    ${renderInsightGroup("使用场景", insights.scenes, "暂未识别到明确场景信号。")}
    ${renderInsightGroup("产品/内容切入点", insights.angles, "暂未识别到明确切入点。")}
  `;
}

const PLATFORM_HEAT_META = [
  { key: "google", label: "Google 搜索", match: (name) => name.includes("Google 输入"), color: "#0f8a8a" },
  { key: "shopping", label: "Google Shopping", match: (name) => name.includes("Shopping"), color: "#2563eb" },
  { key: "amazon", label: "Amazon", match: (name) => name.includes("Amazon"), color: "#f59e0b" },
  { key: "tiktok", label: "TikTok", match: (name) => name.includes("TikTok 搜索"), color: "#111827" },
  { key: "youtube", label: "YouTube", match: (name) => name.includes("YouTube"), color: "#dc2626" },
  { key: "bing", label: "Bing", match: (name) => name.includes("Bing"), color: "#16a34a" },
  { key: "ebay", label: "eBay", match: (name) => name.includes("eBay"), color: "#7c3aed" },
  { key: "duckduckgo", label: "DuckDuckGo", match: (name) => name.includes("DuckDuckGo"), color: "#ea580c" }
];

function platformMeta(sourceName) {
  return PLATFORM_HEAT_META.find((item) => item.match(String(sourceName || ""))) || {
    key: "other",
    label: sourceName,
    color: "#64748b"
  };
}

function scorePlatformSource(source, term) {
  const items = (source.items || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (source.status !== "live" || !items.length) return 0;

  const cleanTerm = String(term || "").trim().toLowerCase();
  const itemTexts = items.map((item) => item.toLowerCase());
  const exactIndex = itemTexts.findIndex((item) => item === cleanTerm);
  const containsCount = cleanTerm
    ? itemTexts.filter((item) => item.includes(cleanTerm) || cleanTerm.includes(item)).length
    : 0;
  const intentCount = itemTexts.filter((item) => /(buy|shop|decor|decoration|ornament|gift|set|pack|bulk|large|small|outdoor|indoor|ideas|review|diy|with|for|nearby|amazon|walmart|target|etsy)/i.test(item)).length;

  const countScore = Math.min(38, items.length * 4);
  const exactScore = exactIndex >= 0 ? Math.max(10, 28 - exactIndex * 3) : 0;
  const relevanceScore = Math.min(22, containsCount * 4);
  const intentScore = Math.min(12, intentCount * 2);
  return Math.max(8, Math.min(100, Math.round(countScore + exactScore + relevanceScore + intentScore)));
}

function renderPlatformLoading() {
  if (!platformHeatGrid) return;
  platformHeatGrid.innerHTML = `<div class="source-data-empty">正在计算不同平台真实推荐热度...</div>`;
}

function renderPlatformSummary(liveSources, verificationSources) {
  if (state.current?.mode === "live") return;
  setPlatformMetricLabels();

  if (!liveSources.length) {
    averageMetric.textContent = "--";
    averageNote.textContent = "没有实时平台推荐词";
    growthMetric.textContent = "--";
    growthNote.textContent = "没有可计算平台";
    paceMetric.textContent = "待确认";
    paceNote.textContent = "请打开验证入口";
    searchMetric.textContent = "需验证";
    searchNote.textContent = "Google Trends / Pinterest";
    return;
  }

  const averageScore = Math.round(liveSources.reduce((sum, source) => sum + source.score, 0) / liveSources.length);
  const strongest = liveSources[0];
  averageMetric.textContent = averageScore;
  averageNote.textContent = `${liveSources.length} 个实时平台推荐词综合`;
  growthMetric.textContent = `${liveSources.length}/${PLATFORM_HEAT_META.length}`;
  growthNote.textContent = liveSources.slice(0, 4).map((source) => source.platformLabel).join(" / ");
  paceMetric.textContent = strongest.platformLabel;
  paceNote.textContent = `${strongest.score} / 100，当前最强`;
  searchMetric.textContent = verificationSources.length ? "可复核" : "待补充";
  searchNote.textContent = verificationSources.length
    ? verificationSources.slice(0, 3).map((source) => source.source.replace("TikTok Creative Center", "TikTok 热门")).join(" / ")
    : "暂无趋势验证入口";
}

function renderPlatformHeat(data) {
  if (!platformHeatGrid) return;

  const liveSources = (data.sources || [])
    .filter((source) => source.status === "live" && Array.isArray(source.items) && source.items.length)
    .map((source) => {
      const meta = platformMeta(source.source);
      const score = scorePlatformSource(source, data.term);
      return {
        ...source,
        platformLabel: meta.label,
        platformColor: meta.color,
        score,
        topItems: (source.items || []).slice(0, 3)
      };
    })
    .filter((source) => source.score > 0)
    .sort((a, b) => b.score - a.score);

  const verificationSources = (data.sources || [])
    .filter((source) => source.status !== "live" && source.link)
    .filter((source) => /Google Trends|Pinterest|Creative Center|Soovle/i.test(source.source));

  renderPlatformSummary(liveSources, verificationSources);

  if (!liveSources.length) {
    platformHeatGrid.innerHTML = `<div class="source-data-empty">当前没有实时平台推荐词，无法计算真实平台热度。</div>`;
    return;
  }

  const verificationHtml = verificationSources.length
    ? `
      <div class="platform-verify-strip">
        <strong>趋势验证入口</strong>
        <span>这些平台当前不能稳定自动抓取，打开后人工复核，不参与自动评分。</span>
        <div>
          ${verificationSources.map((source) => {
            const status = sourceStatusMeta(source.status);
            return `
            <a class="status-${status.tone}" href="${escapeHtml(source.link)}" target="_blank" rel="noreferrer">
              <span>${escapeHtml(source.source.replace("TikTok Creative Center", "TikTok 热门"))}</span>
              <em>${status.label}</em>
            </a>
          `;
          }).join("")}
        </div>
      </div>
    `
    : "";

  platformHeatGrid.innerHTML = liveSources.map((source) => `
    <article class="platform-heat-card" style="--platform-color:${source.platformColor}">
      <div class="platform-heat-head">
        <strong>${escapeHtml(source.platformLabel)}</strong>
        <span>实时推荐词</span>
      </div>
      <div class="platform-heat-score">
        <b>${source.score}</b>
        <small>/ 100</small>
      </div>
      <div class="platform-heat-bar" aria-label="${escapeHtml(source.platformLabel)} 推荐热度 ${source.score}">
        <span style="width:${Math.max(6, Math.min(100, source.score))}%"></span>
      </div>
      <div class="platform-heat-terms">
        ${source.topItems.map((item) => `<em>${escapeHtml(item)}</em>`).join("")}
      </div>
      <a href="${escapeHtml(source.link || recommendationActionUrl(source.source, data.term, data.geo || "US"))}" target="_blank" rel="noreferrer">打开验证</a>
    </article>
  `).join("") + verificationHtml;
}

function sourceStatusText(status) {
  const map = {
    live: "实时数据",
    "link-only": "需要验证",
    blocked: "需要验证"
  };
  return map[status] || status;
}

function verificationKey(sourceName) {
  const term = state.sourceCheck?.term || termInput.value.trim() || "candle holder wreath";
  const geo = state.sourceCheck?.geo || geoInput.value || "US";
  return `trend-radar-verified:${geo}:${term}:${sourceName}`;
}

function getVerification(sourceName) {
  try {
    const raw = localStorage.getItem(verificationKey(sourceName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setVerification(sourceName) {
  localStorage.setItem(verificationKey(sourceName), JSON.stringify({
    source: sourceName,
    verifiedAt: new Date().toISOString()
  }));
}

function formatVerificationTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function renderSourceData(data) {
  state.sourceCheck = data;
  const sources = data.sources || [];
  sourceDataGrid.innerHTML = sources.map((source) => {
    const items = (source.items || []).slice(0, 8);
    const needsVerification = source.status !== "live";
    const verification = getVerification(source.source);
    const cardStatus = needsVerification && verification ? "verified" : source.status;
    const label = needsVerification && verification ? "已人工验证" : sourceStatusText(source.status);
    const itemHtml = items.length
      ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<div class="source-note">${escapeHtml(source.note || "暂无可展示数据")}</div>`;
    const footNote = items.length && source.note ? `<small>${escapeHtml(source.note)}</small>` : "";
    return `
      <article class="source-data-card ${escapeHtml(cardStatus)} ${needsVerification ? "needs-verification" : ""}">
        <div class="source-data-head">
          <strong>${escapeHtml(source.source)}</strong>
          <span>${label}</span>
        </div>
        ${itemHtml}
        ${verification ? `<div class="manual-verified">已记录人工验证：${formatVerificationTime(verification.verifiedAt)}</div>` : ""}
        <div class="source-data-foot">
          ${footNote}
          <div class="source-actions">
            ${source.link ? `<a href="${source.link}" target="_blank" rel="noreferrer">打开验证页</a>` : ""}
            ${needsVerification ? `<button type="button" class="verify-source-btn" data-verify-source="${escapeHtml(source.source)}">我已验证，重新收集</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderSourceLoading() {
  sourceDataGrid.innerHTML = `<div class="source-data-empty">正在抓取 Google、Amazon、TikTok 等美国站来源...</div>`;
  renderPlatformLoading();
  renderRecommendationLoading();
  renderThemeLoading();
  renderInsightLoading();
}

function renderHolidayLoading(term) {
  const label = term ? `“${escapeHtml(term)}”` : "美国季节节日词库";
  holidayKeywordGrid.innerHTML = `<div class="source-data-empty">正在围绕 ${label} 收集真实推荐词...</div>`;
}

function renderHolidayKeywords(data) {
  const categories = data.categories || [];
  const highPotential = data.highPotential || [];
  const maxCategoryScore = Math.max(...categories.map((category) => Number(category.score) || 0), 1);
  const heatClass = (value) => {
    const heat = Number(value) || 0;
    if (heat >= 85) return "hot";
    if (heat >= 65) return "strong";
    if (heat >= 45) return "watch";
    return "weak";
  };
  const heatLabel = (value) => {
    const level = heatClass(value);
    return { hot: "高热", strong: "强需求", watch: "可观察", weak: "弱信号" }[level];
  };
  const shortSourceName = (source) => String(source || "")
    .replace("推荐词", "")
    .replace("搜索框", "")
    .replace("美国站", "")
    .trim();

  if (!categories.length) {
    holidayKeywordGrid.innerHTML = `<div class="source-data-empty">没有返回节日推荐词。</div>`;
    return;
  }

  const renderKeywordItem = (item) => {
    const heat = Math.round(Number(item.heat) || 0);
    const level = item.heatLevel || heatClass(heat);
    const heatWidth = Math.max(5, Math.min(100, heat));
    const events = item.events || (item.event ? [item.event] : []);
    const links = (item.links || []).slice(0, 2).map((link) => `
      <a class="scored" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(shortSourceName(link.source))}</a>
    `).join("");
    const sourceBadges = (item.sources || []).slice(0, 7).map((source) => `
      <span>${escapeHtml(shortSourceName(source))}</span>
    `).join("");
    const validationLinks = (item.validationLinks || []).slice(0, 6).map((link) => `
      <a class="verify" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>
    `).join("");
    return `
      <li class="holiday-keyword-item heat-${level}">
        <div class="holiday-keyword-main">
          <strong>${escapeHtml(item.keyword)}</strong>
          <span>${escapeHtml(events.join(" / "))} · ${item.sourceCount || 1} 个计分来源 · ${heatLabel(heat)}</span>
          <div class="holiday-source-badges">${sourceBadges}</div>
        </div>
        <div class="holiday-heat" aria-label="${escapeHtml(item.keyword)} 热度 ${heat}">
          <span style="width:${heatWidth}%"></span>
        </div>
        <b>${heat}</b>
        <div class="holiday-actions">
          ${links}
          ${validationLinks}
        </div>
      </li>
    `;
  };

  const highPotentialHtml = highPotential.length
    ? highPotential.slice(0, 16).map((item) => {
      const heat = Math.round(Number(item.heat) || 0);
      const level = item.heatLevel || heatClass(heat);
      return `
      <a class="holiday-hotword heat-${level}" href="${escapeHtml(item.trendsLink)}" target="_blank" rel="noreferrer">
        <strong>${escapeHtml(item.keyword)}</strong>
        <span>${escapeHtml(item.category)} / ${escapeHtml(item.subcategory)} · ${item.sourceCount || 1} 个计分来源</span>
        <em>${heat}<small>${heatLabel(heat)}</small></em>
      </a>
    `;
    }).join("")
    : `<div class="holiday-keyword-empty">暂无高潜力词排行</div>`;

  const categoryNavHtml = categories.map((category) => {
    const score = Math.round(Number(category.score) || 0);
    const level = category.heatLevel || heatClass(score);
    const width = Math.max(5, Math.round((score / maxCategoryScore) * 100));
    return `
      <a class="holiday-category-pill heat-${level}" href="#holiday-${escapeHtml(category.key)}">
        <span>${escapeHtml(category.label)}</span>
        <strong>${score}</strong>
        <em>${heatLabel(score)}</em>
        <i><b style="width:${width}%"></b></i>
      </a>
    `;
  }).join("");

  const categoryHtml = categories.map((category) => {
    const score = Math.round(Number(category.score) || 0);
    const level = category.heatLevel || heatClass(score);
    const width = Math.max(5, Math.round((score / maxCategoryScore) * 100));
    const subcategories = category.subcategories || [];
    const subcategoryHtml = subcategories.map((subcategory) => {
      const subScore = Math.round(Number(subcategory.score) || 0);
      const subLevel = subcategory.heatLevel || heatClass(subScore);
      const items = (subcategory.items || []).slice(0, 6);
      return `
        <article class="holiday-subcategory-card heat-${subLevel}">
          <div class="holiday-subcategory-head">
            <div>
              <strong>${escapeHtml(subcategory.label)}</strong>
              <span>${escapeHtml(subcategory.season)} · ${escapeHtml(subcategory.event)} · ${subcategory.liveSignalCount || 0} 条实时信号 · 种子词：${escapeHtml(subcategory.seed)}</span>
            </div>
            <em>${subScore}<small>${heatLabel(subScore)}</small></em>
          </div>
          <div class="holiday-season-bar" aria-label="${escapeHtml(subcategory.label)} 热度 ${subScore}">
            <span style="width:${Math.max(5, Math.min(100, subScore))}%"></span>
          </div>
          <div class="holiday-top">Top：${escapeHtml(subcategory.topKeyword || "待确认")}</div>
          <ul class="holiday-keyword-list">
            ${items.length ? items.map(renderKeywordItem).join("") : `<li class="holiday-keyword-empty">这个小类暂未抓到实时推荐词</li>`}
          </ul>
        </article>
      `;
    }).join("");

    return `
      <article class="holiday-category-section heat-${level}" id="holiday-${escapeHtml(category.key)}">
        <div class="holiday-category-head">
          <div>
            <h3>${escapeHtml(category.label)}</h3>
            <p>${escapeHtml(category.description || "")}</p>
          </div>
          <div class="holiday-category-score">
            <strong>${score}</strong>
            <span>大类热度 · ${heatLabel(score)}</span>
          </div>
        </div>
        <div class="holiday-season-bar category" aria-label="${escapeHtml(category.label)} 大类热度 ${score}">
          <span style="width:${width}%"></span>
        </div>
        <div class="holiday-top">大类 Top：${escapeHtml(category.topKeyword || "待确认")}</div>
        <div class="holiday-subcategory-grid">${subcategoryHtml}</div>
      </article>
    `;
  }).join("");

  const sourceSummary = (data.sources || []).map(shortSourceName).join(" / ");
  const contextSummary = data.term
    ? `当前输入词：${data.term}`
    : "当前词库：默认美国节日词库";
  holidayKeywordGrid.innerHTML = `
    <section class="holiday-reliability">
      <strong>可靠性规则 · ${escapeHtml(contextSummary)}</strong>
      <span>${escapeHtml(data.note || "只使用实时返回推荐词的来源计分。")}</span>
      <small>计分来源：${escapeHtml(sourceSummary)}。验证入口：${escapeHtml((data.verificationOnlySources || []).join(" / "))}。</small>
    </section>
    <section class="holiday-highlights">
      <div class="holiday-section-title">
        <h3>高潜力细分词</h3>
        <p>按真实来源热度指数排序，颜色越热代表实时推荐来源越集中；点击可到 Google Trends 验证。</p>
      </div>
      <div class="holiday-hotword-grid">${highPotentialHtml}</div>
    </section>
    <nav class="holiday-category-nav" aria-label="节日词库大类目">${categoryNavHtml}</nav>
    <div class="holiday-category-stack">${categoryHtml}</div>
  `;
}

async function runHolidayKeywords(geo, term) {
  const requestId = ++state.holidayRequestId;
  renderHolidayLoading(term);
  try {
    const query = new URLSearchParams({
      geo,
      term: term || ""
    });
    const data = await fetchJson(`/api/seasonal-keywords?${query.toString()}`);
    if (requestId !== state.holidayRequestId) return;
    renderHolidayKeywords(data);
  } catch (error) {
    if (requestId !== state.holidayRequestId) return;
    holidayKeywordGrid.innerHTML = `<div class="source-data-empty">节日推荐词收集失败：${escapeHtml(error.message)}</div>`;
  }
}

async function runSourceCheck(term, geo) {
  renderSourceLoading();
  try {
    const data = await fetchJson(`/api/source-check?term=${encodeURIComponent(term)}&geo=${encodeURIComponent(geo)}`);
    renderSourceData(data);
    renderSources(data);
    renderPlatformHeat(data);
    renderLiveRecommendations(data);
    renderThemeExpansions(data);
    renderOpportunityInsights(data);
  } catch (error) {
    sourceDataGrid.innerHTML = `<div class="source-data-empty">来源数据抓取失败：${escapeHtml(error.message)}</div>`;
    if (platformHeatGrid) {
      platformHeatGrid.innerHTML = `<div class="source-data-empty">平台热度计算失败：${escapeHtml(error.message)}</div>`;
    }
    if (themeExpansionGrid) {
      themeExpansionGrid.innerHTML = `<div class="source-data-empty">主题延伸生成失败：${escapeHtml(error.message)}</div>`;
    }
    compareList.innerHTML = `<div class="source-data-empty">机会洞察生成失败：${escapeHtml(error.message)}</div>`;
    relatedRows.innerHTML = `
      <tr>
        <td colspan="3">实时推荐词抓取失败：${escapeHtml(error.message)}</td>
      </tr>
    `;
  }
}

function renderRaw(data) {
  rawJson.textContent = JSON.stringify(data.raw || data, null, 2);
}

function renderCurrent(data) {
  state.current = data;
  const isLive = data.mode === "live";
  setTrendSectionsVisible(isLive);
  renderMetrics(data);
  if (isLive) {
    chartTitle.textContent = data.term;
    chartSubtitle.textContent = `${data.geo} / ${data.view === 1 ? "近 1 年" : "近 5 年"} / 更新于 ${data.summary?.updated || "今天"}`;
    modeBadge.textContent = "真实趋势";
    modeBadge.classList.add("live");
    renderChart(data);
    renderSeasonality(data);
  } else {
    modeBadge.classList.remove("live");
  }
  renderSources(data);
  renderRecommendationLoading();
  renderRaw(data);
}

async function runSearch() {
  const term = termInput.value.trim() || "candle holder wreath";
  const geo = geoInput.value;
  const view = viewInput.value;
  state.sourceCheck = null;
  setLoading(true);
  try {
    const data = await fetchJson(`/api/quick-get?term=${encodeURIComponent(term)}&geo=${encodeURIComponent(geo)}&view=${encodeURIComponent(view)}`);
    renderCurrent(data);
    runSourceCheck(term, geo);
    runHolidayKeywords(geo, term);
  } catch (error) {
    chartSubtitle.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

function runCompare() {
  renderOpportunityInsights(state.sourceCheck);
}

async function init() {
  state.config = await fetchJson("/api/config");
  renderApiStatus();
  renderInsightLoading();
  await runSearch();
}

searchBtn.addEventListener("click", runSearch);
compareBtn.addEventListener("click", runCompare);
termInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});
rawToggle.addEventListener("click", () => {
  rawJson.hidden = !rawJson.hidden;
});
sourceDataGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-verify-source]");
  if (!button) return;
  const sourceName = button.getAttribute("data-verify-source");
  setVerification(sourceName);
  button.textContent = "已记录，正在重新收集";
  button.disabled = true;
  runSourceCheck(termInput.value.trim() || "candle holder wreath", geoInput.value);
});

init().catch((error) => {
  apiStatus.querySelector("span:last-child").textContent = error.message;
});
