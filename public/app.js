const state = {
  current: null,
  config: null,
  sourceCheck: null,
  holidayRequestId: 0,
  socialRadarRequestId: 0,
  keywordDemandRequestId: 0,
  keywordDemandCache: new Map(),
  keywordDemandAbort: null,
  keywordDemandInFlightKey: "",
  googleTrendsGuard: null,
  platformGuards: [],
  guardTimer: null,
  cloudStatus: null,
  cloudHistory: null,
  cloudRequestId: 0
};

const termInput = document.querySelector("#termInput");
const geoInput = document.querySelector("#geoInput");
const viewInput = document.querySelector("#viewInput");
const searchBtn = document.querySelector("#searchBtn");
const compareInput = document.querySelector("#compareInput");
const compareBtn = document.querySelector("#compareBtn");

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
const hotDiscoveryGrid = document.querySelector("#hotDiscoveryGrid");
const socialRadarGrid = document.querySelector("#socialRadarGrid");
const keywordDemandGrid = document.querySelector("#keywordDemandGrid");
const keywordDemandTitle = document.querySelector("#keywordDemandTitle");
const keywordDemandSubtitle = document.querySelector("#keywordDemandSubtitle");
const seasonPanel = document.querySelector(".season-panel");
const trendGrid = document.querySelector(".main-grid");
const seasonalityGrid = document.querySelector("#seasonalityGrid");
const seasonalitySummary = document.querySelector("#seasonalitySummary");
const holidayKeywordGrid = document.querySelector("#holidayKeywordGrid");
const relatedRows = document.querySelector("#relatedRows");
const compareList = document.querySelector("#compareList");
const themeExpansionGrid = document.querySelector("#themeExpansionGrid");
const sourceAuditGrid = document.querySelector("#sourceAuditGrid");
const platformWorkbenchGrid = document.querySelector("#platformWorkbenchGrid");
const signalTaxonomyGrid = document.querySelector("#signalTaxonomyGrid");
const cloudHistoryGrid = document.querySelector("#cloudHistoryGrid");
const reportGrid = document.querySelector("#reportGrid");
const trendGuardPanel = document.querySelector("#trendGuardPanel");
const trendGuardState = document.querySelector("#trendGuardState");
const trendGuardCountdown = document.querySelector("#trendGuardCountdown");
const trendGuardAdvice = document.querySelector("#trendGuardAdvice");
const trendGuardLink = document.querySelector("#trendGuardLink");
const API_BASE = String(window.TREND_RADAR_API_BASE || "").replace(/\/+$/, "");
const API_PREFIX = String(window.TREND_RADAR_API_PREFIX || "/api").replace(/\/+$/, "") || "/api";

const VIEW_SECTIONS = [
  ".hot-discovery-panel",
  ".social-radar-panel",
  ".workbench-panel",
  ".signal-panel",
  ".source-panel",
  ".platform-heat-panel",
  ".keyword-demand-panel",
  ".source-data-panel",
  ".source-audit-panel",
  ".cloud-history-panel",
  ".report-panel",
  ".theme-extension-panel",
  ".lower-grid",
  ".holiday-panel",
  ".guide-panel",
  ".season-panel",
  ".main-grid"
];

const WORKSPACE_VIEWS = {
  research: [],
  "hot-discovery": [".hot-discovery-panel", ".platform-heat-panel", ".theme-extension-panel"],
  "social-radar": [".social-radar-panel"],
  "platform-workbench": [".workbench-panel", ".source-data-panel", ".source-audit-panel"],
  compare: [".signal-panel", ".lower-grid"],
  "keyword-demand": [".keyword-demand-panel", ".platform-heat-panel"],
  sources: [".source-panel", ".source-data-panel"],
  "source-audit": [".source-audit-panel", ".source-data-panel"],
  "cloud-history": [".cloud-history-panel", ".source-audit-panel"],
  report: [".report-panel"],
  "theme-extension": [".theme-extension-panel", ".hot-discovery-panel"],
  holidays: [".holiday-panel"],
  guide: [".guide-panel", ".source-audit-panel"]
};

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

const KEYWORD_PHRASE_TRANSLATIONS = [
  ["front door", "前门"],
  ["back to school", "返校季"],
  ["summer bbq", "夏季烧烤"],
  ["candle holder", "烛台"],
  ["candle ring", "蜡烛环"],
  ["table decor", "桌面装饰"],
  ["outdoor decorations", "户外装饰"],
  ["christmas decorations", "圣诞装饰"],
  ["christmas wreath", "圣诞花环"],
  ["christmas ornaments", "圣诞挂饰"],
  ["christmas lights", "圣诞灯饰"],
  ["christmas gifts", "圣诞礼物"],
  ["christmas tree", "圣诞树"],
  ["pet home", "宠物家居"]
];

const KEYWORD_WORD_TRANSLATIONS = new Map([
  ["christmas", "圣诞"],
  ["xmas", "圣诞"],
  ["holiday", "节日"],
  ["halloween", "万圣节"],
  ["thanksgiving", "感恩节"],
  ["easter", "复活节"],
  ["valentine", "情人节"],
  ["summer", "夏季"],
  ["winter", "冬季"],
  ["fall", "秋季"],
  ["autumn", "秋季"],
  ["bbq", "烧烤"],
  ["barbecue", "烧烤"],
  ["patterns", "图案"],
  ["pattern", "图案"],
  ["decor", "装饰"],
  ["decorations", "装饰品"],
  ["ornaments", "挂饰"],
  ["ornament", "挂饰"],
  ["wreath", "花环"],
  ["wreaths", "花环"],
  ["garland", "藤条"],
  ["ribbon", "丝带"],
  ["sash", "饰带"],
  ["bow", "蝴蝶结"],
  ["bells", "铃铛"],
  ["bell", "铃铛"],
  ["nutcracker", "胡桃夹子"],
  ["gingerbread", "姜饼"],
  ["santa", "圣诞老人"],
  ["snowman", "雪人"],
  ["reindeer", "驯鹿"],
  ["tree", "树"],
  ["gift", "礼物"],
  ["gifts", "礼物"],
  ["stocking", "圣诞袜"],
  ["stockings", "圣诞袜"],
  ["lights", "灯饰"],
  ["light", "灯"],
  ["led", "LED灯"],
  ["candle", "蜡烛"],
  ["holder", "支架"],
  ["centerpiece", "桌面中心装饰"],
  ["table", "餐桌"],
  ["mantel", "壁炉架"],
  ["porch", "门廊"],
  ["door", "门"],
  ["outdoor", "户外"],
  ["indoor", "室内"],
  ["velvet", "天鹅绒"],
  ["red", "红色"],
  ["green", "绿色"],
  ["pink", "粉色"],
  ["gold", "金色"],
  ["silver", "银色"],
  ["white", "白色"],
  ["rustic", "乡村风"],
  ["farmhouse", "农舍风"],
  ["vintage", "复古"],
  ["diy", "DIY手作"],
  ["craft", "手工"],
  ["crafts", "手工"],
  ["ideas", "灵感"],
  ["aesthetic", "审美风"],
  ["free", "免费"],
  ["printable", "可打印"],
  ["crochet", "钩针"],
  ["knitted", "针织"],
  ["felt", "毛毡"],
  ["handmade", "手工"],
  ["macrame", "绳结编织"],
  ["pet", "宠物"],
  ["dog", "狗"],
  ["cat", "猫"],
  ["home", "家居"],
  ["picnic", "野餐"],
  ["teacher", "教师"],
  ["classroom", "教室"],
  ["party", "派对"],
  ["wedding", "婚礼"],
  ["baby", "婴儿"],
  ["kids", "儿童"],
  ["set", "套装"],
  ["pack", "组合装"],
  ["bulk", "批量"]
]);

function keywordTranslation(keyword) {
  let text = String(keyword || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const translatedPhrases = [];
  KEYWORD_PHRASE_TRANSLATIONS.forEach(([phrase, translation]) => {
    const pattern = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (pattern.test(text)) {
      translatedPhrases.push(translation);
      text = text.replace(pattern, " ");
    }
  });
  const translatedWords = text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => KEYWORD_WORD_TRANSLATIONS.get(word))
    .filter(Boolean);
  return [...new Set([...translatedPhrases, ...translatedWords])].slice(0, 4).join(" / ");
}

function keywordDisplayLabel(keyword) {
  const translation = keywordTranslation(keyword);
  return translation ? `${keyword}（${translation}）` : keyword;
}

function activeViewKey() {
  const key = (window.location.hash || "#research").replace(/^#/, "");
  return WORKSPACE_VIEWS[key] ? key : "research";
}

function applyWorkspaceView() {
  const key = activeViewKey();
  const visibleSelectors = new Set(WORKSPACE_VIEWS[key] || WORKSPACE_VIEWS.research);
  VIEW_SECTIONS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.classList.toggle("view-hidden", !visibleSelectors.has(selector));
    });
  });
  document.querySelectorAll(".nav-list a").forEach((link) => {
    const linkKey = (link.getAttribute("href") || "").replace(/^#/, "");
    link.classList.toggle("active", linkKey === key);
  });
}

function formatGuardTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function guardRemainingMs(guard) {
  if (!guard) return 0;
  if (guard.cooldownUntil) {
    return Math.max(0, new Date(guard.cooldownUntil).getTime() - Date.now());
  }
  return Math.max(0, Number(guard.remainingMs || 0));
}

function guardPlatformLabel(key) {
  const labels = {
    "google-search": "Google Search",
    "google-shopping": "Google Shopping",
    "google-images": "Google Images",
    "google-news": "Google News",
    "google-trends": "Google Trends",
    youtube: "YouTube",
    amazon: "Amazon",
    tiktok: "TikTok",
    reddit: "Reddit",
    bing: "Bing",
    duckduckgo: "DuckDuckGo",
    ebay: "eBay",
    etsy: "Etsy"
  };
  return labels[key] || "Google Search";
}

function pickActiveGuard(googleGuard, platformGuards = []) {
  const guards = Array.isArray(platformGuards) ? [...platformGuards] : [];
  if (googleGuard) {
    guards.push({
      ...googleGuard,
      key: "google-trends",
      label: "Google Trends 曲线"
    });
  }
  return guards
    .filter((item) => guardRemainingMs(item) > 0 || item?.status === "cooldown")
    .sort((a, b) => guardRemainingMs(b) - guardRemainingMs(a))[0] || null;
}

function guardExternalUrl(guard, term, geo) {
  if (!guard) return "";
  return sourceUrl(guardPlatformLabel(guard.key), term || "", geo || "US");
}

function renderTrendGuard(guard = state.googleTrendsGuard, term = currentInputTerm(), geo = currentInputGeo(), platformGuards = state.platformGuards) {
  if (!trendGuardPanel) return;
  state.googleTrendsGuard = guard || null;
  if (Array.isArray(platformGuards)) state.platformGuards = platformGuards;

  const activeGuard = pickActiveGuard(state.googleTrendsGuard, state.platformGuards);
  const remainingMs = guardRemainingMs(activeGuard);
  const isCooldown = Boolean(activeGuard);
  const activeLabel = activeGuard?.label || "全部平台";

  trendGuardPanel.classList.toggle("cooldown", isCooldown);
  trendGuardPanel.classList.toggle("ready", !isCooldown);
  trendGuardState.textContent = isCooldown ? `${activeLabel} 冷却保护中` : "平台采集保护已开启";
  trendGuardCountdown.textContent = isCooldown ? `距离下次自动采集 ${formatGuardTime(remainingMs)}` : "自动采集可用";
  trendGuardAdvice.textContent = activeGuard?.advice || "系统会按平台分别限制自动读取频率；某个平台被限流时，只暂停该平台，其他来源继续采集。";

  const url = guardExternalUrl(activeGuard, term, geo);
  if (url) {
    trendGuardLink.textContent = "打开平台验证";
    trendGuardLink.setAttribute("href", url);
    trendGuardLink.setAttribute("data-open-external", url);
  } else {
    trendGuardLink.textContent = "查看验证入口";
    trendGuardLink.setAttribute("href", "#sources");
    trendGuardLink.removeAttribute("data-open-external");
  }

  if (state.guardTimer) clearInterval(state.guardTimer);
  if (isCooldown) {
    state.guardTimer = setInterval(() => {
      const nextActive = pickActiveGuard(state.googleTrendsGuard, state.platformGuards);
      const nextRemaining = guardRemainingMs(nextActive);
      trendGuardCountdown.textContent = nextRemaining > 0
        ? `距离下次自动采集 ${formatGuardTime(nextRemaining)}`
        : "自动采集可用";
      if (nextRemaining <= 0) {
        clearInterval(state.guardTimer);
        state.guardTimer = null;
        renderTrendGuard({ status: "ready" }, term, geo, state.platformGuards);
      }
    }, 1000);
  }
}

function keywordTrigger(keyword, className = "", externalUrl = "") {
  const safeKeyword = escapeHtml(keyword);
  const displayKeyword = escapeHtml(keywordDisplayLabel(keyword));
  const safeClassName = className ? ` ${escapeHtml(className)}` : "";
  const safeExternalUrl = externalUrl ? escapeHtml(externalUrl) : "";
  const externalAttrs = safeExternalUrl
    ? `data-open-keyword-url="${safeExternalUrl}" title="打开对应平台验证"`
    : `data-open-keyword-external="${safeKeyword}" title="用本机默认浏览器打开搜索验证"`;
  return `<span class="keyword-action-group"><button class="keyword-inline-button${safeClassName}" type="button" data-demand-keyword="${safeKeyword}" title="站内分析">${displayKeyword}</button><button class="keyword-external-button" type="button" ${externalAttrs}>↗</button></span>`;
}

function externalOpenAttributes(url) {
  const safeUrl = escapeHtml(url);
  return `href="${safeUrl}" data-open-external="${safeUrl}" target="_blank" rel="noreferrer"`;
}

async function openExternalUrl(url) {
  if (!url) return;
  try {
    const response = await fetch(apiUrl(`/api/open-external?url=${encodeURIComponent(url)}`));
    if (!response.ok) throw new Error(`external open failed: ${response.status}`);
  } catch (error) {
    console.warn(error);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function apiUrl(url) {
  const text = String(url || "");
  if (!text.startsWith("/api/")) return text;
  if (API_BASE) {
    const base = String(API_BASE).replace(/\/+$/, "");
    return base.endsWith("/radar-api") ? `${base}${text.slice(4)}` : `${base}${text}`;
  }
  return `${API_PREFIX}${text.slice(4)}`;
}

async function fetchJson(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 16000);
  const controller = new AbortController();
  const parentSignal = options.signal;
  const abortFromParent = () => controller.abort(parentSignal?.reason || "aborted");
  if (parentSignal) {
    if (parentSignal.aborted) abortFromParent();
    else parentSignal.addEventListener("abort", abortFromParent, { once: true });
  }
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const { timeoutMs: _timeoutMs, signal: _signal, ...fetchOptions } = options;
  try {
    const response = await fetch(apiUrl(url), {
      ...fetchOptions,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`请求失败：${response.status}`);
    return response.json();
  } catch (error) {
    if (controller.signal.aborted && !parentSignal?.aborted) {
      throw new Error("请求超时：平台返回较慢，已停止等待，请稍后重试或打开复核入口。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    if (parentSignal) parentSignal.removeEventListener("abort", abortFromParent);
  }
}

function setLoading(isLoading) {
  document.body.classList.toggle("loading", isLoading);
  searchBtn.disabled = isLoading;
  compareBtn.disabled = isLoading;
}

function renderApiStatus() {
  const configured = state.config?.treendlyConfigured;
  apiStatus.classList.toggle("live", configured);
  apiStatus.classList.toggle("limited", !configured);
  apiStatus.querySelector("span:last-child").textContent = configured
    ? "Treendly 账号已配置"
    : "Treendly 未接入：仅显示真实平台推荐词";
  state.platformGuards = Array.isArray(state.config?.platformGuards) ? state.config.platformGuards : [];
  renderTrendGuard(state.config?.googleTrendsGuard, currentInputTerm(), currentInputGeo(), state.platformGuards);
}

function setApiStatusMessage(message, tone = "") {
  if (!apiStatus) return;
  apiStatus.classList.toggle("live", tone === "live");
  apiStatus.classList.toggle("limited", tone !== "live");
  const label = apiStatus.querySelector("span:last-child");
  if (label) label.textContent = message;
}

async function triggerSearchCollection(term, geo = currentInputGeo()) {
  const clean = String(term || "").trim();
  if (!clean) return null;
  try {
    setApiStatusMessage("正在后台保存本次搜索到 D1...", "limited");
    const result = await fetchJson("/api/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        term: clean,
        geo,
        maxSeeds: 1,
        triggerType: "search"
      }),
      timeoutMs: 45000
    });
    const savedText = result?.keywordCount
      ? `已写入 D1：${result.keywordCount} 条关键词 / ${result.sourceCount || 0} 个来源`
      : "已触发 D1 后台采集";
    setApiStatusMessage(savedText, "live");
    refreshCloudHistory(clean, geo);
    window.setTimeout(() => renderApiStatus(), 6000);
    return result;
  } catch (error) {
    setApiStatusMessage(`D1 后台保存失败：${error.message || "请稍后重试"}`, "limited");
    window.setTimeout(() => renderApiStatus(), 8000);
    return null;
  }
}

function renderCloudHistoryLoading(term = "") {
  if (!cloudHistoryGrid) return;
  const label = term ? `正在读取 ${escapeHtml(term)} 的云端历史证据链...` : "正在检查云端 D1 历史库...";
  cloudHistoryGrid.innerHTML = `<div class="source-data-empty">${label}</div>`;
}

function renderCloudHistoryError(message) {
  if (!cloudHistoryGrid) return;
  cloudHistoryGrid.innerHTML = `
    <article class="cloud-card cloud-card-wide">
      <span class="cloud-card-label">云端历史库</span>
      <strong>暂不可用</strong>
      <p>${escapeHtml(message || "无法读取云端状态。")}</p>
      <small>这不会影响本地实时推荐词采集；部署 Worker + D1 后会自动恢复。</small>
    </article>
  `;
}

function reportExportQuery(term = "", geo = "US") {
  return `term=${encodeURIComponent(term || "")}&geo=${encodeURIComponent(geo || "US")}&days=30`;
}

function reportExportLinks(term = "", geo = "US", compact = false) {
  const query = reportExportQuery(term, geo);
  const links = [
    ["Markdown", `/api/export.md?${query}`]
  ];
  if (!compact) {
    links.push(["Word", `/api/export.doc?${query}`], ["Excel", `/api/export.xls?${query}`], ["CSV", `/api/export.csv?${query}`]);
  }
  return links.map(([label, url]) => `<a ${externalOpenAttributes(apiUrl(url))}>${label}</a>`).join("") + `<button type="button" data-print-report>PDF</button>`;
}

function renderReportPanelLoading(term = "") {
  if (!reportGrid) return;
  reportGrid.innerHTML = `
    <article class="report-card report-card-wide">
      <span class="report-card-label">正在生成</span>
      <strong>${escapeHtml(term || "当前关键词")} 的中文报告</strong>
      <p>正在读取实时推荐词、D1 历史记录和人工复核记录；如果趋势曲线未接入，只会保留 Google Trends 复核入口。</p>
    </article>
  `;
}

function renderReportPanelError(message, term = "", geo = "US") {
  if (!reportGrid) return;
  reportGrid.innerHTML = `
    <article class="report-card report-card-wide">
      <span class="report-card-label">报告暂不可用</span>
      <strong>${escapeHtml(term || "当前关键词")}</strong>
      <p>${escapeHtml(message || "云端报告接口暂时没有返回。")}</p>
      <div class="cloud-link-row">${reportExportLinks(term, geo, true)}</div>
    </article>
  `;
}

function renderReportPanel(status = {}, history = null, report = null, term = "", geo = "US") {
  if (!reportGrid) return;
  const connected = Boolean(status.d1Connected);
  const summary = report?.summary || {};
  const opportunities = Array.isArray(report?.opportunities) ? report.opportunities : [];
  const evidence = Array.isArray(history?.evidence) ? history.evidence : [];
  const manual = Array.isArray(history?.manualVerification) ? history.manualVerification : [];
  const testable = Array.isArray(report?.testableOpportunities) && report.testableOpportunities.length
    ? report.testableOpportunities
    : opportunities.filter((item) => item.productFilter?.action !== "exclude" && ["A", "B"].includes(item.grade));
  const observation = Array.isArray(report?.observationPool) && report.observationPool.length
    ? report.observationPool
    : opportunities.filter((item) => item.productFilter?.action !== "exclude" && !["A", "B"].includes(item.grade));
  const risks = Array.isArray(report?.riskFiltered) && report.riskFiltered.length
    ? report.riskFiltered
    : opportunities.filter((item) => item.productFilter?.action === "exclude");
  const reportList = (items, emptyText) => items.length
    ? items.slice(0, 5).map((item) => `
        <li>
          <strong>${escapeHtml(item.keyword)}</strong>
          <span>${escapeHtml(item.grade || "C")}级 · 推荐词 ${item.scoreBreakdown?.recommendationCoverage ?? "--"} · 购物 ${item.scoreBreakdown?.shoppingIntent ?? "--"} · 机会 ${item.opportunityScore ?? "--"}</span>
          <small>${escapeHtml(item.timeType || item.productFilter?.label || "待验证")} · ${escapeHtml(item.freshness?.label || "实时/历史待确认")}</small>
        </li>
      `).join("")
    : `<li><strong>${escapeHtml(emptyText)}</strong><span>继续采集或先打开人工复核入口。</span></li>`;
  const riskHtml = risks.length
    ? risks.slice(0, 5).map((item) => `
        <li>
          <strong>${escapeHtml(item.keyword)}</strong>
          <span>${escapeHtml(item.productFilter?.label || "风险词")} · ${escapeHtml(item.productFilter?.reason || "需要人工确认")}</span>
        </li>
      `).join("")
    : `<li><strong>暂无明显过滤词</strong><span>品牌、非实物、纯内容词仍需人工留意。</span></li>`;
  const trendReviews = term
    ? MANUAL_TREND_PLATFORMS.map((item) => {
      const review = getManualTrendReview(term, geo, item.platform);
      return `${item.title}：${review ? `${trendReviewStatusLabel(review.status)} ${formatVerificationTime(review.reviewedAt || review.returnedAt || review.openedAt)}` : "未复核"}`;
    })
    : [];
  const trendStatus = trendReviews.length ? trendReviews.join(" / ") : "未复核";
  const sourceStatusText = [
    `实时推荐词 ${summary.realtimeSignalCount ?? 0}`,
    `云端历史 ${summary.cloudHistoryCount ?? 0}`,
    `人工复核 ${summary.manualReviewCount ?? manual.length}`,
    connected ? "D1 已连接" : "D1 未连接或本地预览"
  ].join(" · ");
  const manualLinks = manual.slice(0, 8).map((item) => `
    <a ${externalOpenAttributes(item.sourceUrl)}>${escapeHtml(item.platform)}</a>
  `).join("");

  reportGrid.innerHTML = `
    <article class="report-card report-card-wide">
      <span class="report-card-label">本周结论</span>
      <strong>${escapeHtml(term || "请输入关键词")}</strong>
      <p>${escapeHtml(sourceStatusText)}。${escapeHtml(summary.historyTrendMessage || "历史曲线未接入时，不判断近 5 年上升/下降。")} 推荐词不是搜索量，也不是销量。</p>
      <div class="cloud-link-row">${term ? reportExportLinks(term, geo, true) : `<span>输入关键词后可导出 Markdown / PDF</span>`}</div>
    </article>
    <article class="report-card report-card-list">
      <span class="report-card-label">可测款机会</span>
      <ul>${reportList(testable, "暂无 A/B 级可测款机会")}</ul>
    </article>
    <article class="report-card report-card-list">
      <span class="report-card-label">观察池</span>
      <ul>${reportList(observation, "暂无观察词")}</ul>
    </article>
    <article class="report-card report-card-list">
      <span class="report-card-label">风险/过滤词</span>
      <ul>${riskHtml}</ul>
    </article>
    <article class="report-card report-card-wide">
      <span class="report-card-label">证据链与复核入口</span>
      <strong>趋势人工复核：${escapeHtml(trendStatus)}</strong>
      <p>Google Trends 和 Pinterest Trends 需要打开后人工判断：上升 / 平稳 / 季节爆发 / 下降 / 无数据。返回页面后会记录访问，再点选结果可写入云端复核。</p>
      <div class="cloud-link-row">
        ${term ? MANUAL_TREND_PLATFORMS.map((item) => `<a ${externalOpenAttributes(sourceUrl(item.urlLabel, term, geo))}>打开 ${escapeHtml(item.title)}</a>`).join("") : ""}
        ${manualLinks || `<span>输入关键词后显示多平台复核入口</span>`}
      </div>
    </article>
  `;
}

function renderCloudHistory(status = {}, history = null, report = null, term = "", geo = "US") {
  if (!cloudHistoryGrid) return;
  state.cloudStatus = status;
  state.cloudHistory = history;
  const connected = Boolean(status.d1Connected);
  const database = status.database || {};
  const latest = status.latestRun || null;
  const snapshots = history?.snapshots || [];
  const evidence = history?.evidence || [];
  const opportunities = report?.opportunities || [];
  const normalizedReportScores = new Map(opportunities.map((item) => [String(item.keyword || "").trim().toLowerCase(), item]));
  const displayOpportunities = opportunities.filter((item) => item.productFilter?.action !== "exclude" && ["A", "B", "C"].includes(item.grade || "C"));
  const modeText = connected ? "已连接 D1 云端历史库" : "本地预览模式";
  const latestText = latest?.started_at
    ? `${latest.status || "unknown"} · ${new Date(latest.started_at).toLocaleString("zh-CN")}`
    : "暂无云端采集记录";
  const topOpportunityHtml = displayOpportunities.length
    ? displayOpportunities.slice(0, 6).map((item) => `
        <li>
          <strong>${escapeHtml(item.keyword)}</strong>
          <span>${escapeHtml(item.grade || "C")}级 · 可信度 ${item.credibilityScore ?? "--"} · 推荐词 ${item.signalIndex ?? "--"} · 机会 ${item.opportunityScore ?? "--"}</span>
          <small>${escapeHtml(item.timeType || "待观察型")} · ${escapeHtml(item.freshness?.label || "新鲜度未知")}</small>
        </li>
      `).join("")
    : `<li><strong>暂无 A/B 级历史机会</strong><span>${connected ? "等待定时采集积累更多证据" : "部署 Cloudflare 后开始累计"}</span></li>`;
  const snapshotHtml = snapshots.length
    ? snapshots.slice(0, 8).map((item) => {
      const unified = normalizedReportScores.get(String(item.keyword || "").trim().toLowerCase());
      const grade = unified?.grade || item.trust_grade || "C";
      const credibility = unified?.credibilityScore ?? item.credibility_score ?? "--";
      const sourceCount = unified?.sourceCount ?? item.source_count ?? 0;
      const timeType = unified?.timeType || item.time_type || "today_signal";
      return `
        <li>
          <strong>${escapeHtml(item.keyword)}</strong>
          <span>${escapeHtml(grade)}级 · 可信度 ${credibility} · ${sourceCount} 来源</span>
          <small>${escapeHtml(timeType)} · ${unified ? "已按当前评分模型统一" : escapeHtml(item.created_at || "")}</small>
        </li>
      `;
    }).join("")
    : `<li><strong>暂无历史快照</strong><span>${term ? "当前关键词还没有云端历史" : "输入关键词后查看历史"}</span></li>`;
  const manualLinks = (history?.manualVerification || []).slice(0, 14).map((item) => `
    <a ${externalOpenAttributes(item.sourceUrl)}>${escapeHtml(item.platform)}</a>
  `).join("");
  const exportLinks = reportExportLinks(term, geo);

  cloudHistoryGrid.innerHTML = `
    <article class="cloud-card">
      <span class="cloud-card-label">连接状态</span>
      <strong>${escapeHtml(modeText)}</strong>
      <p>${escapeHtml(status.message || (connected ? "搜索会后台保存公开推荐词、关键词快照和证据链；Google Trends 曲线仍需人工复核。" : "本地页面只能实时查询，不能长期保存历史。"))}</p>
    </article>
    <article class="cloud-card">
      <span class="cloud-card-label">历史数据量</span>
      <strong>${database.evidence || 0}</strong>
      <p>证据链 ${database.evidence || 0} 条 / 快照 ${database.snapshots || 0} 条 / 种子 ${database.seeds || 0} 个；每次搜索会新增本次公开来源采集。</p>
    </article>
    <article class="cloud-card">
      <span class="cloud-card-label">最近采集</span>
      <strong>${escapeHtml(latest?.status || "--")}</strong>
      <p>${escapeHtml(latestText)}</p>
    </article>
    <article class="cloud-card cloud-card-list">
      <span class="cloud-card-label">选品机会卡</span>
      <ul>${topOpportunityHtml}</ul>
    </article>
    <article class="cloud-card cloud-card-list">
      <span class="cloud-card-label">${term ? `${escapeHtml(term)} 历史快照` : "历史快照"}</span>
      <ul>${snapshotHtml}</ul>
    </article>
    <article class="cloud-card cloud-card-wide">
      <span class="cloud-card-label">平台复核入口</span>
      <p>${connected ? `当前查询 ${escapeHtml(geo)} / ${escapeHtml(term || "未输入关键词")}，云端证据 ${evidence.length} 条。` : "这些入口只用于人工确认，不自动算分。"}</p>
      <div class="cloud-link-row">${manualLinks || `<span>输入关键词后显示平台复核链接</span>`}</div>
    </article>
    <article class="cloud-card cloud-card-wide">
      <span class="cloud-card-label">报告导出</span>
      <p>从 D1 历史库生成中文选品报告和表格；未输入关键词时导出当前地区最近 30 天总览。</p>
      <div class="cloud-link-row">${exportLinks}</div>
    </article>
  `;
  renderReportPanel(status, history, report, term, geo);
}
async function refreshCloudHistory(term = "", geo = currentInputGeo()) {
  if (!cloudHistoryGrid) return;
  const clean = String(term || "").trim();
  const requestId = ++state.cloudRequestId;
  renderCloudHistoryLoading(clean);
  renderReportPanelLoading(clean);
  try {
    const statusPromise = fetchJson(`/api/cloud/status?t=${Date.now()}`, { cache: "no-store" });
    const historyPromise = clean
      ? fetchJson(`/api/history?term=${encodeURIComponent(clean)}&geo=${encodeURIComponent(geo)}&days=365`)
      : Promise.resolve(null);
    const reportPromise = clean
      ? fetchJson(`/api/report?term=${encodeURIComponent(clean)}&geo=${encodeURIComponent(geo)}&days=30`)
      : Promise.resolve(null);
    const [status, history, report] = await Promise.all([statusPromise, historyPromise, reportPromise]);
    if (requestId !== state.cloudRequestId) return;
    renderCloudHistory(status, history, report, clean, geo);
  } catch (error) {
    if (requestId !== state.cloudRequestId) return;
    renderCloudHistoryError(error.message);
    renderReportPanelError(error.message, clean, geo);
  }
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
  averageLabel.textContent = "趋势历史信号";
  growthLabel.textContent = "趋势变化";
  paceLabel.textContent = "趋势节奏";
  searchLabel.textContent = "人工复核";
}

function setPlatformMetricLabels() {
  averageLabel.textContent = "推荐词信号指数";
  growthLabel.textContent = "平台覆盖";
  paceLabel.textContent = "强势平台";
  searchLabel.textContent = "人工复核";
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
    searchNote.textContent = "趋势/社媒平台需人工复核";
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
  searchNote.textContent = summary.monthlySearches ? "第三方趋势库估算" : "接口未返回";
}

function renderChart(data) {
  const series = data.series || [];
  const width = 760;
  const height = 320;
  const pad = { top: 26, right: 26, bottom: 38, left: 44 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  if (!series.length) {
    trendChart.innerHTML = "";
    chartSubtitle.textContent = "历史曲线未接入，请打开 Google Trends 复核。";
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
  const q = encodeURIComponent(String(term || "").trim());
  const country = encodeURIComponent(geo || "US");
  const urls = {
    "Google Trends 5Y": `https://trends.google.com/trends/explore?date=today%205-y&geo=${country}&q=${q}`,
    "Google Trends": `https://trends.google.com/trends/explore?date=today%205-y&geo=${country}&q=${q}`,
    "Google Search": `https://www.google.com/search?q=${q}`,
    "Google Images": `https://www.google.com/search?tbm=isch&q=${q}`,
    "Google News": `https://news.google.com/search?q=${q}&hl=en-US&gl=${country}&ceid=${country}:en`,
    "Google Shopping": `https://www.google.com/search?tbm=shop&q=${q}`,
    "Pinterest Trends": `https://trends.pinterest.com/search/?country=${country}&q=${q}&trendsPreset=2`,
    "Pinterest": `https://trends.pinterest.com/search/?country=${country}&q=${q}&trendsPreset=2`,
    "TikTok": `https://www.tiktok.com/search?q=${q}`,
    "TikTok Creative Center": `https://ads.tiktok.com/creative/creativeCenter/trends/hashtag/13873640?region=${country}&period=90`,
    "Amazon": `https://www.amazon.com/s?k=${q}`,
    "Amazon Best Sellers": `https://www.amazon.com/Best-Sellers/zgbs?k=${q}`,
    "Amazon Movers & Shakers": `https://www.amazon.com/gp/movers-and-shakers?k=${q}`,
    "Amazon New Releases": `https://www.amazon.com/gp/new-releases/?k=${q}`,
    "Amazon Most Wished For": `https://www.amazon.com/gp/most-wished-for/?k=${q}`,
    "YouTube": `https://www.youtube.com/results?search_query=${q}`,
    "Bing": `https://www.bing.com/search?q=${q}&cc=${country}`,
    "DuckDuckGo": `https://duckduckgo.com/?q=${q}&kl=us-en`,
    "eBay": `https://www.ebay.com/sch/i.html?_nkw=${q}`,
    "Etsy": `https://www.etsy.com/search?q=${q}`,
    "Walmart": `https://www.walmart.com/search?q=${q}`,
    "Target": `https://www.target.com/s?searchTerm=${q}`,
    "Instagram": `https://www.instagram.com/explore/tags/${encodeURIComponent(String(term || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 60))}/`,
    "Facebook": `https://www.facebook.com/search/top/?q=${q}`,
    "Facebook Marketplace": `https://www.facebook.com/marketplace/search/?query=${q}`,
    "X": `https://x.com/search?q=${q}&src=typed_query&f=top`,
    "Threads": `https://www.threads.net/search?q=${q}`,
    "Reddit": `https://www.reddit.com/search/?q=${q}`,
    "Meta Ads Library": `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${q}`,
    "Home Depot": `https://www.homedepot.com/s/${q}`,
    "Lowe's": `https://www.lowes.com/search?searchTerm=${q}`,
    "Wayfair": `https://www.wayfair.com/keyword.php?keyword=${q}`,
    "AliExpress": `https://www.aliexpress.com/wholesale?SearchText=${q}`,
    "Temu": `https://www.temu.com/search_result.html?search_key=${q}`,
    "SHEIN": `https://us.shein.com/pdsearch/${q}/`,
    "Kickstarter": `https://www.kickstarter.com/discover/advanced?term=${q}`,
    "Product Hunt": `https://www.producthunt.com/search?q=${q}`,
    "Quora": `https://www.quora.com/search?q=${q}`,
    "TrendHunter": `https://www.trendhunter.com/results?search=${q}`,
    "Exploding Topics": `https://explodingtopics.com/explore?q=${q}`,
    "Google Ads Keyword Planner": "https://ads.google.com/home/tools/keyword-planner/",
    "Amazon Brand Analytics": "https://sell.amazon.com/tools/brand-analytics",
    "Pinterest Predicts": "https://business.pinterest.com/pinterest-predicts/",
    "Reddit API": "https://www.reddit.com/dev/api/",
    "Etsy Open API": "https://developer.etsy.com/documentation/reference/",
    "Walmart Developer": "https://developer.walmart.com/",
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
    "Google Images": /Google Images/i,
    "Google News": /Google News/i,
    "Pinterest Trends": /Pinterest Trends/i,
    "TikTok": /TikTok 搜索/i,
    "TikTok Creative Center": /TikTok Creative Center/i,
    "Amazon Best Sellers": /Amazon Best Sellers/i,
    "Amazon Movers & Shakers": /Amazon Movers/i,
    "Amazon New Releases": /Amazon New Releases/i,
    "Amazon Most Wished For": /Amazon Most Wished/i,
    "Amazon": /Amazon/i,
    "Google Shopping": /Google Shopping/i,
    "YouTube": /YouTube/i,
    "Google Search": /Google 输入框/i,
    "Bing": /Bing/i,
    "eBay": /eBay/i,
    "Etsy": /Etsy/i,
    "Walmart": /Walmart/i,
    "Target": /Target/i,
    "Home Depot": /Home Depot/i,
    "Lowe's": /Lowe/i,
    "Wayfair": /Wayfair/i,
    "AliExpress": /AliExpress/i,
    "Temu": /Temu/i,
    "SHEIN": /SHEIN/i,
    "Meta Ads Library": /Meta Ads Library/i,
    "Kickstarter": /Kickstarter/i,
    "Product Hunt": /Product Hunt/i,
    "Quora": /Quora/i,
    "TrendHunter": /TrendHunter/i,
    "Exploding Topics": /Exploding Topics/i,
    "Instagram": /Instagram/i,
    "Facebook": /Facebook Search/i,
    "Facebook Marketplace": /Facebook Marketplace/i,
    "X": /X Search/i,
    "Threads": /Threads Search/i,
    "Reddit": /Reddit/i,
    "Soovle": /Soovle/i
  };
  const matcher = matchers[label];
  if (!matcher) return null;
  return (state.sourceCheck?.sources || []).find((source) => matcher.test(source.source));
}

function currentInputTerm() {
  return termInput.value.trim();
}

function currentInputGeo() {
  return geoInput.value || state.sourceCheck?.geo || state.current?.geo || "US";
}

function renderSources(data) {
  const linkTerm = data?.term || currentInputTerm();
  const linkGeo = data?.geo || currentInputGeo();
  const displayTerm = linkTerm || "待输入关键词";
  const channels = [
    ["Google Trends", "搜索趋势曲线", "primary"],
    ["Pinterest Trends", "图片/家居趋势"],
    ["Google Images", "视觉结果密度"],
    ["Google News", "新闻/内容话题"],
    ["TikTok", "短视频搜索验证"],
    ["TikTok Creative Center", "TikTok 热门趋势"],
    ["Amazon", "美国站搜索结果"],
    ["Amazon Best Sellers", "热卖榜复核"],
    ["Amazon Movers & Shakers", "短期上升榜"],
    ["Amazon New Releases", "新品榜"],
    ["Amazon Most Wished For", "心愿单需求"],
    ["Google Shopping", "购物搜索结果"],
    ["YouTube", "教程与测评需求"],
    ["Google Search", "自然搜索验证"],
    ["Bing", "搜索补充验证"],
    ["eBay", "二级市场/复古词"],
    ["Etsy", "手作礼品市场"],
    ["Walmart", "美国大卖场"],
    ["Target", "美国零售场景"],
    ["Home Depot", "家装货架"],
    ["Lowe's", "家装货架"],
    ["Wayfair", "家居家具货架"],
    ["AliExpress", "跨境货源/款式"],
    ["Temu", "低价货架复核"],
    ["SHEIN", "时尚/家居款式"],
    ["Meta Ads Library", "广告投放验证"],
    ["Instagram", "社媒图片标签"],
    ["Facebook", "社群帖子/评论复核"],
    ["Facebook Marketplace", "本地交易需求"],
    ["X", "实时话题/吐槽"],
    ["Threads", "轻社交讨论"],
    ["Reddit", "社区讨论语境"],
    ["Kickstarter", "新品众筹方向"],
    ["Product Hunt", "新品/工具趋势"],
    ["Quora", "问答痛点"],
    ["TrendHunter", "趋势案例"],
    ["Exploding Topics", "上升主题"],
    ["Soovle", "多平台联想工具"]
  ];

  const helperHtml = `
    <div class="verification-helper">
      <div>
        <strong>外部平台搜不动时，先回本站换词</strong>
        <span>Google Trends、Pinterest、Amazon 等外部网站的站内搜索可能受登录、地区或反爬影响。请在上方关键词框输入新词，再点击查询趋势；也可以先用当前输入刷新这些验证链接。</span>
      </div>
      <button type="button" data-refresh-verification>用当前输入刷新链接</button>
    </div>
  `;

  const rows = channels.map(([label, description, variant]) => {
    const source = sourceForChannel(label);
    const status = sourceStatusMeta(source?.status || "pending");
    const live = status.tone === "live";
    return {
      label,
      description,
      status,
      variant,
      live,
      url: sourceUrl(label, linkTerm, linkGeo)
    };
  });

  const renderGroup = (title, subtitle, groupRows, tone) => `
    <section class="verification-group verification-group-${tone}">
      <div class="verification-group-head">
        <div>
          <strong>${title}</strong>
          <span>${subtitle}</span>
        </div>
        <em>${groupRows.length} 个</em>
      </div>
      <div class="verification-row-list">
        ${groupRows.map((row) => `
          <a class="source-link ${row.variant === "primary" ? "primary" : ""} status-${row.status.tone}" ${externalOpenAttributes(row.url)}>
            <span class="source-link-main">
              <strong>${escapeHtml(row.label)}</strong>
              <small>${escapeHtml(row.description)}</small>
            </span>
            <span class="source-link-term">${escapeHtml(displayTerm)}</span>
            <em class="source-link-status ${row.status.tone}">${row.live ? "无需人工验证" : row.status.label}</em>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
          </a>
        `).join("")}
      </div>
    </section>
  `;

  const autoRows = rows.filter((row) => row.live);
  const reviewRows = rows.filter((row) => !row.live);
  const trendReview = linkTerm ? manualTrendReviewHtml(linkTerm, linkGeo) : "";
  sourceLinks.innerHTML = helperHtml + trendReview + [
    renderGroup("可自动抓取", "这些平台当前能返回公开推荐词，不需要你逐个打开确认。", autoRows, "auto"),
    renderGroup("需要人工复核", "登录、限流、榜单页或仅跳转来源统一放这里，打开后人工确认即可。", reviewRows, "manual")
  ].join("");
}

const PLATFORM_WORKBENCH_GROUPS = [
  {
    label: "搜索趋势",
    items: [
      { label: "Google Search", sourceLabel: "Google Search", mode: "auto", collect: "搜索框推荐词", role: "搜索需求词" },
      { label: "Google Trends", sourceLabel: "Google Trends", mode: "manual", collect: "相对趋势曲线", role: "季节性复核" },
      { label: "Google News", sourceLabel: "Google News", mode: "auto", collect: "新闻推荐词 / 内容话题", role: "话题信号补充" },
      { label: "Google Ads Keyword Planner", mode: "roadmap", collect: "月搜索量 / 竞争度", role: "可接入广告账号数据" },
      { label: "Bing", sourceLabel: "Bing", mode: "auto", collect: "搜索推荐词", role: "搜索补充" },
      { label: "DuckDuckGo", matcher: /DuckDuckGo/i, mode: "auto", collect: "搜索推荐词", role: "隐私搜索补充" }
    ]
  },
  {
    label: "电商货架",
    items: [
      { label: "Amazon", sourceLabel: "Amazon", mode: "auto", collect: "站内搜索推荐词", role: "购买意图词" },
      { label: "Amazon Best Sellers", sourceLabel: "Amazon Best Sellers", mode: "manual", collect: "热卖榜页面", role: "买单需求复核" },
      { label: "Amazon Movers & Shakers", sourceLabel: "Amazon Movers & Shakers", mode: "manual", collect: "短期上升榜", role: "近期上升复核" },
      { label: "Amazon New Releases", sourceLabel: "Amazon New Releases", mode: "manual", collect: "新品榜页面", role: "新品方向复核" },
      { label: "Amazon Most Wished For", sourceLabel: "Amazon Most Wished For", mode: "manual", collect: "心愿单榜", role: "礼品兴趣复核" },
      { label: "Amazon Brand Analytics", mode: "roadmap", collect: "搜索查询表现", role: "品牌账号可接入" },
      { label: "Google Shopping", sourceLabel: "Google Shopping", mode: "auto", collect: "购物推荐词", role: "购物需求验证" },
      { label: "eBay", sourceLabel: "eBay", mode: "auto", collect: "购物推荐词", role: "复古/二级市场" },
      { label: "Etsy", sourceLabel: "Etsy", mode: "manual", collect: "商品标题 / 风格词", role: "手作礼品验证" },
      { label: "Walmart", sourceLabel: "Walmart", mode: "manual", collect: "货架结果 / 价格带", role: "大卖场验证" },
      { label: "Target", sourceLabel: "Target", mode: "manual", collect: "零售场景图", role: "家居零售验证" },
      { label: "Home Depot", sourceLabel: "Home Depot", mode: "manual", collect: "家装货架", role: "户外/工具场景复核" },
      { label: "Lowe's", sourceLabel: "Lowe's", mode: "manual", collect: "家装货架", role: "户外/工具场景复核" },
      { label: "Wayfair", sourceLabel: "Wayfair", mode: "manual", collect: "家居家具结果", role: "家居场景复核" },
      { label: "AliExpress", sourceLabel: "AliExpress", mode: "manual", collect: "跨境款式/货源", role: "供应链款式参考" },
      { label: "Temu", sourceLabel: "Temu", mode: "manual", collect: "低价货架", role: "价格带风险复核" },
      { label: "SHEIN", sourceLabel: "SHEIN", mode: "manual", collect: "时尚/家居款式", role: "风格趋势参考" }
    ]
  },
  {
    label: "社媒内容",
    items: [
      { label: "TikTok", sourceLabel: "TikTok", mode: "auto", collect: "搜索推荐词", role: "短视频话题" },
      { label: "TikTok Creative Center", sourceLabel: "TikTok Creative Center", mode: "login", collect: "热门 hashtag / 创意", role: "登录后验证" },
      { label: "Pinterest Trends", sourceLabel: "Pinterest Trends", mode: "login", collect: "趋势词 / 图片风格", role: "登录后验证" },
      { label: "Pinterest Predicts", mode: "roadmap", collect: "年度趋势主题", role: "趋势背景资料" },
      { label: "Meta Ads Library", sourceLabel: "Meta Ads Library", mode: "manual", collect: "广告投放搜索", role: "广告买量验证" },
      { label: "Instagram", sourceLabel: "Instagram", mode: "login", collect: "标签语境 / 图片内容", role: "登录后验证" },
      { label: "Facebook", sourceLabel: "Facebook", mode: "login", collect: "公开帖子 / 群组语境", role: "登录后复核" },
      { label: "Facebook Marketplace", sourceLabel: "Facebook Marketplace", mode: "login", collect: "本地交易 / 价格带", role: "登录后复核" },
      { label: "X", sourceLabel: "X", mode: "login", collect: "实时话题 / 吐槽", role: "登录后复核" },
      { label: "Threads", sourceLabel: "Threads", mode: "login", collect: "轻社交讨论", role: "登录后复核" },
      { label: "YouTube", sourceLabel: "YouTube", mode: "auto", collect: "教程 / 测评推荐词", role: "内容需求验证" }
    ]
  },
  {
    label: "社区与接口",
    items: [
      { label: "Reddit", sourceLabel: "Reddit", mode: "login", collect: "帖子标题 / 痛点词", role: "真实用户讨论" },
      { label: "Reddit API", mode: "roadmap", collect: "公开搜索接口", role: "可开发接入" },
      { label: "Google Images", sourceLabel: "Google Images", mode: "auto", collect: "图片推荐词 / 视觉需求", role: "图片验证" },
      { label: "Etsy Open API", mode: "roadmap", collect: "公开商品数据", role: "可开发接入" },
      { label: "Walmart Developer", mode: "roadmap", collect: "Marketplace / Ads API", role: "可开发接入" },
      { label: "Kickstarter", sourceLabel: "Kickstarter", mode: "manual", collect: "众筹新品", role: "新品方向复核" },
      { label: "Product Hunt", sourceLabel: "Product Hunt", mode: "manual", collect: "新品/工具", role: "新兴产品参考" },
      { label: "Quora", sourceLabel: "Quora", mode: "manual", collect: "问答痛点", role: "需求语言复核" },
      { label: "TrendHunter", sourceLabel: "TrendHunter", mode: "manual", collect: "趋势案例", role: "灵感和案例复核" },
      { label: "Exploding Topics", sourceLabel: "Exploding Topics", mode: "manual", collect: "上升主题", role: "趋势背景复核" },
      { label: "Soovle", sourceLabel: "Soovle", mode: "manual", collect: "多平台联想词", role: "人工复核" }
    ]
  }
];

function findWorkbenchSource(item) {
  if (item.sourceLabel) return sourceForChannel(item.sourceLabel);
  if (item.matcher) {
    return (state.sourceCheck?.sources || []).find((source) => item.matcher.test(source.source));
  }
  return null;
}

function workbenchStatus(item, source) {
  if (item.mode === "roadmap") {
    return { label: "建议接入", tone: "roadmap", action: "查看资料" };
  }
  if (!source) {
    const fallback = {
      auto: { label: "待检测", tone: "pending", action: "打开验证" },
      login: { label: "需登录验证", tone: "login", action: "打开登录页" },
      manual: { label: "人工复核", tone: "manual", action: "打开验证" }
    };
    return fallback[item.mode] || fallback.manual;
  }
  const verified = source.status !== "live" ? getVerification(source.source) : null;
  if (verified) {
    const meta = verificationStatusMeta(verified.status);
    return { label: meta.label, tone: verified.status || "verified", action: "重新打开" };
  }
  if (sourceScoringEligible(source)) {
    return { label: "自动采集", tone: "live", action: "打开来源" };
  }
  if (source.status === "live") {
    return { label: "真实复核", tone: "watch", action: "打开来源" };
  }
  if (source.status === "blocked") {
    return { label: "当前受限", tone: "blocked", action: "打开复核" };
  }
  if (item.mode === "login") {
    return { label: "需登录验证", tone: "login", action: "登录后采集" };
  }
  return { label: "人工复核", tone: "manual", action: "打开验证" };
}

function workbenchLink(item, source, data) {
  if (source?.link) return source.link;
  return sourceUrl(item.sourceLabel || item.label, data?.term || termInput.value.trim(), data?.geo || geoInput.value || "US");
}

function renderPlatformWorkbenchLoading() {
  if (!platformWorkbenchGrid) return;
  platformWorkbenchGrid.innerHTML = `<div class="source-data-empty">正在生成平台采集工作台...</div>`;
}

function renderPlatformWorkbench(data = state.sourceCheck) {
  if (!platformWorkbenchGrid) return;
  if (!data) {
    platformWorkbenchGrid.innerHTML = `<div class="source-data-empty">等待关键词查询，生成平台采集状态...</div>`;
    return;
  }

  const flatItems = PLATFORM_WORKBENCH_GROUPS.flatMap((group) => group.items.map((item) => {
    const source = findWorkbenchSource(item);
    const status = workbenchStatus(item, source);
    const scored = sourceScoringEligible(source);
    return { ...item, source, status, scored };
  }));
  const autoCount = flatItems.filter((item) => item.status.tone === "live").length;
  const loginCount = flatItems.filter((item) => item.status.tone === "login").length;
  const manualCount = flatItems.filter((item) => ["manual", "verified", "invalid", "blocked", "watch"].includes(item.status.tone)).length;
  const roadmapCount = flatItems.filter((item) => item.status.tone === "roadmap").length;

  platformWorkbenchGrid.innerHTML = `
    <section class="workbench-summary">
      <article><strong>${autoCount}</strong><span>自动采集</span></article>
      <article><strong>${loginCount}</strong><span>登录验证</span></article>
      <article><strong>${manualCount}</strong><span>人工复核</span></article>
      <article><strong>${roadmapCount}</strong><span>建议接入</span></article>
    </section>
    <section class="workbench-groups">
      ${PLATFORM_WORKBENCH_GROUPS.map((group) => `
        <article class="workbench-group">
          <h3>${escapeHtml(group.label)}</h3>
          <div class="workbench-row-stack">
            ${group.items.map((item) => {
              const source = findWorkbenchSource(item);
              const status = workbenchStatus(item, source);
              const scored = sourceScoringEligible(source);
              const count = source?.items?.length || 0;
              return `
                <div class="workbench-row status-${status.tone}">
                  <div>
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${escapeHtml(item.collect)}</span>
                  </div>
                  <em>${escapeHtml(status.label)}</em>
                  <small>${scored ? "参与评分" : "不进评分"}${count ? ` · ${count}词` : ""}</small>
                  <p>${escapeHtml(item.role)}</p>
                  <a ${externalOpenAttributes(workbenchLink(item, source, data))}>${escapeHtml(status.action)}</a>
                </div>
              `;
            }).join("")}
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function signalGroupEvidence(signals, filter, limit = 6) {
  return signals.filter(filter).slice(0, limit);
}

function renderSignalTaxonomyLoading() {
  if (!signalTaxonomyGrid) return;
  signalTaxonomyGrid.innerHTML = `<div class="source-data-empty">正在拆分搜索、电商、社媒和场景关键词...</div>`;
}

function renderSignalTaxonomy(data = state.sourceCheck) {
  if (!signalTaxonomyGrid) return;
  if (!data) {
    signalTaxonomyGrid.innerHTML = `<div class="source-data-empty">等待实时推荐词分类...</div>`;
    return;
  }

  const signals = collectLiveKeywordSignals(data);
  const groups = [
    {
      label: "搜索需求词",
      desc: "Google / Bing / DuckDuckGo / YouTube 返回的发现型关键词",
      tone: "search",
      items: signalGroupEvidence(signals, (item) => item.sources.some((source) => /Google 输入|Bing|DuckDuckGo|YouTube/i.test(source)))
    },
    {
      label: "电商货架词",
      desc: "Amazon / Google Shopping / eBay 返回的购买型关键词",
      tone: "commerce",
      items: signalGroupEvidence(signals, (item) => item.sources.some((source) => /Amazon|Shopping|eBay/i.test(source)) || item.buyingIntent)
    },
    {
      label: "社媒内容词",
      desc: "适合 TikTok、YouTube、Pinterest、Instagram 继续验证的话题",
      tone: "social",
      items: signalGroupEvidence(signals, (item) => item.sources.some((source) => /TikTok|YouTube/i.test(source)) || /ideas|review|unboxing|tutorial|aesthetic|diy/i.test(item.keyword))
    },
    {
      label: "场景人群词",
      desc: "带空间、用途、人群和套装修饰的细分方向",
      tone: "scene",
      items: signalGroupEvidence(signals, (item) => /for |with |outdoor|indoor|table|door|home|gift|kids|pet|set|pack|bulk|centerpiece|decor/i.test(item.keyword))
    }
  ];

  signalTaxonomyGrid.innerHTML = groups.map((group) => {
    const topHeat = group.items[0]?.heat || 0;
    return `
      <article class="signal-card tone-${group.tone}">
        <div class="signal-head">
          <strong>${escapeHtml(group.label)}</strong>
          <span>${group.items.length ? `${group.items.length} 条` : "待验证"}</span>
        </div>
        <p>${escapeHtml(group.desc)}</p>
        <div class="signal-score"><b>${topHeat || "--"}</b><small>最高信号</small></div>
        <ul>
          ${group.items.length
            ? group.items.map((item) => `
              <li>
                ${keywordTrigger(item.keyword)}
                <em>${item.heat}</em>
              </li>
            `).join("")
            : `<li class="signal-empty">当前自动来源未返回，建议打开登录/复核平台确认。</li>`}
        </ul>
      </article>
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

  seasonalitySummary.textContent = `${sourceText} / ${signal}：${strongest.label}平均趋势指数最高，${weakest.label}最低。`;
  seasonalityGrid.innerHTML = rows.map((row) => {
    const width = Math.max(6, Math.round((row.average / maxAverage) * 100));
    return `
      <article class="season-card">
        <div class="season-head">
          <strong>${row.label}</strong>
          <span>${row.range}</span>
        </div>
        <div class="season-value">${row.average}<small>均值</small></div>
        <div class="season-bar" aria-label="${row.label}平均趋势指数 ${row.average}">
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
  return `https://trends.google.com/trends/explore?date=today%205-y&geo=${encodeURIComponent(geo)}&q=${encodeURIComponent(keyword)}`;
}

function recommendationActionUrl(sourceName, keyword, geo) {
  const name = String(sourceName || "");
  if (/Google Trends/i.test(name)) return sourceUrl("Google Trends", keyword, geo);
  if (/Google Images/i.test(name)) return sourceUrl("Google Images", keyword, geo);
  if (/Google News/i.test(name)) return sourceUrl("Google News", keyword, geo);
  if (/Google Shopping|Shopping/i.test(name)) return sourceUrl("Google Shopping", keyword, geo);
  if (/Google 输入|Google Search|Google 搜索/i.test(name)) return sourceUrl("Google Search", keyword, geo);
  if (/Best Sellers/i.test(name)) return sourceUrl("Amazon Best Sellers", keyword, geo);
  if (/Movers/i.test(name)) return sourceUrl("Amazon Movers & Shakers", keyword, geo);
  if (/New Releases/i.test(name)) return sourceUrl("Amazon New Releases", keyword, geo);
  if (/Most Wished/i.test(name)) return sourceUrl("Amazon Most Wished For", keyword, geo);
  if (/Amazon/i.test(name)) return sourceUrl("Amazon", keyword, geo);
  if (/eBay/i.test(name)) return sourceUrl("eBay", keyword, geo);
  if (/TikTok Creative Center/i.test(name)) return sourceUrl("TikTok Creative Center", keyword, geo);
  if (/TikTok/i.test(name)) return sourceUrl("TikTok", keyword, geo);
  if (/YouTube/i.test(name)) return sourceUrl("YouTube", keyword, geo);
  if (/Bing/i.test(name)) return sourceUrl("Bing", keyword, geo);
  if (/DuckDuckGo/i.test(name)) return sourceUrl("DuckDuckGo", keyword, geo);
  if (/Pinterest/i.test(name)) return sourceUrl("Pinterest Trends", keyword, geo);
  if (/Instagram/i.test(name)) return sourceUrl("Instagram", keyword, geo);
  if (/Facebook Marketplace/i.test(name)) return sourceUrl("Facebook Marketplace", keyword, geo);
  if (/Facebook/i.test(name)) return sourceUrl("Facebook", keyword, geo);
  if (/Reddit/i.test(name)) return sourceUrl("Reddit", keyword, geo);
  if (/Etsy/i.test(name)) return sourceUrl("Etsy", keyword, geo);
  if (/Walmart/i.test(name)) return sourceUrl("Walmart", keyword, geo);
  if (/Target/i.test(name)) return sourceUrl("Target", keyword, geo);
  if (/Home Depot/i.test(name)) return sourceUrl("Home Depot", keyword, geo);
  if (/Lowe/i.test(name)) return sourceUrl("Lowe's", keyword, geo);
  if (/Wayfair/i.test(name)) return sourceUrl("Wayfair", keyword, geo);
  if (/AliExpress/i.test(name)) return sourceUrl("AliExpress", keyword, geo);
  if (/Temu/i.test(name)) return sourceUrl("Temu", keyword, geo);
  if (/SHEIN/i.test(name)) return sourceUrl("SHEIN", keyword, geo);
  if (/Kickstarter/i.test(name)) return sourceUrl("Kickstarter", keyword, geo);
  if (/Product Hunt/i.test(name)) return sourceUrl("Product Hunt", keyword, geo);
  if (/Quora/i.test(name)) return sourceUrl("Quora", keyword, geo);
  if (/TrendHunter/i.test(name)) return sourceUrl("TrendHunter", keyword, geo);
  if (/Exploding Topics/i.test(name)) return sourceUrl("Exploding Topics", keyword, geo);
  if (/Threads/i.test(name)) return sourceUrl("Threads", keyword, geo);
  if (/\bX\b|Twitter/i.test(name)) return sourceUrl("X", keyword, geo);
  return sourceUrl("Google Search", keyword, geo);
}

function keywordSourceTrigger(keyword, sourceName, geo, className = "") {
  return keywordTrigger(keyword, className, recommendationActionUrl(sourceName, keyword, geo || currentInputGeo()));
}

function bestKeywordExternalUrl(item, geo) {
  if (!item) return "";
  if (typeof item === "string") return sourceUrl("Google Search", item, geo || currentInputGeo());
  if (item.link) return item.link;
  if (Array.isArray(item.evidence)) {
    const evidenceLink = item.evidence.find((proof) => proof?.link)?.link;
    if (evidenceLink) return evidenceLink;
  }
  if (Array.isArray(item.links)) {
    const sourceLink = item.links.find((link) => link?.url)?.url;
    if (sourceLink) return sourceLink;
  }
  if (Array.isArray(item.validationLinks)) {
    const nonTrend = item.validationLinks.find((link) => link?.url && !/Google Trends/i.test(link.label || ""));
    if (nonTrend?.url) return nonTrend.url;
    const anyLink = item.validationLinks.find((link) => link?.url)?.url;
    if (anyLink) return anyLink;
  }
  return sourceUrl("Google Search", item.keyword || "", geo || currentInputGeo());
}

function renderRecommendationLoading() {
  relatedRows.innerHTML = `
    <tr>
      <td colspan="3">正在等待实时来源返回推荐词...</td>
    </tr>
  `;
}

function renderLiveRecommendations(data) {
  const visibleRows = collectLiveKeywordSignals(data).slice(0, 36);
  if (!visibleRows.length) {
    relatedRows.innerHTML = `
      <tr>
        <td colspan="3">当前实时来源没有返回推荐词。</td>
      </tr>
    `;
    return;
  }

  relatedRows.innerHTML = visibleRows.map((item) => {
    const primarySource = item.sources?.[0] || "多平台";
    const sourceText = (item.sources || []).slice(0, 4).map((source) => source.replace("推荐词", "").replace("搜索框", "").trim()).join(" / ");
    return `
    <tr>
      <td>
        <span class="channel-chip">${escapeHtml(sourceText || primarySource)}</span>
        <small class="table-source-meta">${item.sourceCount} 源 · ${item.familyCount} 类</small>
      </td>
      <td>
        ${keywordTrigger(item.keyword, "table-keyword-button", recommendationActionUrl(primarySource, item.keyword, data.geo || "US"))}
        ${scorePillsHtml(item)}
      </td>
      <td><button class="row-action keyword-row-action" type="button" data-demand-keyword="${escapeHtml(item.keyword)}">站内分析</button></td>
    </tr>
  `;
  }).join("");
}

function isScoredKeywordSource(sourceName) {
  return /Google 输入|Google Shopping|Google Images|Google News|Bing|DuckDuckGo|Amazon|eBay|TikTok 搜索|YouTube/i.test(String(sourceName || ""));
}

function sourceSignalFamily(sourceName) {
  const name = String(sourceName || "");
  if (/Amazon|Google Shopping|eBay|Etsy|Walmart|Target|Home Depot|Lowe|Wayfair|AliExpress|Temu|SHEIN/i.test(name)) return "购物需求";
  if (/TikTok|YouTube|Google News|Meta Ads|Reddit|Quora|Product Hunt|Kickstarter|TrendHunter|Exploding Topics|Facebook|Instagram|Threads|X Search/i.test(name)) return "内容需求";
  if (/Google Images|Pinterest/i.test(name)) return "视觉需求";
  if (/Google 输入|Bing|DuckDuckGo/i.test(name)) return "搜索需求";
  return "其他信号";
}

function sourceEvidenceType(sourceName, status = "") {
  const name = String(sourceName || "");
  if (/Google Trends|Pinterest Trends/i.test(name)) return "趋势历史信号";
  if (/Amazon|Google Shopping|eBay|Etsy|Walmart|Target|Home Depot|Lowe|Wayfair|AliExpress|Temu|SHEIN/i.test(name)) return "购物需求信号";
  if (/TikTok|YouTube|Pinterest|Instagram|Facebook|Reddit|Google Images|Google News|X Search|Threads|Meta Ads|Quora|Product Hunt|Kickstarter|TrendHunter|Exploding Topics/i.test(name)) return "内容种草信号";
  if (/Google 输入|Google Search|Bing|DuckDuckGo|Soovle/i.test(name)) return "真实推荐词信号";
  if (status === "link-only") return "人工验证入口";
  return "辅助验证信号";
}

function sourceTimeRangeText(sourceName, status = "") {
  const name = String(sourceName || "");
  if (/Google Trends/i.test(name)) return "近 5 年 / 0-100 归一化指数";
  if (/Pinterest Trends/i.test(name)) return "最多近 2 年 / 归一化指数";
  if (/TikTok Creative Center/i.test(name)) return "近 7-120 天 / 平台展示周期";
  if (/autocomplete|Google 输入|Bing|DuckDuckGo|Amazon|eBay|Google Shopping|Google Images|Google News|YouTube|TikTok 搜索|Etsy/i.test(name)) return "当前采集 / 无历史";
  if (/Walmart|Target|Home Depot|Lowe|Wayfair|AliExpress|Temu|SHEIN|Meta Ads|Kickstarter|Product Hunt|Quora|TrendHunter|Exploding Topics/i.test(name)) return "当前页面人工复核";
  if (status === "link-only") return "人工打开页面复核";
  if (status === "blocked") return "当前不可判断";
  return "当前页面信号";
}

function sourceScoringEligible(source) {
  return Boolean(source?.status === "live" && isScoredKeywordSource(source.source) && source.link);
}

function sourceScoringText(source) {
  if (sourceScoringEligible(source)) return "参与评分";
  if (source?.status === "live") return "真实返回但不评分";
  if (source?.status === "link-only") return "仅人工复核";
  return "不参与评分";
}

function sourceCacheText(data, cachedAt) {
  if (cachedAt) return `站内缓存 ${formatVerificationTime(new Date(cachedAt).toISOString())}`;
  if (data?.generatedAt) return "当前会话";
  return "未标记缓存";
}

function sourceRawSummary(source) {
  const count = Array.isArray(source?.items) ? source.items.length : Number(source?.itemCount || 0);
  if (source?.note) return source.note;
  if (count) return `返回 ${count} 条平台推荐词或结果摘要`;
  if (source?.status === "link-only") return "只提供官方页面入口，需人工判断";
  if (source?.status === "blocked") return "平台限制、限流、登录拦截或无结果";
  return "暂无原始摘要";
}

function sourceSignalWeight(sourceName) {
  const family = sourceSignalFamily(sourceName);
  if (family === "购物需求") return 1.08;
  if (family === "搜索需求") return 1;
  if (family === "内容需求") return 0.88;
  if (family === "视觉需求") return 0.78;
  return 0.7;
}

function collectLiveKeywordSignals(data) {
  const buckets = new Map();
  (data?.sources || []).forEach((source) => {
    if (!sourceScoringEligible(source)) return;
    (source.items || []).forEach((item, index) => {
      const keyword = String(item || "").trim();
      if (!keyword) return;
      const key = keyword.toLowerCase();
      if (!buckets.has(key)) {
        buckets.set(key, {
          keyword,
          sources: new Set(),
          families: new Set(),
          bestRank: index + 1,
          score: 0
        });
      }
      const bucket = buckets.get(key);
      bucket.sources.add(source.source);
      bucket.families.add(sourceSignalFamily(source.source));
      bucket.bestRank = Math.min(bucket.bestRank, index + 1);
      bucket.score += Math.max(4, 18 - index * 2) * sourceSignalWeight(source.source);
    });
  });

  const items = Array.from(buckets.values()).map((bucket) => {
    const text = bucket.keyword.toLowerCase();
    const buyingIntent = /(buy|shop|amazon|nearby|for sale|bulk|pack|set|large|small|outdoor|indoor|decoration|decor|ornament|gift|with|holder|centerpiece|waterproof|led|lights|diy|craft|review|best)/i.test(text);
    const modifierCount = (text.match(/\b(for|with|outdoor|indoor|large|small|bulk|pack|set|diy|ideas|decor|decoration|gift|review|best|led|lights)\b/g) || []).length;
    const heat = Math.min(100, Math.round(bucket.score + bucket.sources.size * 6 + bucket.families.size * 10 + Math.max(0, 8 - bucket.bestRank) * 3 + modifierCount * 4 + (buyingIntent ? 12 : 0)));
    return {
      keyword: bucket.keyword,
      heat,
      sourceCount: bucket.sources.size,
      familyCount: bucket.families.size,
      sources: Array.from(bucket.sources),
      families: Array.from(bucket.families),
      buyingIntent,
      bestRank: bucket.bestRank
    };
  }).sort((a, b) => b.heat - a.heat || b.sourceCount - a.sourceCount || a.keyword.localeCompare(b.keyword));

  return items.map((item) => ({
    ...item,
    ...scoreKeywordSignal(item, data)
  }));
}

const TRUST_GRADE_META = {
  A: { label: "A 级强可信", short: "A", className: "trust-a", summary: "趋势历史 + 购物 + 社媒/视觉 + 3 平台以上" },
  B: { label: "B 级可参考", short: "B", className: "trust-b", summary: "至少 2 个平台，且有购物或内容/视觉支持" },
  C: { label: "C 级待验证线索", short: "C", className: "trust-c", summary: "只有单平台或证据不足，放观察池" },
  D: { label: "D 级人工入口", short: "D", className: "trust-d", summary: "只提供链接，需人工复核" },
  E: { label: "E 级不可判断", short: "E", className: "trust-e", summary: "无结果、受限、缓存过期或没有时间数据" }
};

function trendDataUsable(trendData, data) {
  if (Array.isArray(trendData?.series) && trendData.series.length >= 8 && trendData.mode !== "unavailable") return true;
  return (data?.sources || []).some((source) => /Google Trends/i.test(source.source) && source.status === "live" && Array.isArray(source.items) && source.items.length >= 4);
}

function sourceGroupKey(sourceName) {
  const name = String(sourceName || "");
  if (/Google/i.test(name)) return "google";
  if (/Amazon/i.test(name)) return "amazon";
  if (/Bing/i.test(name)) return "bing";
  if (/DuckDuckGo/i.test(name)) return "duckduckgo";
  if (/TikTok/i.test(name)) return "tiktok";
  if (/YouTube/i.test(name)) return "youtube";
  if (/Pinterest/i.test(name)) return "pinterest";
  if (/eBay/i.test(name)) return "ebay";
  if (/Etsy/i.test(name)) return "etsy";
  if (/Reddit/i.test(name)) return "reddit";
  return name.toLowerCase() || "unknown";
}

function familyFlags(families = []) {
  const joined = families.join(" / ");
  return {
    hasShopping: /购物/.test(joined),
    hasSocial: /内容|视觉|社媒/.test(joined),
    hasSearch: /搜索/.test(joined)
  };
}

function gradeFromSignal({ sourceCount = 0, sources = [], families = [], manualOnly = false, blockedOnly = false, hasTrend = false } = {}) {
  const distinctGroups = new Set((sources || []).map(sourceGroupKey)).size || sourceCount;
  const flags = familyFlags(families);
  if (blockedOnly || (!sourceCount && !manualOnly)) return "E";
  if (manualOnly) return "D";
  if (hasTrend && distinctGroups >= 3 && flags.hasShopping && flags.hasSocial) return "A";
  if (distinctGroups >= 2 && (flags.hasShopping || flags.hasSocial)) return "B";
  if (sourceCount >= 1 || distinctGroups >= 1) return "C";
  return "E";
}

function gradeSignalItem(item, trendData = null, sourceData = null) {
  const grade = gradeFromSignal({
    sourceCount: item?.sourceCount || (item?.sources || []).length || 0,
    sources: item?.sources || [],
    families: item?.families || [],
    manualOnly: (item?.sources || []).some((source) => /手动/.test(source)),
    hasTrend: trendDataUsable(trendData, sourceData)
  });
  return { grade, meta: TRUST_GRADE_META[grade] || TRUST_GRADE_META.E };
}

function sourceMatchesKeyword(source, keyword, baseTerm = "") {
  const clean = String(keyword || "").toLowerCase().trim();
  const seed = String(baseTerm || "").toLowerCase().trim();
  if (!clean) return false;
  if (seed && seed === clean && source.status === "live") return true;
  return (source.items || []).some((item) => {
    const text = String(item || "").toLowerCase();
    return text === clean || text.includes(clean) || clean.includes(text);
  });
}

function keywordEvidenceRows(keyword, data) {
  const sources = data?.sources || [];
  const directRows = sources.filter((source) => sourceMatchesKeyword(source, keyword, data?.term));
  const fallbackRows = directRows.length
    ? directRows
    : sources.filter((source) => source.status === "live" && source.link && Array.isArray(source.items) && source.items.length).slice(0, 6);
  return fallbackRows;
}

function gradeKeywordEvidence(keyword, data, trendData = null) {
  const rows = keywordEvidenceRows(keyword, data);
  const scoredRows = rows.filter(sourceScoringEligible);
  const families = Array.from(new Set(scoredRows.map((source) => sourceSignalFamily(source.source))));
  const sources = scoredRows.map((source) => source.source);
  const manualOnly = rows.length > 0 && scoredRows.length === 0 && rows.every((source) => source.status === "link-only");
  const blockedOnly = rows.length > 0 && scoredRows.length === 0 && rows.every((source) => source.status === "blocked");
  const signal = scoreKeywordSignal({
    keyword,
    sources,
    families,
    sourceCount: scoredRows.length,
    heat: scoredRows.reduce((sum, source) => sum + Math.min(12, (source.items || []).length), 0)
  }, data, trendData, { manualOnly, blockedOnly });
  const grade = signal.trustGrade;
  return {
    grade,
    meta: TRUST_GRADE_META[grade] || TRUST_GRADE_META.E,
    sourceCount: scoredRows.length,
    evidenceCount: rows.length,
    families,
    hasTrend: trendDataUsable(trendData, data),
    scoreBreakdown: signal.scoreBreakdown,
    productFilter: signal.productFilter
  };
}

function scoreClamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function isProductSignalKeyword(keyword) {
  return /\b(wreath|decor|decoration|ornament|holder|lights|gift|tree|garland|candle|ribbon|bell|kit|set|pack|sign|mat|pillow|blanket|costume|toy|pet|bbq|grill|centerpiece|sash|bow|hanger|basket|cover|storage|lamp|tray|plush|curtain|tablecloth|runner|cover|stand|rack|organizer|bag|box|jar|cup|mug|plate|tray|banner|flag|stake|picks|spray|stem|beads|velvet|wooden|metal|plastic|ceramic|glass)\b/i.test(String(keyword || ""));
}

function productKeywordFilter(keyword) {
  const text = String(keyword || "").trim().toLowerCase();
  const flags = [];
  if (!text) {
    return { action: "exclude", label: "无关键词", reason: "没有关键词，不能进入选品报告。", flags };
  }
  const checks = [
    { flag: "地点词", pattern: /\b(near me|island|tokyo|london|paris|new york|california|florida|texas|japan|canada|uk|usa)\b/ },
    { flag: "内容词", pattern: /\b(song|songs|music|lyrics|movie|movies|game|games|meme|memes|joke|jokes|quote|quotes|gif|gifs|video|videos|coloring page|coloring pages|worksheet|activity pages?)\b/ },
    { flag: "服务/非购买词", pattern: /\b(rent|rental|rentals|repair|service|services|class|classes|course|courses|job|jobs|careers?|designer|designers?)\b/ },
    { flag: "品牌/版权风险", pattern: /\b(lego|disney|mickey|minnie|star wars|harry potter|pokemon|barbie|nike|grinch|hello kitty|marvel|nintendo)\b/ },
    { flag: "非实物", pattern: /\b(download|digital|clip art|clipart|wallpaper|svg|png|pdf|printable|template|font)\b/ }
  ];
  checks.forEach((check) => {
    if (check.pattern.test(text)) flags.push(check.flag);
  });

  const tutorial = /\b(how to|tutorial|ideas|idea|diy|make|patterns?|free pattern|instructions?)\b/.test(text);
  const convertible = /\b(kit|set|pack|bundle|supplies|materials?|craft kit|tools?)\b/.test(text);
  const product = isProductSignalKeyword(text);
  const productPlus =
    /\b(with|for|outdoor|indoor|front door|porch|table|mantel|large|small|mini|bulk|pack|set|kit|led|waterproof|velvet|wooden|metal|plastic|ceramic|glass|pet|kids|teacher|nurse|gift|party|wedding|christmas|halloween|summer|winter|fall)\b/.test(text);

  if (tutorial && !convertible) flags.push("纯教程/灵感词");
  if (flags.includes("品牌/版权风险")) {
    return { action: "exclude", label: "品牌风险词", reason: `疑似品牌或版权词：${flags.join("、")}，不建议进入亚马逊选品。`, flags };
  }
  if (flags.some((flag) => ["地点词", "内容词", "服务/非购买词", "非实物", "纯教程/灵感词"].includes(flag))) {
    return { action: "exclude", label: "非商品词", reason: `过滤原因：${flags.join("、")}。`, flags };
  }
  if (product && productPlus) {
    return { action: "keep", label: "商品组合词", reason: "包含产品词和材质/场景/人群/功能/节日等修饰，适合进入选品验证。", flags };
  }
  if (product) {
    return { action: "keep", label: "商品词", reason: "包含明确实物商品词，可继续补规格、场景和竞品证据。", flags };
  }
  return { action: "observe", label: "灵感线索", reason: "不是明确商品词，先放灵感池，需转化成产品+场景/材质/功能组合。", flags };
}

function keywordModifierCount(keyword) {
  return (String(keyword || "").toLowerCase().match(/\b(for|with|outdoor|indoor|front|door|table|porch|large|small|mini|bulk|pack|set|diy|ideas|decor|decoration|gift|review|best|led|lights|waterproof|velvet|rustic|farmhouse|vintage)\b/g) || []).length;
}

function signalSourceGroups(sources = []) {
  return new Set((sources || []).map(sourceGroupKey).filter(Boolean));
}

function sourceTrustTier(sourceName, status = "live") {
  const name = String(sourceName || "");
  if (status === "blocked" || status === "no-result") return { tier: "D", label: "D 类未接入/受限" };
  if (/Google Trends|Pinterest Trends|Amazon Best Sellers|Amazon Movers|Amazon New Releases|Amazon Most Wished|D1|历史/i.test(name)) {
    return { tier: "A", label: "A 类历史/榜单证据" };
  }
  if (/Google 输入|Google Search|Google Shopping|Google Images|Google News|Bing|DuckDuckGo|Amazon 美国站|Amazon$|YouTube|eBay/i.test(name) && status === "live") {
    return { tier: "B", label: "B 类实时推荐词" };
  }
  if (/TikTok|Reddit|Instagram|Meta Ads|Etsy|Facebook|Pinterest|Walmart|Target|Home Depot|Lowe|Wayfair|AliExpress|Temu|SHEIN|Kickstarter|Product Hunt|Quora|TrendHunter|Exploding|Soovle|X|Threads/i.test(name)) {
    return { tier: "C", label: "C 类人工复核入口" };
  }
  if (status === "link-only") return { tier: "C", label: "C 类人工复核入口" };
  return { tier: "D", label: "D 类未接入/不可判断" };
}

const MANUAL_TREND_PLATFORMS = [
  {
    platform: "Google Trends 5Y",
    urlLabel: "Google Trends",
    title: "Google Trends 5Y",
    note: "人工判断近 5 年：上升、平稳、季节爆发、下降或无数据。"
  },
  {
    platform: "Pinterest Trends",
    urlLabel: "Pinterest Trends",
    title: "Pinterest Trends",
    note: "人工判断 Pinterest 视觉趋势，通常用于近 2 年设计和场景方向。"
  }
];

function normalizeManualTrendPlatform(platform = "") {
  const value = String(platform || "");
  if (/Pinterest/i.test(value)) return "Pinterest Trends";
  if (/Google Trends/i.test(value)) return "Google Trends 5Y";
  return value.trim() || "Google Trends 5Y";
}

function manualTrendReviewKey(keyword, geo = currentInputGeo(), platform = "Google Trends 5Y") {
  const normalizedPlatform = normalizeManualTrendPlatform(platform).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `trend-radar-manual-trend:${geo}:${normalizedPlatform}:${String(keyword || "").trim().toLowerCase()}`;
}

function localManualTrendReview(keyword, geo = currentInputGeo(), platform = "Google Trends 5Y") {
  try {
    const raw = localStorage.getItem(manualTrendReviewKey(keyword, geo, platform));
    if (raw) return JSON.parse(raw);
    if (/Google Trends/i.test(platform)) {
      const legacyRaw = localStorage.getItem(`trend-radar-manual-trend:${geo}:${String(keyword || "").trim().toLowerCase()}`);
      return legacyRaw ? { ...JSON.parse(legacyRaw), sourcePlatform: "Google Trends 5Y" } : null;
    }
  } catch {
    return null;
  }
  return null;
}

function cloudManualTrendReview(keyword, geo = currentInputGeo(), platform = "Google Trends 5Y") {
  const clean = String(keyword || "").trim().toLowerCase();
  const normalizedPlatform = normalizeManualTrendPlatform(platform);
  const reviews = [
    ...(Array.isArray(state.cloudHistory?.manualReviewRows) ? state.cloudHistory.manualReviewRows : []),
    ...(Array.isArray(state.cloudHistory?.manualVerification) ? state.cloudHistory.manualVerification : [])
  ];
  return reviews.find((item) => {
    const itemKeyword = String(item.keyword || state.cloudHistory?.term || "").trim().toLowerCase();
    const itemPlatform = normalizeManualTrendPlatform(item.sourcePlatform || item.platform || "");
    return itemKeyword === clean && itemPlatform === normalizedPlatform && item.status && item.reviewedAt;
  }) || null;
}

function getManualTrendReview(keyword, geo = currentInputGeo(), platform = "Google Trends 5Y") {
  const local = localManualTrendReview(keyword, geo, platform);
  const cloud = cloudManualTrendReview(keyword, geo, platform);
  if (!local) return cloud;
  if (!cloud) return local;
  const localTime = new Date(local.reviewedAt || local.returnedAt || local.openedAt || 0).getTime();
  const cloudTime = new Date(cloud.reviewedAt || cloud.returnedAt || cloud.openedAt || 0).getTime();
  return cloudTime > localTime ? cloud : local;
}

function setManualTrendReview(keyword, geo, status, note = "", platform = "Google Trends 5Y", sourceUrlValue = "") {
  const normalizedPlatform = normalizeManualTrendPlatform(platform);
  const previous = getManualTrendReview(keyword, geo, normalizedPlatform) || {};
  const review = {
    ...previous,
    keyword,
    geo,
    sourcePlatform: normalizedPlatform,
    platform: normalizedPlatform,
    sourceUrl: sourceUrlValue || previous.sourceUrl || sourceUrl(normalizedPlatform, keyword, geo),
    status,
    note,
    reviewedAt: new Date().toISOString()
  };
  localStorage.setItem(manualTrendReviewKey(keyword, geo, normalizedPlatform), JSON.stringify(review));
  return review;
}

function trendReviewStatusLabel(status) {
  const map = {
    opened: "已打开待判读",
    returned: "已返回待判读",
    rising: "上升",
    stable: "平稳",
    seasonal: "季节爆发",
    declining: "下降",
    no_data: "无数据"
  };
  return map[status] || "待复核";
}

function trendKeywordFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("q") || currentInputTerm();
  } catch {
    return currentInputTerm();
  }
}

function trendGeoFromUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.searchParams.get("geo") || parsed.searchParams.get("country") || currentInputGeo() || "US").toUpperCase();
  } catch {
    return currentInputGeo();
  }
}

function manualTrendPlatformFromUrl(url) {
  try {
    const parsed = new URL(url);
    const hostPath = `${parsed.hostname}${parsed.pathname}`;
    if (/trends\.google\.com\/trends\/explore/i.test(hostPath)) return "Google Trends 5Y";
    if (/trends\.pinterest\.com\/search/i.test(hostPath)) return "Pinterest Trends";
  } catch {
    return "";
  }
  return "";
}

async function saveManualTrendVisit(keyword, geo, status = "opened", note = "", platform = "Google Trends 5Y", sourceUrlValue = "") {
  const clean = String(keyword || "").trim();
  if (!clean) return;
  const normalizedPlatform = normalizeManualTrendPlatform(platform);
  const review = setManualTrendReview(clean, geo || "US", status, note || trendReviewStatusLabel(status), normalizedPlatform, sourceUrlValue);
  try {
    await fetchJson("/api/manual-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 6000,
      body: JSON.stringify({
        keyword: clean,
        geo: geo || "US",
        sourcePlatform: normalizedPlatform,
        status,
        note: note || trendReviewStatusLabel(status)
      })
    });
  } catch (error) {
    console.warn("manual trend visit cloud save failed", error);
  }
  return review;
}

function trackManualTrendOpen(url) {
  const platform = manualTrendPlatformFromUrl(url);
  if (!platform) return false;
  const keyword = trendKeywordFromUrl(url);
  const geo = trendGeoFromUrl(url);
  const pending = {
    keyword,
    geo,
    platform,
    url,
    openedAt: new Date().toISOString()
  };
  sessionStorage.setItem("trend-radar-pending-trend-review", JSON.stringify(pending));
  saveManualTrendVisit(keyword, geo, "opened", `已打开 ${platform}，等待返回后人工选择走势`, platform, url);
  return true;
}

function trackGoogleTrendsOpen(url) {
  return trackManualTrendOpen(url);
}

function markManualTrendReturned() {
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem("trend-radar-pending-trend-review") || "null");
  } catch {
    pending = null;
  }
  if (!pending?.keyword || !pending?.platform) return;
  const openedAt = new Date(pending.openedAt || Date.now()).getTime();
  if (Date.now() - openedAt < 1200) return;
  sessionStorage.removeItem("trend-radar-pending-trend-review");
  const platform = normalizeManualTrendPlatform(pending.platform);
  const previous = getManualTrendReview(pending.keyword, pending.geo, platform) || {};
  const review = {
    ...previous,
    keyword: pending.keyword,
    geo: pending.geo || "US",
    sourcePlatform: platform,
    platform,
    sourceUrl: pending.url || previous.sourceUrl || sourceUrl(platform, pending.keyword, pending.geo),
    status: previous.status && previous.status !== "opened" ? previous.status : "returned",
    note: previous.note || `已从 ${platform} 返回，等待人工选择走势`,
    openedAt: pending.openedAt,
    returnedAt: new Date().toISOString(),
    reviewedAt: previous.reviewedAt || new Date().toISOString()
  };
  localStorage.setItem(manualTrendReviewKey(pending.keyword, pending.geo, platform), JSON.stringify(review));
  saveManualTrendVisit(pending.keyword, pending.geo, review.status, review.note, platform, pending.url);
  if ((state.sourceCheck?.term || currentInputTerm()).toLowerCase() === String(pending.keyword).toLowerCase()) {
    refreshCloudHistory(pending.keyword, pending.geo || currentInputGeo());
  }
}

function markGoogleTrendsReturned() {
  markManualTrendReturned();
}

function scoreBreakdownForSignal({ keyword, sources = [], families = [], sourceCount = 0, signalIndex = 0, hasTrend = false, manualTrend = null, productFilter = null } = {}) {
  const groups = signalSourceGroups(sources);
  const flags = familyFlags(families);
  const filter = productFilter || productKeywordFilter(keyword);
  const tierCounts = sources.reduce((acc, source) => {
    const tier = sourceTrustTier(source).tier;
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});
  const hasManualTrend = Boolean(manualTrend?.status);
  const positiveTrend = ["rising", "stable", "seasonal"].includes(manualTrend?.status);
  const modifierCount = keywordModifierCount(keyword);
  const productBase = filter.action === "keep" ? 64 : filter.action === "observe" ? 38 : 8;

  return {
    recommendationCoverage: scoreClamp(sourceCount * 13 + groups.size * 12 + Math.min(16, signalIndex * 0.16), 0, 100),
    shoppingIntent: scoreClamp((flags.hasShopping ? 52 : 0) + (sources.some((source) => /Amazon/i.test(source)) ? 18 : 0) + (sources.some((source) => /eBay|Shopping|Etsy|Walmart|Target/i.test(source)) ? 18 : 0) + (filter.action === "keep" ? 12 : 0), 0, 100),
    socialContent: scoreClamp((flags.hasSocial ? 48 : 0) + (sources.some((source) => /TikTok|YouTube|Pinterest|Reddit|Instagram|Meta Ads|News|Images/i.test(source)) ? 28 : 0) + Math.min(16, (tierCounts.C || 0) * 5), 0, 100),
    historicalTrend: scoreClamp((hasTrend ? 80 : 0) + (positiveTrend ? 62 : 0) + (hasManualTrend && manualTrend.status === "declining" ? 12 : 0) + (manualTrend?.status === "no_data" ? 0 : 0) + Math.min(28, (tierCounts.A || 0) * 14), 0, 100),
    productFeasibility: scoreClamp(productBase + Math.min(22, modifierCount * 5) + (/\b(led|battery|electric|candle)\b/i.test(keyword) ? -8 : 0), 0, 100)
  };
}

function gradeFromScoreBreakdown(scores = {}, productFilter = null, sourceCount = 0) {
  if (!sourceCount) return "E";
  if (productFilter?.action === "exclude") return "D";
  const weighted = Math.round(
    Number(scores.recommendationCoverage || 0) * 0.22 +
    Number(scores.shoppingIntent || 0) * 0.23 +
    Number(scores.socialContent || 0) * 0.16 +
    Number(scores.historicalTrend || 0) * 0.17 +
    Number(scores.productFeasibility || 0) * 0.22
  );
  if (weighted >= 78 && scores.shoppingIntent >= 45 && scores.productFeasibility >= 60) return "A";
  if (weighted >= 62 && (scores.shoppingIntent >= 45 || scores.socialContent >= 45)) return "B";
  if (weighted >= 42) return "C";
  if (weighted >= 24) return "D";
  return "E";
}

function scoreKeywordSignal(item = {}, data = null, trendData = null, options = {}) {
  const sources = Array.from(new Set(item.sources || []));
  const inferredFamilies = sources.map(sourceSignalFamily).filter(Boolean);
  const families = Array.from(new Set([...(item.families || []), ...inferredFamilies]));
  const sourceCount = Number(item.sourceCount || sources.length || 0);
  const familyCount = Number(item.familyCount || families.length || 0);
  const sourceGroups = signalSourceGroups(sources);
  const flags = familyFlags(families);
  const manualOnly = Boolean(options.manualOnly || (!sourceCount && item.manualOnly));
  const blockedOnly = Boolean(options.blockedOnly);
  const hasTrend = Boolean(options.hasTrend || trendDataUsable(trendData, data));
  const keyword = String(item.keyword || "");
  const signalIndex = scoreClamp(item.signalIndex ?? item.heat ?? item.score ?? 0, 1, 100);
  const productFilter = productKeywordFilter(keyword);
  const manualTrend = getManualTrendReview(keyword, data?.geo || currentInputGeo());
  const scoreBreakdown = scoreBreakdownForSignal({ keyword, sources, families, sourceCount, signalIndex, hasTrend, manualTrend, productFilter });
  const grade = blockedOnly
    ? "E"
    : manualOnly
      ? "D"
      : gradeFromScoreBreakdown(scoreBreakdown, productFilter, sourceCount);
  const hasTrace = sourceCount > 0 && sources.length > 0;
  let credibilityScore = Math.round(
    scoreBreakdown.recommendationCoverage * 0.34 +
    scoreBreakdown.shoppingIntent * 0.22 +
    scoreBreakdown.socialContent * 0.16 +
    scoreBreakdown.historicalTrend * 0.18 +
    (hasTrace ? 10 : 0)
  );
  if (manualOnly) credibilityScore = Math.min(credibilityScore || 35, 45);
  if (blockedOnly) credibilityScore = Math.min(credibilityScore || 15, 25);
  if (sourceCount <= 1 && !hasTrend) credibilityScore = Math.min(credibilityScore, 59);
  if (sourceGroups.size === 1 && sourceGroups.has("google")) credibilityScore = Math.min(credibilityScore, 74);

  let opportunityScore = Math.round(
    scoreBreakdown.shoppingIntent * 0.28 +
    scoreBreakdown.socialContent * 0.18 +
    scoreBreakdown.historicalTrend * 0.12 +
    scoreBreakdown.productFeasibility * 0.32 +
    signalIndex * 0.1
  );
  if (item.buyingIntent) opportunityScore += 5;
  if (productFilter.action === "exclude") opportunityScore = Math.min(opportunityScore, 28);
  if (manualOnly || blockedOnly || grade === "E") opportunityScore = Math.min(opportunityScore, 45);

  return {
    trustGrade: grade,
    trustMeta: TRUST_GRADE_META[grade] || TRUST_GRADE_META.E,
    signalIndex,
    credibilityScore: scoreClamp(credibilityScore),
    opportunityScore: scoreClamp(opportunityScore, 1, 100),
    scoreBreakdown,
    productFilter,
    timeType: classifySignalTimeType(keyword, { sourceCount, sources, families, hasTrend }),
    productAdvice: productAdviceFromKeyword(keyword, families, data?.geo || currentInputGeo())
  };
}

function classifySignalTimeType(keyword, context = {}) {
  const text = String(keyword || "");
  const seasonal = /\b(christmas|xmas|halloween|easter|valentine|thanksgiving|fall|winter|summer|spring|back to school|labor day|mother's day|father's day)\b/i.test(text);
  const contentOnly = (context.families || []).some((family) => /内容|视觉|社媒/.test(family)) && !(context.families || []).some((family) => /购物/.test(family));
  if ((context.sourceCount || 0) <= 1 && !context.hasTrend) return "伪热词/单源线索";
  if (seasonal && context.hasTrend) return "季节爆发型";
  if (seasonal) return "季节候选型";
  if (contentOnly) return "短期内容型";
  if ((context.sourceCount || 0) >= 3) return "新兴上升型";
  return "待观察型";
}

function suggestedListingMonthFor(keyword) {
  const text = String(keyword || "");
  if (/\b(christmas|xmas|holiday|winter)\b/i.test(text)) return "7-8月验证，9-10月备货，11月前完成主图测试";
  if (/\bhalloween\b/i.test(text)) return "6-7月验证，8月备货，9月前完成内容测试";
  if (/\bback to school|teacher|classroom\b/i.test(text)) return "4-5月验证，6月备货，7月前完成上架";
  if (/\bsummer|bbq|barbecue|grill|patio|outdoor\b/i.test(text)) return "1-2月验证，3-4月备货，5月前完成上架";
  if (/\bvalentine\b/i.test(text)) return "9-10月验证，11月备货，12月前完成上架";
  return "先小批量测款，提前8-12周完成页面和素材验证";
}

function productAdviceFromKeyword(keyword, families = [], geo = "US") {
  const q = String(keyword || "").trim();
  const productFilter = productKeywordFilter(q);
  const isDecor = /\b(wreath|decor|decoration|ornament|garland|candle|holder|lights|tree|ribbon|bell|sign|centerpiece|sash|bow)\b/i.test(q);
  const isOutdoor = /\b(outdoor|front door|porch|patio|garden|bbq|grill|yard)\b/i.test(q);
  const isLight = /\b(light|lights|led|electric|battery|candle)\b/i.test(q);
  const direction = isDecor ? "家居/节日装饰产品方向" : isOutdoor ? "户外/庭院/场景用品方向" : "继续拆解规格与场景的产品方向";
  const possibleSpecs = isDecor
    ? "尺寸、颜色、材质、套装数量、是否带灯、是否可压缩包装、门挂/桌面/壁炉场景"
    : isOutdoor
      ? "耐候等级、防水方式、固定方式、尺寸、收纳方式、套装数量"
      : "材质、尺寸、数量、颜色、适用场景、包装方式";
  const variantIdeas = isDecor
    ? "带灯款、无灯款、红/粉/金/自然风格、2/4/6件装、门挂款、桌面中心款"
    : "基础款、加大款、户外耐用款、礼品套装、补充配件包";
  const shouldTest = productFilter.action === "keep"
    ? ((families || []).some((family) => /购物/.test(family)) ? "建议进入小批量测款" : "建议先补购物验证，再小批量测款")
    : productFilter.action === "observe"
      ? "先放灵感池，转成产品+场景词后再测款"
      : "不建议测款";
  return {
    productDirection: direction,
    targetAudience: /\b(christmas|halloween|holiday|gift|party)\b/i.test(q) ? "节日装饰买家、礼品买家、家庭布置用户、内容创作者" : "有明确场景需求的家庭用户、礼品买家、内容种草用户",
    useScenario: isOutdoor ? "front door / porch / patio / yard / party scene" : isDecor ? "front door / mantel / tabletop / indoor decor / gift scene" : "home use / gifting / DIY content / seasonal scene",
    possibleSpecs,
    variantIdeas,
    competitorValidationLinks: ["Amazon", "Amazon Best Sellers", "Amazon Movers & Shakers", "Google Shopping", "eBay", "Etsy"].map((platform) => ({
      platform,
      url: sourceUrl(platform, q, geo)
    })),
    amazonBadReviewAction: `打开 Amazon 搜索 ${q}，筛选同类竞品的1-3星评论，记录材质、尺寸、包装、安装、灯串和退货痛点。`,
    logisticsRisk: isDecor ? "重点检查体积重、压缩包装、易变形、易掉件和旺季破损率。" : "重点检查体积重、套装数量、易碎件和退货成本。",
    complianceRisk: isLight ? "如涉及灯串、电池、LED 或蜡烛，需要核查电池、电器、燃烧安全和平台合规资料。" : "普通装饰类风险较低，但仍需核查儿童用品、食品接触、尖锐件和侵权图案。",
    smallBatchTest: shouldTest,
    suggestedListingMonth: suggestedListingMonthFor(q),
    productFilter
  };
}

function scoreBreakdownHtml(item = {}) {
  const scores = item.scoreBreakdown || {};
  const rows = [
    ["推荐词覆盖", scores.recommendationCoverage],
    ["购物意图", scores.shoppingIntent],
    ["社媒内容", scores.socialContent],
    ["历史趋势", scores.historicalTrend],
    ["选品可行", scores.productFeasibility]
  ];
  return `
    <div class="score-breakdown-grid">
      ${rows.map(([label, value]) => `
        <span><em>${escapeHtml(label)}</em><b>${value ?? "--"}</b></span>
      `).join("")}
    </div>
  `;
}

function scorePillsHtml(item = {}) {
  return `
    <div class="score-pill-row">
      ${trustBadgeHtml({ grade: item.trustGrade || item.grade, meta: item.trustMeta })}
      <span>可信度 ${item.credibilityScore ?? "--"}/100</span>
      <span>机会 ${item.opportunityScore ?? "--"}/100</span>
      <span>${escapeHtml(item.timeType || "待观察型")}</span>
      ${item.productFilter ? `<span>${escapeHtml(item.productFilter.label)}</span>` : ""}
    </div>
  `;
}

function trustBadgeHtml(gradeInfo) {
  const meta = gradeInfo?.meta || TRUST_GRADE_META[gradeInfo?.grade] || TRUST_GRADE_META.E;
  return `<span class="trust-badge ${meta.className}" title="${escapeHtml(meta.summary)}">${escapeHtml(meta.label)}</span>`;
}

function evidenceChainHtml(keyword, data, options = {}) {
  const rows = keywordEvidenceRows(keyword, data);
  const generatedAt = data?.generatedAt ? formatVerificationTime(data.generatedAt) : formatVerificationTime(new Date().toISOString());
  const cache = sourceCacheText(data, options.cachedAt);
  if (!rows.length) {
    return `
      <details class="evidence-chain">
        <summary>证据链：暂无可追溯来源</summary>
        <div class="source-data-empty">没有原始链接或采集时间，本词不参与评分。</div>
      </details>
    `;
  }
  return `
    <details class="evidence-chain">
      <summary>证据链 ${rows.length} 条</summary>
      <div class="evidence-chain-table">
        ${rows.map((source) => {
          const link = source.link || recommendationActionUrl(source.source, keyword, data?.geo || "US");
          const scored = sourceScoringEligible(source);
          const tier = sourceTrustTier(source.source, source.status);
          return `
            <article class="evidence-row ${scored ? "is-scored" : "is-review"}">
              <div><strong>${escapeHtml(source.source)}</strong><span>${escapeHtml(sourceEvidenceType(source.source, source.status))}</span></div>
              <div><span>来源等级</span><strong>${escapeHtml(tier.label)}</strong></div>
              <div><span>关键词</span><strong>${escapeHtml(keyword)}</strong></div>
              <div><span>地区</span><strong>${escapeHtml(data?.geo || "US")}</strong></div>
              <div><span>时间范围</span><strong>${escapeHtml(sourceTimeRangeText(source.source, source.status))}</strong></div>
              <div><span>采集时间</span><strong>${escapeHtml(generatedAt)}</strong></div>
              <div><span>参与评分</span><strong>${escapeHtml(sourceScoringText(source))}</strong></div>
              <div><span>缓存</span><strong>${escapeHtml(cache)}</strong></div>
              <p>${escapeHtml(sourceRawSummary(source))}</p>
              <a ${externalOpenAttributes(link)}>原始链接</a>
            </article>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function evidenceFromHotItem(item) {
  const evidence = item?.evidence || [];
  const families = Array.from(new Set(evidence.map((proof) => proof.family).filter(Boolean)));
  const sources = Array.from(new Set(evidence.map((proof) => proof.source).filter(Boolean)));
  const grade = gradeFromSignal({
    sourceCount: sources.length,
    sources,
    families,
    hasTrend: false
  });
  return { grade, meta: TRUST_GRADE_META[grade] || TRUST_GRADE_META.E, sources, families };
}

function credibilitySummary(data) {
  const signals = collectLiveKeywordSignals(data).slice(0, 80);
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  signals.forEach((item) => {
    const grade = gradeSignalItem(item, null, data).grade;
    counts[grade] = (counts[grade] || 0) + 1;
  });
  const sources = data?.sources || [];
  return {
    counts,
    live: sources.filter((source) => source.status === "live").length,
    scored: sources.filter(sourceScoringEligible).length,
    manual: sources.filter((source) => source.status === "link-only").length,
    blocked: sources.filter((source) => source.status === "blocked").length,
    signalCount: signals.length
  };
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
        const familySet = new Set(matches.flatMap((match) => match.families || []));
        const bestSignal = matches.sort((a, b) => b.heat - a.heat)[0];
        const score = bestSignal
          ? Math.min(100, Math.round(bestSignal.heat + sourceSet.size * 4))
          : Math.max(38, 64 - groupIndex * 3 - candidate.seedRank * 4);
        const rawItem = {
          keyword: candidate.keyword,
          score,
          heat: score,
          sourceCount: sourceSet.size,
          sources: Array.from(sourceSet).slice(0, 4),
          families: Array.from(familySet),
          evidenceType: sourceSet.size ? "平台信号" : "主题延伸",
          url: termActionUrl(candidate.keyword, geo)
        };
        return {
          ...rawItem,
          ...scoreKeywordSignal(rawItem, data, null, { manualOnly: !sourceSet.size })
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
              ${keywordTrigger(item.keyword)}
              <div class="theme-extension-meta">
                <span>${item.score}/100</span>
                <em>${escapeHtml(item.evidenceType)}</em>
              </div>
              ${scorePillsHtml(item)}
              <div class="theme-extension-bar"><span style="width:${Math.max(8, Math.min(100, item.score))}%"></span></div>
              <small>${escapeHtml(item.sources.length ? item.sources.map((source) => source.replace("推荐词", "").replace("搜索框", "").trim()).join(" / ") : "建议跳转验证")}</small>
            </li>
          `).join("")}
        </ul>
      </article>
    `).join("")}
  `;
}

function insightRuleMatches(rule, item) {
  const keyword = String(item.keyword || "");
  const patternMatch = (rule.patterns || []).some((pattern) => pattern.test(keyword));
  const familyMatch = (rule.families || []).some((family) => (item.families || []).includes(family));
  const sourceMatch = (rule.sourcePatterns || []).some((pattern) => (item.sources || []).some((source) => pattern.test(source)));
  return patternMatch || familyMatch || sourceMatch;
}

function insightMatchScore(rule, item, index) {
  const familyBonus = (item.families || []).length * 5;
  const sourceBonus = (item.sourceCount || 0) * 4;
  const buyingBonus = item.buyingIntent ? 8 : 0;
  return (item.heat || 0) + sourceBonus + familyBonus + buyingBonus + (rule.weight || 0) - index * 2;
}

function selectInsightEvidence(matches, used, limit = 3) {
  const selected = [];
  const sorted = [...matches].sort((a, b) => insightMatchScore({}, b, 0) - insightMatchScore({}, a, 0));

  sorted.forEach((item) => {
    if (selected.length >= limit) return;
    const key = item.keyword.toLowerCase();
    if (used.has(key)) return;
    const tooSimilar = selected.some((chosen) => keywordOverlapScore(chosen.keyword, item.keyword) >= 4);
    if (!tooSimilar) selected.push(item);
  });

  sorted.forEach((item) => {
    if (selected.length >= limit) return;
    const key = item.keyword.toLowerCase();
    if (used.has(key) || selected.some((chosen) => chosen.keyword.toLowerCase() === key)) return;
    selected.push(item);
  });

  selected.forEach((item) => used.add(item.keyword.toLowerCase()));
  return selected.map((item) => item.keyword);
}

function buildInsightSection(rules, merged, maxItems, fallbackKind, sharedUsed) {
  const used = sharedUsed || new Set();
  const ranked = rules
    .map((rule) => {
      const matches = merged.filter((item) => insightRuleMatches(rule, item));
      const score = matches.reduce((sum, item, index) => sum + insightMatchScore(rule, item, index), 0);
      return { rule, matches, score };
    })
    .filter((item) => item.matches.length)
    .sort((a, b) => b.score - a.score || b.matches.length - a.matches.length);

  const selected = [];
  ranked.forEach(({ rule, matches }) => {
    if (selected.length >= maxItems) return;
    const evidence = selectInsightEvidence(matches, used, 3);
    if (!evidence.length) return;
    selected.push({
      label: rule.label,
      reason: rule.reason,
      tip: rule.tip,
      evidence
    });
  });

  if (selected.length < Math.min(3, maxItems)) {
    const fallbackPool = merged.filter((item) => !used.has(item.keyword.toLowerCase()));
    (fallbackPool.length ? fallbackPool : merged)
      .sort((a, b) => b.heat - a.heat || b.sourceCount - a.sourceCount)
      .slice(0, maxItems - selected.length)
      .forEach((item) => {
        used.add(item.keyword.toLowerCase());
        const keyword = item.keyword.length > 34 ? `${item.keyword.slice(0, 31)}...` : item.keyword;
        selected.push({
          label: fallbackKind === "audience" ? `关注「${keyword}」的人群` : fallbackKind === "scene" ? `围绕「${keyword}」的场景` : `围绕「${keyword}」的切入点`,
          reason: fallbackKind === "audience" ? "该词来自本次实时推荐词，代表可继续观察的搜索人群。" : undefined,
          tip: fallbackKind === "angle" ? "先打开站内多平台需求走势，再决定是否做标题、图片或变体测试。" : undefined,
          evidence: [item.keyword]
        });
      });
  }

  return selected.slice(0, maxItems);
}

function buildOpportunityInsights(data, manualTerms = "") {
  const signals = collectLiveKeywordSignals(data);
  const manualSignals = manualTerms
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .map((keyword) => {
      const rawItem = {
        keyword,
        heat: 45,
        sourceCount: 0,
        sources: ["手动输入"],
        families: ["手动输入"],
        buyingIntent: true,
        bestRank: 99
      };
      return { ...rawItem, ...scoreKeywordSignal(rawItem, data, null, { manualOnly: true }) };
    });
  const merged = [...signals, ...manualSignals].filter((item, index, arr) =>
    arr.findIndex((candidate) => candidate.keyword.toLowerCase() === item.keyword.toLowerCase()) === index
  ).map((item) => {
    if (item.credibilityScore !== undefined && item.opportunityScore !== undefined) return item;
    return { ...item, ...scoreKeywordSignal(item, data) };
  });
  const baseTerm = data?.term || termInput.value.trim() || "";
  const productReady = merged.filter((item) => item.productFilter?.action !== "exclude");
  const recommendationPool = productReady.filter((item) => ["A", "B"].includes(item.trustGrade));
  const observationPool = productReady.filter((item) => item.trustGrade === "C" || item.productFilter?.action === "observe");
  const insightPool = recommendationPool.length ? recommendationPool : observationPool;

  const highIntent = insightPool
    .filter((item) => (item.buyingIntent || item.sourceCount >= 2) && item.productFilter?.action !== "exclude")
    .slice(0, 8);

  const audienceRules = [
    { label: "门饰/门廊布置买家", patterns: [/front door|door|porch|entryway|outdoor/i], reason: "搜索集中在门口、门廊或户外展示，通常更在意尺寸、挂法和远看效果。", weight: 18 },
    { label: "花环配饰升级买家", patterns: [/sash|ribbon|bow|hanger|hook|wreath ring/i], reason: "本次结果出现配饰型修饰词，说明用户可能不是只买花环，也在找升级配件。", weight: 17 },
    { label: "DIY 手作/素材包人群", patterns: [/diy|craft|crafts|how to|tutorial|make|ideas/i], reason: "会搜索做法、灵感和材料包，适合观察半成品、套装和教程内容。", weight: 15 },
    { label: "节日灵感/布置内容受众", patterns: [/ideas|decorating|aesthetic|inspiration|theme/i], families: ["内容需求", "视觉需求"], reason: "更多是在找图片灵感、布置方案和内容参考，适合用场景图验证。", weight: 12 },
    { label: "电商购买确认人群", patterns: [/amazon|best|buy|shop|near me|for sale/i], families: ["购物需求"], reason: "购物平台信号更强，用户更接近比价、选款和下单阶段。", weight: 11 },
    { label: "成套采购/批量布置人群", patterns: [/set|pack|bulk|kit|bundle|12 pack|4 pack|lot/i], reason: "搜索里出现数量和套装词，适合测试组合装、补充件和多件装。", weight: 10 },
    { label: "家庭/送礼场景用户", patterns: [/gift|family|kids|mom|teacher|stocking|home/i], reason: "更偏家庭布置或送礼对象，适合强调安全、包装和易安装。", weight: 8 },
    { label: "宠物家庭用户", patterns: [/pet|dog|cat|puppy|kitten|animal/i], reason: "如果宠物词出现，需要关注安全性、耐咬耐拉和室内外使用。", weight: 8 }
  ];

  const sceneRules = [
    { label: "前门/门廊/户外布置", patterns: [/front door|door|porch|entryway|outdoor|yard|window/i], weight: 18 },
    { label: "花环丝带/挂饰替换", patterns: [/sash|ribbon|bow|hanger|hook|wreath ring/i], weight: 16 },
    { label: "餐桌/蜡烛/中心装饰", patterns: [/table|centerpiece|mantel|fireplace|candle|holder|ring/i], weight: 13 },
    { label: "DIY 教程/素材包", patterns: [/diy|craft|crafts|tutorial|how to|make|ideas/i], weight: 12 },
    { label: "社媒图片/短视频内容", patterns: [/ideas|decorating|aesthetic|review|unboxing|tiktok|youtube/i], families: ["内容需求", "视觉需求"], weight: 10 },
    { label: "节日礼品/套装组合", patterns: [/gift|set|pack|bulk|box|ornament|kit|bundle/i], weight: 10 },
    { label: "灯光氛围升级", patterns: [/led|light|lights|battery|fairy|glow|candle/i], weight: 9 },
    { label: "宠物/家庭安全场景", patterns: [/pet|dog|cat|kids|family|safe|indoor/i], weight: 8 }
  ];

  const angleRules = [
    { label: "配饰差异化", patterns: [/sash|ribbon|bow|hanger|hook/i], tip: "可以测试花环配饰、可拆卸蝴蝶结、门挂固定件或替换装。", weight: 18 },
    { label: "前门适配卖点", patterns: [/front door|door|porch|outdoor|hanger/i], tip: "补充门宽、挂法、防刮门面、远看比例和户外使用图。", weight: 16 },
    { label: "DIY 材料包/教程图", patterns: [/diy|craft|crafts|tutorial|how to|make/i], tip: "适合加入步骤图、材料包清单、改造前后对比。", weight: 14 },
    { label: "内容图/场景图营销", patterns: [/ideas|decorating|aesthetic|theme|inspiration/i], families: ["内容需求", "视觉需求"], tip: "把图片做成门廊、客厅、餐桌、壁炉等可直接照搬的场景。", weight: 12 },
    { label: "灯光/氛围升级", patterns: [/led|lights|light|battery|candle|glow|fairy/i], tip: "强调夜间氛围、暖光、可替换电池和拍照效果。", weight: 11 },
    { label: "套装/数量变体", patterns: [/set|pack|bulk|kit|bundle|4 pack|12 pack|mini|large|small/i], tip: "可做数量、尺寸、颜色、配件组合的变体测试。", weight: 10 },
    { label: "户外耐用/防水", patterns: [/outdoor|waterproof|weather|yard|porch/i], tip: "强化耐候、防水、防掉落、包装抗压等信息。", weight: 9 },
    { label: "风格细分", patterns: [/rustic|farmhouse|vintage|red|green|white|gold|aesthetic/i], tip: "按风格词拆图和标题，避免所有圣诞词都挤在同一卖点。", weight: 8 }
  ];

  const sharedInsightEvidence = new Set();
  const audiences = buildInsightSection(audienceRules, insightPool, 4, "audience", sharedInsightEvidence);
  const scenes = buildInsightSection(sceneRules, insightPool, 5, "scene", sharedInsightEvidence);
  const angles = buildInsightSection(angleRules, insightPool, 5, "angle", sharedInsightEvidence);

  return {
    baseTerm,
    platformCount: (data?.sources || []).filter((source) => source.status === "live").length,
    signalCount: signals.length,
    recommendationCount: recommendationPool.length,
    observationCount: observationPool.length,
    highIntent,
    audiences,
    scenes,
    angles
  };
}

function renderInsightLoading() {
  compareList.innerHTML = `<div class="source-data-empty">等待多平台推荐词，生成可执行选品建议...</div>`;
}

function renderOpportunityInsights(data = state.sourceCheck) {
  if (!data) {
    renderInsightLoading();
    return;
  }

  const insights = buildOpportunityInsights(data, compareInput.value || "");
  const leadOpportunity = insights.highIntent[0] || null;
  const leadAdvice = leadOpportunity
    ? (leadOpportunity.productAdvice || productAdviceFromKeyword(leadOpportunity.keyword, leadOpportunity.families, data.geo || "US"))
    : null;
  const trendWindowText = leadAdvice?.suggestedListingMonth || "先补 Google Trends 5Y / Pinterest Trends 人工复核，再判断上架窗口。";
  const topAudience = insights.audiences[0];
  const topScene = insights.scenes[0];
  const topAngle = insights.angles[0];
  const insightHeroCards = [
    {
      title: "人群画像",
      value: topAudience?.label || "待识别人群",
      text: topAudience?.reason || "先观察推荐词是否出现明确人群、用途或购物对象。",
      evidence: topAudience?.evidence || []
    },
    {
      title: "使用场景",
      value: topScene?.label || "待验证场景",
      text: topScene?.reason || topScene?.tip || "优先用 Google Images / Pinterest / TikTok 验证真实使用画面。",
      evidence: topScene?.evidence || []
    },
    {
      title: "趋势与窗口",
      value: trendWindowText,
      text: "当前不是自动历史趋势结论；需要打开 Google Trends 5Y 复核上升、平稳、季节爆发或无数据。",
      evidence: leadOpportunity ? [leadOpportunity.keyword] : []
    },
    {
      title: "未来方向",
      value: topAngle?.label || "先转成产品方向",
      text: topAngle?.tip || "把热词拆成产品规格、主图场景、套装数量和内容验证动作。",
      evidence: topAngle?.evidence || []
    }
  ];
  const insightHeroHtml = insightHeroCards.map((card) => `
    <article class="insight-focus-card">
      <span>${escapeHtml(card.title)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <p>${escapeHtml(card.text)}</p>
      ${card.evidence.length ? `<div>${card.evidence.slice(0, 3).map((keyword) => keywordTrigger(keyword, "evidence-keyword-button")).join("")}</div>` : ""}
    </article>
  `).join("");
  const highKeywords = insights.highIntent.length
    ? insights.highIntent.slice(0, 6).map((item) => {
      const advice = item.productAdvice || productAdviceFromKeyword(item.keyword, item.families, data.geo || "US");
      return `
      <article class="insight-keyword-card">
        ${keywordTrigger(item.keyword, "insight-keyword-button")}
        <span>${escapeHtml(item.trustGrade || "C")}级 · ${item.sourceCount || "手动"} 个来源 · ${escapeHtml(advice.productDirection)}</span>
        <div class="mini-bar"><span style="width:${Math.max(8, Math.min(100, item.heat))}%"></span></div>
      </article>
    `;
    }).join("")
    : `<div class="source-data-empty">还没有足够的高意图关键词。</div>`;

  const opportunityCards = insights.highIntent.length
    ? insights.highIntent.slice(0, 4).map((item) => {
      const advice = item.productAdvice || productAdviceFromKeyword(item.keyword, item.families, data.geo || "US");
      const links = (advice.competitorValidationLinks || []).slice(0, 5).map((link) => `
        <a ${externalOpenAttributes(link.url)}>${escapeHtml(link.platform)}</a>
      `).join("");
      const scores = item.scoreBreakdown || {};
      return `
        <article class="opportunity-card">
          <div class="opportunity-card-head">
            <div>
              ${keywordTrigger(item.keyword, "opportunity-keyword-button")}
              <div class="opportunity-chip-row">
                <span>${escapeHtml(item.trustGrade || "C")} 级参考</span>
                <span>可信度 ${item.credibilityScore ?? "--"}/100</span>
                <span>${escapeHtml(item.productFilter?.label || advice.productFilter?.label || "待判断")}</span>
              </div>
            </div>
            <strong><b>${item.opportunityScore ?? "--"}</b><small>机会</small></strong>
          </div>
          <div class="opportunity-score-strip">
            <span><b>${scores.recommendationCoverage ?? "--"}</b><em>推荐词</em></span>
            <span><b>${scores.shoppingIntent ?? "--"}</b><em>购物意图</em></span>
            <span><b>${scores.socialContent ?? "--"}</b><em>社媒内容</em></span>
            <span><b>${scores.historicalTrend ?? "--"}</b><em>历史趋势</em></span>
            <span><b>${scores.productFeasibility ?? "--"}</b><em>选品可行</em></span>
          </div>
          <dl class="opportunity-advice-list compact">
            <div><dt>产品方向</dt><dd>${escapeHtml(advice.productDirection)}</dd></div>
            <div><dt>目标人群/场景</dt><dd>${escapeHtml(advice.targetAudience)} · ${escapeHtml(advice.useScenario)}</dd></div>
            <div><dt>未来方向</dt><dd>${escapeHtml(advice.variantIdeas || "基础款、套装款、场景款")}；${escapeHtml(advice.suggestedListingMonth)}</dd></div>
          </dl>
          <details class="opportunity-details">
            <summary>展开验证动作与风险</summary>
            <dl class="opportunity-advice-list">
              <div><dt>过滤判断</dt><dd>${escapeHtml(item.productFilter?.reason || advice.productFilter?.reason || "继续补证据")}</dd></div>
              <div><dt>可能规格</dt><dd>${escapeHtml(advice.possibleSpecs || "尺寸、材质、数量、颜色、场景")}</dd></div>
              <div><dt>差评验证</dt><dd>${escapeHtml(advice.amazonBadReviewAction)}</dd></div>
              <div><dt>物流/合规</dt><dd>${escapeHtml(advice.logisticsRisk)} ${escapeHtml(advice.complianceRisk)}</dd></div>
              <div><dt>测款建议</dt><dd>${escapeHtml(advice.smallBatchTest)}</dd></div>
            </dl>
          </details>
          <div class="opportunity-verify-links">${links}</div>
        </article>
      `;
    }).join("")
    : `<div class="source-data-empty">A/B 级机会不足，先放观察池，继续补购物和社媒证据。</div>`;

  const nextActionForInsight = (title) => {
    if (title.includes("人群")) return "下一步：把这些词拿到 Amazon 评论、Reddit、TikTok 搜索里看具体痛点和说法。";
    if (title.includes("场景")) return "下一步：用 Google Images / Pinterest / TikTok 验证真实使用图、布置方式和拍摄角度。";
    return "下一步：把切入点拆成标题词、主图场景、套装规格或变体测试。";
  };

  const renderInsightGroup = (title, items, emptyText) => `
    <section class="insight-group">
      <h3>${escapeHtml(title)}</h3>
      ${items.length ? items.map((item) => `
        <div class="insight-row">
          <strong>${escapeHtml(item.label)}</strong>
          ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}
          ${item.tip ? `<p>${escapeHtml(item.tip)}</p>` : ""}
          <small>${escapeHtml(nextActionForInsight(title))}</small>
          <small>依据：</small>
          <div class="insight-evidence-tags">${item.evidence.map((keyword) => keywordTrigger(keyword, "evidence-keyword-button")).join("")}</div>
        </div>
      `).join("") : `<div class="source-data-empty">${escapeHtml(emptyText)}</div>`}
    </section>
  `;

  compareList.innerHTML = `
    <div class="insight-summary">
      <strong>${escapeHtml(insights.baseTerm || "当前关键词")}</strong>
      <span>${insights.platformCount} 个实时平台 · ${insights.signalCount} 条推荐词信号 · ${insights.recommendationCount} 个 A/B 建议词 · ${insights.observationCount} 个 C 级观察词 · 不是销量预测</span>
    </div>
    <section class="insight-group insight-focus-group">
      <h3>先看判断结论</h3>
      <div class="insight-focus-grid">${insightHeroHtml}</div>
    </section>
    <section class="insight-group">
      <h3>选品机会卡</h3>
      <div class="opportunity-card-grid">${opportunityCards}</div>
    </section>
    <section class="insight-group">
      <h3>高意图关键词</h3>
      <div class="insight-keyword-grid">${highKeywords}</div>
    </section>
    ${renderInsightGroup("人群与买家线索", insights.audiences, "暂未识别到明确人群信号。")}
    ${renderInsightGroup("使用场景线索", insights.scenes, "暂未识别到明确场景信号。")}
    ${renderInsightGroup("趋势与未来方向", insights.angles, "暂未识别到明确切入点。")}
  `;
}

const PLATFORM_HEAT_META = [
  { key: "google", label: "Google 搜索", match: (name) => name.includes("Google 输入"), color: "#0f8a8a" },
  { key: "shopping", label: "Google Shopping", match: (name) => name.includes("Shopping"), color: "#2563eb" },
  { key: "images", label: "Google Images", match: (name) => name.includes("Google Images"), color: "#7c3aed" },
  { key: "news", label: "Google News", match: (name) => name.includes("Google News"), color: "#d97706" },
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
  platformHeatGrid.innerHTML = `<div class="source-data-empty">正在计算不同平台推荐词信号指数...</div>`;
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
    .filter((source) => sourceScoringEligible(source) && Array.isArray(source.items) && source.items.length)
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
    platformHeatGrid.innerHTML = `<div class="source-data-empty">当前没有可计分的实时平台推荐词，不能生成推荐词信号指数。</div>`;
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
            <a class="status-${status.tone}" ${externalOpenAttributes(source.link)}>
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
        <span>${escapeHtml(sourceEvidenceType(source.source, source.status))}</span>
      </div>
      <div class="platform-heat-score">
        <b>${source.score}</b>
        <small>/ 100</small>
      </div>
      <div class="platform-heat-bar" aria-label="${escapeHtml(source.platformLabel)} 推荐词信号 ${source.score}">
        <span style="width:${Math.max(6, Math.min(100, source.score))}%"></span>
      </div>
      <div class="platform-heat-terms">
        ${source.topItems.map((item) => keywordSourceTrigger(item, source.source, data.geo || "US", "compact-keyword-button")).join("")}
      </div>
      <small class="platform-source-note">${escapeHtml(sourceTimeRangeText(source.source, source.status))} · ${escapeHtml(sourceScoringText(source))}</small>
      <a ${externalOpenAttributes(source.link || recommendationActionUrl(source.source, data.term, data.geo || "US"))}>打开验证</a>
    </article>
  `).join("") + verificationHtml;
}

function hotDiscoveryLevel(score) {
  const value = Number(score) || 0;
  if (value >= 85) return "hot";
  if (value >= 68) return "strong";
  if (value >= 50) return "watch";
  return "weak";
}

function shortDiscoverySource(source) {
  return String(source || "")
    .replace("输入框推荐词", "搜索")
    .replace("搜索框推荐词", "搜索")
    .replace("美国站推荐词", "美国站")
    .replace("推荐词", "")
    .trim();
}

function renderHotDiscoveryLoading(term) {
  if (!hotDiscoveryGrid) return;
  hotDiscoveryGrid.innerHTML = `
    <div class="source-data-empty">正在围绕 ${escapeHtml(term)} 扩展搜索种子，并抓取 Google、Amazon、TikTok、YouTube 等公开推荐词...</div>
  `;
}

function renderHotDiscoveryError(message) {
  if (!hotDiscoveryGrid) return;
  hotDiscoveryGrid.innerHTML = `<div class="source-data-empty">跨平台热词发现失败：${escapeHtml(message)}</div>`;
}

function renderHotDiscovery(data) {
  if (!hotDiscoveryGrid) return;
  const candidates = data.candidates || [];
  const liveSources = (data.sources || []).filter((source) => source.status === "live");
  const normalizedText = data.normalizedTerm && data.normalizedTerm !== data.term
    ? `<span>已把 ${escapeHtml(data.term)} 转成美国站查询词 ${escapeHtml(data.normalizedTerm)}</span>`
    : `<span>美国站查询词：${escapeHtml(data.normalizedTerm || data.term || "--")}</span>`;

  if (!candidates.length) {
    const fallbackSeedHtml = (data.querySeeds || []).slice(0, 14).map((seed) => `
      <button class="hot-seed-chip" type="button" data-demand-keyword="${escapeHtml(seed)}">${escapeHtml(keywordDisplayLabel(seed))}</button>
    `).join("");
    hotDiscoveryGrid.innerHTML = `
      <section class="hot-discovery-summary">
        <article><strong>0</strong><span>交叉验证热词</span></article>
        <article><strong>${liveSources.length}</strong><span>可用来源</span></article>
        <article><strong>${(data.querySeeds || []).length}</strong><span>搜索种子</span></article>
      </section>
      <div class="source-data-empty">没有抓到足够的交叉验证热词。下面先给出系统扩展的搜索种子，建议点击后到对应平台复核。</div>
      ${fallbackSeedHtml ? `
        <section class="hot-seed-strip">
          <strong>待验证搜索方向</strong>
          <div>${fallbackSeedHtml}</div>
        </section>
      ` : ""}
    `;
    return;
  }

  const seedHtml = (data.querySeeds || []).slice(0, 12).map((seed) => `
    <button class="hot-seed-chip" type="button" data-demand-keyword="${escapeHtml(seed)}">${escapeHtml(keywordDisplayLabel(seed))}</button>
  `).join("");

  const sourceHtml = liveSources.slice(0, 8).map((source) => `
    <span>${escapeHtml(shortDiscoverySource(source.source))}<em>${Number(source.itemCount || 0)}</em></span>
  `).join("");

  const cards = candidates.slice(0, 18).map((item) => {
    const level = hotDiscoveryLevel(item.score);
    const gradeInfo = evidenceFromHotItem(item);
    const scoredItem = {
      keyword: item.keyword,
      heat: item.score,
      sourceCount: gradeInfo.sources.length,
      sources: gradeInfo.sources,
      families: gradeInfo.families,
      buyingIntent: true,
      ...scoreKeywordSignal({
        keyword: item.keyword,
        heat: item.score,
        sourceCount: gradeInfo.sources.length,
        sources: gradeInfo.sources,
        families: gradeInfo.families,
        buyingIntent: true
      }, data)
    };
    const evidence = (item.evidence || []).slice(0, 4).map((proof) => `
      <li>
        <strong>${escapeHtml(shortDiscoverySource(proof.source))}</strong>
        <span>${escapeHtml(proof.family)} · seed: ${escapeHtml(proof.seed)} · #${proof.rank}</span>
      </li>
    `).join("");
    const links = (item.validationLinks || []).slice(0, 4).map((link) => `
      <a ${externalOpenAttributes(link.url)}>${escapeHtml(link.label)}</a>
    `).join("");
    return `
      <article class="hot-keyword-card heat-${level}">
        <div class="hot-keyword-head">
          <div>
            ${keywordTrigger(item.keyword, "hot-keyword-button", bestKeywordExternalUrl(item, data.geo || "US"))}
            <span>${escapeHtml(item.category)} · ${escapeHtml(sourceTimeRangeText("autocomplete"))}</span>
          </div>
          <em>${Math.round(item.score)}</em>
        </div>
        ${scorePillsHtml(scoredItem)}
        <div class="hot-keyword-bar"><span style="width:${Math.max(6, Math.min(100, item.score))}%"></span></div>
        <div class="hot-source-badges">
          ${(item.families || []).slice(0, 4).map((family) => `<span>${escapeHtml(family)}</span>`).join("")}
        </div>
        <ul class="hot-evidence-list">${evidence}</ul>
        <details class="evidence-chain compact">
          <summary>证据链 ${gradeInfo.sources.length || 0} 个来源</summary>
          <div class="evidence-chain-table">
            ${(item.evidence || []).slice(0, 8).map((proof) => `
              <article class="evidence-row is-scored">
                <div><strong>${escapeHtml(proof.source)}</strong><span>${escapeHtml(proof.family)}</span></div>
                <div><span>地区</span><strong>${escapeHtml(data.geo || "US")}</strong></div>
                <div><span>时间范围</span><strong>当前采集 / 无历史</strong></div>
                <div><span>采集时间</span><strong>${escapeHtml(data.generatedAt ? formatVerificationTime(data.generatedAt) : formatVerificationTime(new Date().toISOString()))}</strong></div>
                <div><span>参与评分</span><strong>参与评分</strong></div>
                <p>seed: ${escapeHtml(proof.seed)} · 平台返回排名 #${escapeHtml(proof.rank)}</p>
                <a ${externalOpenAttributes(proof.link || recommendationActionUrl(proof.source, item.keyword, data.geo || "US"))}>原始链接</a>
              </article>
            `).join("")}
          </div>
        </details>
        <div class="hot-verify-links">${links}</div>
      </article>
    `;
  }).join("");

  hotDiscoveryGrid.innerHTML = `
    <section class="hot-discovery-summary">
      <article><strong>${candidates.length}</strong><span>${data.strictCrossVerified ? "交叉验证热词" : "待复核热词"}</span></article>
      <article><strong>${liveSources.length}</strong><span>真实自动来源</span></article>
      <article><strong>${(data.querySeeds || []).length}</strong><span>扩展搜索种子</span></article>
    </section>
    <section class="hot-discovery-proof">
      <div>
        <strong>数据证明</strong>
        ${normalizedText}
        <small>${escapeHtml(data.note || "分数来自公开推荐词来源覆盖、排名和意图词；不是官方搜索量，也不是销量。")}</small>
      </div>
      <div class="hot-source-stack">${sourceHtml}</div>
    </section>
    <section class="hot-seed-strip">
      <strong>本次自动搜索种子</strong>
      <div>${seedHtml}</div>
    </section>
    <section class="hot-keyword-grid">${cards}</section>
  `;
}

async function runHotKeywordDiscovery(term, geo) {
  if (!hotDiscoveryGrid) return;
  const clean = String(term || "").trim();
  if (!clean) {
    hotDiscoveryGrid.innerHTML = `<div class="source-data-empty">等待输入关键词后自动发现相关热词。</div>`;
    return;
  }
  renderHotDiscoveryLoading(clean);
  try {
    const data = await fetchJson(`/api/hot-keywords?term=${encodeURIComponent(clean)}&geo=${encodeURIComponent(geo || "US")}`, { timeoutMs: 17000 });
    renderHotDiscovery(data);
  } catch (error) {
    renderHotDiscoveryError(error.message);
  }
}

function socialRadarLevelText(value) {
  const score = Number(value) || 0;
  if (score >= 85) return "高热";
  if (score >= 65) return "强信号";
  if (score >= 45) return "可观察";
  return "待复核";
}

function socialPlatformStatus(status) {
  const map = {
    auto: { label: "自动采集", tone: "auto" },
    manual: { label: "人工复核", tone: "manual" },
    watch: { label: "本次无信号", tone: "watch" }
  };
  return map[status] || { label: "待确认", tone: "watch" };
}

function renderSocialRadarLoading(term) {
  if (!socialRadarGrid) return;
  socialRadarGrid.innerHTML = `<div class="source-data-empty">正在围绕 ${escapeHtml(term)} 抓取公开推荐词，并整理社媒复核入口与未来 6 个月场景机会...</div>`;
}

function renderSocialRadarError(message) {
  if (!socialRadarGrid) return;
  socialRadarGrid.innerHTML = `<div class="source-data-empty">社媒雷达生成失败：${escapeHtml(message)}</div>`;
}

function renderSocialRadar(data) {
  if (!socialRadarGrid) return;
  const platforms = data.platforms || [];
  const currentHot = data.currentHot || [];
  const discussions = data.discussionSignals || [];
  const events = data.futureEvents || [];
  const trend = data.lastYearReview?.trend || {};
  const livePlatforms = platforms.filter((item) => item.status === "auto").length;
  const manualPlatforms = platforms.filter((item) => item.status === "manual").length;
  const normalizedText = data.normalizedTerm && data.normalizedTerm !== data.term
    ? `查询词：${data.term} -> ${data.normalizedTerm}`
    : `查询词：${data.normalizedTerm || data.term || "--"}`;

  if (!data.term) {
    socialRadarGrid.innerHTML = `<div class="source-data-empty">等待输入关键词后生成社媒平台关注建议、当下热点和未来节日机会。</div>`;
    return;
  }

  const platformHtml = platforms.slice(0, 14).map((platform) => {
    const status = socialPlatformStatus(platform.status);
    const score = platform.signal == null ? "复核" : Math.round(platform.signal);
    return `
      <article class="social-platform-card status-${status.tone}">
        <div>
          <strong>${escapeHtml(platform.platform)}</strong>
          <span>${escapeHtml(platform.role)}</span>
        </div>
        <em>${escapeHtml(score)}</em>
        <small>${escapeHtml(status.label)} · ${escapeHtml(platform.proof)}</small>
        <a ${externalOpenAttributes(platform.link)}>打开平台</a>
      </article>
    `;
  }).join("");

  const hotHtml = currentHot.length
    ? currentHot.slice(0, 12).map((item) => `
      <article class="social-hot-card heat-${escapeHtml(item.level || hotDiscoveryLevel(item.score))}">
        <div class="social-hot-head">
          <div>
            ${keywordTrigger(item.keyword, "social-keyword-button", bestKeywordExternalUrl(item, data.geo || "US"))}
            <span>${escapeHtml(item.intent)} · ${item.sourceCount || 1} 来源 · ${item.familyCount || 1} 类信号</span>
          </div>
          <em>${Math.round(item.score || 0)}</em>
        </div>
        <div class="social-score-bar"><span style="width:${Math.max(6, Math.min(100, item.score || 0))}%"></span></div>
        <div class="social-source-row">${(item.families || []).slice(0, 4).map((family) => `<span>${escapeHtml(family)}</span>`).join("")}</div>
        <div class="social-proof-row">${(item.evidence || []).slice(0, 3).map((proof) => `<small>${escapeHtml(shortDiscoverySource(proof.source))} #${proof.rank} · ${escapeHtml(proof.seed)}</small>`).join("")}</div>
      </article>
    `).join("")
    : `<div class="source-data-empty">本次没有抓到足够的热点候选词。</div>`;

  const discussionHtml = discussions.length
    ? discussions.slice(0, 10).map((item) => `
      <li>
        ${keywordTrigger(item.keyword, "compact-keyword-button", item.link || bestKeywordExternalUrl(item, data.geo || "US"))}
        <span>${escapeHtml(shortDiscoverySource(item.source))} · ${escapeHtml(item.intent)} · seed: ${escapeHtml(item.seed)}</span>
        <a ${externalOpenAttributes(item.link)}>复核</a>
      </li>
    `).join("")
    : `<li class="social-empty-row">Reddit / News / TikTok / YouTube 本次没有返回可展示信号。</li>`;

  const eventHtml = events.length
    ? events.map((event) => {
      const hasMatchedProducts = Boolean(event.products && event.products.length);
      const matchedProducts = hasMatchedProducts
        ? event.products.slice(0, 4).map((item) => keywordTrigger(item.keyword, "compact-keyword-button", bestKeywordExternalUrl(item, data.geo || "US"))).join("")
        : "";
      const seedQueries = (event.suggestedQueries || []).slice(0, 4).map((query) => keywordTrigger(query, "compact-keyword-button", sourceUrl("Google Search", query, data.geo || "US"))).join("");
      return `
        <article class="social-event-card heat-${escapeHtml(event.level || hotDiscoveryLevel(event.score))} ${hasMatchedProducts ? "has-match" : "no-match"}">
          <div class="social-event-head">
            <div>
              <strong>${escapeHtml(event.label)}</strong>
              <span>${escapeHtml(event.date)} · ${hasMatchedProducts ? socialRadarLevelText(event.score) : "暂无直接匹配"}</span>
            </div>
            <em>${hasMatchedProducts ? Math.round(event.score || 0) : "--"}</em>
          </div>
          <p>${(event.scenes || []).slice(0, 4).map(escapeHtml).join(" / ")}</p>
          ${hasMatchedProducts
            ? `<div class="social-event-products">${matchedProducts}</div>
              <div class="social-seed-block">
                <strong>可继续验证的延伸词</strong>
                <div>${seedQueries}</div>
              </div>`
            : `<div class="social-event-empty">当前关键词没有和这个窗口形成真实交叉热词，不建议优先验证。</div>`}
          <div class="social-verify-row">${(event.validationLinks || []).slice(0, 4).map((link) => `<a ${externalOpenAttributes(link.url)}>${escapeHtml(link.label)}</a>`).join("")}</div>
        </article>
      `;
    }).join("")
    : `<div class="source-data-empty">没有生成未来 6 个月节日窗口。</div>`;

  const trendHtml = trend.status === "live"
    ? `
      <article class="social-trend-review live">
        <strong>去年/历史趋势回看</strong>
        <div class="social-trend-metrics">
          <span>近 12 月均值 <b>${trend.recentAvg}</b></span>
          <span>前 12 月均值 <b>${trend.previousAvg}</b></span>
          <span>变化 <b>${trend.growth > 0 ? "+" : ""}${trend.growth}%</b></span>
        </div>
        <small>峰值：${escapeHtml(trend.peak?.date || "--")} / ${Math.round(Number(trend.peak?.value) || 0)}。${escapeHtml(trend.note || "")}</small>
        <a ${externalOpenAttributes(trend.link)}>打开 Google Trends 复核</a>
      </article>
    `
    : `
      <article class="social-trend-review">
        <strong>去年/历史趋势回看</strong>
        <p>暂无足够真实历史曲线。系统不会生成演示曲线。</p>
        <small>${escapeHtml(trend.note || data.lastYearReview?.note || "")}</small>
        ${trend.link ? `<a ${externalOpenAttributes(trend.link)}>打开 Google Trends 复核</a>` : ""}
      </article>
    `;

  socialRadarGrid.innerHTML = `
    <section class="social-radar-summary">
      <article><strong>${currentHot.length}</strong><span>${currentHot.length ? "当下热点候选" : "待复核热点"}</span></article>
      <article><strong>${livePlatforms}</strong><span>自动采集平台</span></article>
      <article><strong>${manualPlatforms}</strong><span>登录复核平台</span></article>
      <article><strong>${events.length}</strong><span>未来场景窗口</span></article>
    </section>
    <section class="social-radar-note">
      <strong>数据边界</strong>
      <span>${escapeHtml(normalizedText)}</span>
      <small>${escapeHtml(data.note || "")}</small>
    </section>
    <section class="social-radar-section">
      <div class="social-section-title"><h3>社媒复核入口与可采集平台</h3><p>只有自动返回关键词的平台参与评分；Facebook、Instagram、Pinterest、X、Threads 等登录型平台只做人工复核入口。</p></div>
      <div class="social-platform-grid">${platformHtml}</div>
    </section>
    <section class="social-radar-section social-current-module">
      <div class="social-section-title"><h3>${currentHot.length ? "当下热点搜索" : "当下热点待验证"}</h3><p>只展示当前关键词已经在多个公开来源里返回的热词，不混入未来节日种子；无返回时仅保留复核入口。</p></div>
      <div class="social-hot-grid">${hotHtml}</div>
    </section>
    <section class="social-radar-split">
      <section class="social-radar-section">
        <div class="social-section-title"><h3>用户需求与讨论</h3><p>优先看 Reddit / News / TikTok / YouTube 返回的标题或搜索语境。</p></div>
        <ul class="social-discussion-list">${discussionHtml}</ul>
      </section>
      ${trendHtml}
    </section>
    <section class="social-radar-section social-future-module">
      <div class="social-section-title"><h3>未来 6 个月场景机会</h3><p>覆盖节日、季节、生活场景和购物节点；只把与当前关键词和该场景本身都匹配的真实热词放进卡片，不匹配的窗口只保留待验证搜索种子。</p></div>
      <div class="social-event-grid">${eventHtml}</div>
    </section>
  `;
}

async function runSocialRadar(term, geo) {
  if (!socialRadarGrid) return;
  const clean = String(term || "").trim();
  const requestId = ++state.socialRadarRequestId;
  if (!clean) {
    renderSocialRadar({ term: "", platforms: [], currentHot: [], futureEvents: [], discussionSignals: [] });
    return;
  }
  renderSocialRadarLoading(clean);
  try {
    const data = await fetchJson(`/api/social-radar?term=${encodeURIComponent(clean)}&geo=${encodeURIComponent(geo || "US")}`, { timeoutMs: 18000 });
    if (requestId !== state.socialRadarRequestId) return;
    renderSocialRadar(data);
  } catch (error) {
    if (requestId !== state.socialRadarRequestId) return;
    renderSocialRadarError(error.message);
  }
}

function keywordDemandVerificationLinks(term, geo) {
  const links = [
    ["Google Trends", sourceUrl("Google Trends", term, geo)],
    ["Pinterest Trends", sourceUrl("Pinterest Trends", term, geo)],
    ["Amazon", sourceUrl("Amazon", term, geo)],
    ["TikTok", sourceUrl("TikTok", term, geo)],
    ["YouTube", sourceUrl("YouTube", term, geo)],
    ["Google Images", sourceUrl("Google Images", term, geo)],
    ["Google News", sourceUrl("Google News", term, geo)]
  ];
  return links.map(([label, url]) => `
    <a ${externalOpenAttributes(url)}>${escapeHtml(label)}</a>
  `).join("");
}

function manualTrendReviewHtml(term, geo) {
  const options = [
    ["rising", "上升"],
    ["stable", "平稳"],
    ["seasonal", "季节爆发"],
    ["declining", "下降"],
    ["no_data", "无数据"]
  ];
  const platformHtml = MANUAL_TREND_PLATFORMS.map((item) => {
    const review = getManualTrendReview(term, geo, item.platform);
    const statusText = review
      ? `${trendReviewStatusLabel(review.status)} · ${formatVerificationTime(review.reviewedAt || review.returnedAt || review.openedAt)}`
      : "未复核";
    const url = sourceUrl(item.urlLabel, term, geo);
    return `
      <article class="manual-trend-platform-card">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(statusText)}</span>
        </div>
        <p>${escapeHtml(item.note)}</p>
        <div class="manual-trend-actions">
          <a ${externalOpenAttributes(url)}>打开${escapeHtml(item.title)}</a>
          ${options.map(([status, label]) => `
            <button type="button" data-trend-review-status="${status}" data-trend-review-platform="${escapeHtml(item.platform)}" data-trend-review-keyword="${escapeHtml(term)}" data-trend-review-geo="${escapeHtml(geo)}">${label}</button>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
  return `
    <section class="manual-trend-review">
      <div>
        <strong>趋势人工复核结果</strong>
        <span>Google Trends / Pinterest Trends</span>
      </div>
      <p>不接 API 时，系统只生成官方趋势链接；打开和返回会自动记录，曲线判断需要你点选保存，后续报告会优先引用云端复核记录。</p>
      <div class="manual-trend-review-list">${platformHtml}</div>
    </section>
  `;
}

function extractTrendSeries(trendData, sourceData) {
  if (Array.isArray(trendData?.series) && trendData.series.length) {
    return {
      source: trendData.source || "Treendly API",
      mode: trendData.mode,
      series: trendData.series,
      warning: trendData.warning || ""
    };
  }

  const trendsSource = (sourceData?.sources || []).find((source) => /Google Trends/.test(source.source));
  const timeline = trendsSource?.meta?.timeline;
  if (trendsSource?.status === "live" && Array.isArray(timeline) && timeline.length) {
    return {
      source: "Google Trends",
      mode: "live",
      series: timeline,
      warning: trendsSource.note || ""
    };
  }

  const warnings = [trendData?.warning, trendsSource?.note].filter(Boolean);
  const sourceLabel = [
    trendData?.source,
    trendsSource ? `${trendsSource.source}${trendsSource.status ? ` ${trendsSource.status}` : ""}` : ""
  ].filter(Boolean).join("；") || "未接入真实历史趋势源";

  return {
    source: sourceLabel,
    mode: "unavailable",
    series: [],
    warning: warnings.join("；") || "当前没有真实历史序列；下方仅展示实时平台推荐词信号。"
  };
}

function renderMiniTrendSvg(series) {
  const width = 760;
  const height = 210;
  const pad = { top: 18, right: 24, bottom: 34, left: 38 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = series.map((point) => Number(point.value) || 0);
  const max = Math.max(100, ...values);
  const points = series.map((point, index) => {
    const x = pad.left + (index / Math.max(1, series.length - 1)) * plotWidth;
    const y = pad.top + (1 - ((Number(point.value) || 0) / max)) * plotHeight;
    return { x, y, date: point.date, value: Number(point.value) || 0 };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${points.at(-1).x.toFixed(2)} ${height - pad.bottom} L ${points[0].x.toFixed(2)} ${height - pad.bottom} Z`;
  const firstDate = series[0]?.date?.slice(0, 7) || "";
  const midDate = series[Math.floor(series.length / 2)]?.date?.slice(0, 7) || "";
  const lastDate = series.at(-1)?.date?.slice(0, 7) || "";
  const lastPoint = points.at(-1);
  const grid = [0, 25, 50, 75, 100].map((tick) => {
    const y = pad.top + (1 - tick / 100) * plotHeight;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#e8eef4" /><text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" class="axis-label">${tick}</text>`;
  }).join("");

  return `
    <svg class="keyword-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="关键词真实趋势曲线">
      <defs>
        <linearGradient id="keywordTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f8a8a" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#0f8a8a" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${grid}
      <path d="${areaPath}" fill="url(#keywordTrendFill)" />
      <path d="${linePath}" fill="none" stroke="#0f8a8a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="5" fill="#ffffff" stroke="#e15b4f" stroke-width="4" />
      <text x="${pad.left}" y="${height - 10}" class="axis-label">${firstDate}</text>
      <text x="${width / 2}" y="${height - 10}" text-anchor="middle" class="axis-label">${midDate}</text>
      <text x="${width - pad.right}" y="${height - 10}" text-anchor="end" class="axis-label">${lastDate}</text>
    </svg>
  `;
}

function renderKeywordTrendPanel(term, geo, trendData, sourceData) {
  const trend = extractTrendSeries(trendData, sourceData);
  const latest = trend.series.at(-1);
  const average = trend.series.length
    ? Math.round(trend.series.reduce((sum, point) => sum + (Number(point.value) || 0), 0) / trend.series.length)
    : 0;
  const statusText = trend.series.length ? `${trend.source} · ${trend.series.length} 个真实时间点` : trend.source;

  if (!trend.series.length) {
    return "";
  }

  return `
    <section class="keyword-trend-panel">
      <div class="keyword-trend-head">
        <div>
          <strong>${escapeHtml(term)} 的真实趋势曲线</strong>
          <span>${escapeHtml(statusText)}</span>
        </div>
        <em>${Math.round(Number(latest?.value) || 0)}<small>最新</small></em>
      </div>
      <div class="keyword-trend-stats">
        <span>均值 ${average}</span>
        <span>最新 ${Math.round(Number(latest?.value) || 0)}</span>
        <span>${escapeHtml(geo || "US")}</span>
      </div>
      ${renderMiniTrendSvg(trend.series)}
    </section>
  `;
}

function renderKeywordTrendUnavailable(term, geo) {
  return `
    <section class="keyword-trend-unavailable">
      <div>
        <strong>历史曲线未接入</strong>
        <span>请打开 Google Trends 或 Pinterest Trends 复核，系统会记录打开/返回状态。</span>
      </div>
      <div class="manual-trend-actions">
        ${MANUAL_TREND_PLATFORMS.map((item) => `<a ${externalOpenAttributes(sourceUrl(item.urlLabel, term, geo))}>打开${escapeHtml(item.title)}</a>`).join("")}
      </div>
    </section>
  `;
}

function renderKeywordDemandLoading(keyword) {
  if (!keywordDemandGrid) return;
  keywordDemandTitle.textContent = `${keyword} 的多平台需求信号`;
  keywordDemandSubtitle.textContent = "正在采集多平台实时推荐词；只有接入真实历史曲线时才显示趋势。";
  keywordDemandGrid.innerHTML = `
    <div class="source-data-empty">正在采集 Google、Amazon、TikTok、YouTube 等平台的实时推荐词信号...</div>
  `;
}

function renderKeywordDemandError(keyword, message) {
  if (!keywordDemandGrid) return;
  keywordDemandTitle.textContent = `${keyword} 的多平台需求信号`;
  keywordDemandSubtitle.textContent = "当前关键词采集失败，请稍后重试或打开验证入口人工复核。";
  keywordDemandGrid.innerHTML = `<div class="source-data-empty">采集失败：${escapeHtml(message)}</div>`;
}

function renderKeywordDemandTrendOnly(term, geo, trendData) {
  if (!keywordDemandGrid) return;
  const trendPanel = renderKeywordTrendPanel(term, geo, trendData, null);
  keywordDemandTitle.textContent = `${term} 的多平台需求信号`;
  keywordDemandSubtitle.textContent = trendPanel
    ? "已先显示真实趋势曲线，正在补充多平台实时推荐词信号..."
    : "正在补充多平台实时推荐词；当前没有可展示的真实历史曲线。";
  keywordDemandGrid.innerHTML = `
    ${trendPanel || renderKeywordTrendUnavailable(term, geo)}
    <div class="source-data-empty">正在补充 Google、Amazon、TikTok 等平台推荐词信号...</div>
  `;
}

function renderKeywordDemand(data, trendData = null) {
  if (!keywordDemandGrid) return;
  const liveSources = (data.sources || [])
    .filter((source) => sourceScoringEligible(source) && Array.isArray(source.items) && source.items.length)
    .map((source) => {
      const meta = platformMeta(source.source);
      const score = scorePlatformSource(source, data.term);
      return {
        ...source,
        family: sourceSignalFamily(source.source),
        platformLabel: meta.label,
        platformColor: meta.color,
        score,
        topItems: (source.items || []).slice(0, 4)
      };
    })
    .filter((source) => source.score > 0)
    .sort((a, b) => b.score - a.score);

  const families = new Set(liveSources.map((source) => source.family));
  const averageScore = liveSources.length
    ? Math.round(liveSources.reduce((sum, source) => sum + source.score, 0) / liveSources.length)
    : 0;
  const gradeInfo = gradeKeywordEvidence(data.term, data, trendData);
  const strongest = liveSources[0];

  keywordDemandTitle.textContent = `${data.term} 的多平台需求信号`;
  keywordDemandSubtitle.textContent = liveSources.length
    ? `已抓取 ${liveSources.length} 个可计分实时来源，覆盖 ${families.size} 类信号；这是平台推荐词信号，不是搜索量或销量。`
    : "当前没有抓到可计分的实时来源，建议打开趋势验证入口人工复核。";

  const summaryHtml = `
    <section class="keyword-demand-summary">
      <article><span>可信等级</span><strong>${trustBadgeHtml(gradeInfo)}</strong><small>${escapeHtml(gradeInfo.meta.summary)}</small></article>
      <article><span>推荐词信号指数</span><strong>${averageScore || "--"}</strong><small>当前平台返回词综合</small></article>
      <article><span>购物验证</span><strong>${families.has("购物需求") ? "有" : "--"}</strong><small>Amazon / Shopping / eBay / Etsy</small></article>
      <article><span>社媒/视觉验证</span><strong>${families.has("内容需求") || families.has("视觉需求") ? "有" : "--"}</strong><small>TikTok / YouTube / Images / News</small></article>
      <article><span>强势平台</span><strong>${escapeHtml(strongest?.platformLabel || "--")}</strong><small>${strongest ? `${strongest.score}/100` : "待复核"}</small></article>
      <article><span>商品过滤</span><strong>${escapeHtml(gradeInfo.productFilter?.label || "--")}</strong><small>${escapeHtml(gradeInfo.productFilter?.reason || "等待判断")}</small></article>
    </section>
    ${scoreBreakdownHtml({ scoreBreakdown: gradeInfo.scoreBreakdown })}
  `;

  const cardsHtml = liveSources.length
    ? liveSources.map((source) => `
      <article class="keyword-demand-card" style="--platform-color:${source.platformColor}">
        <div class="keyword-demand-head">
          <div>
            <strong>${escapeHtml(source.platformLabel)}</strong>
            <span>${escapeHtml(sourceEvidenceType(source.source, source.status))}</span>
          </div>
          <em>${source.score}</em>
        </div>
        <div class="keyword-demand-bar" aria-label="${escapeHtml(source.platformLabel)} 信号 ${source.score}">
          <span style="width:${Math.max(6, Math.min(100, source.score))}%"></span>
        </div>
        <div class="keyword-demand-terms">
          ${source.topItems.map((item) => keywordSourceTrigger(item, source.source, data.geo || "US", "compact-keyword-button")).join("")}
        </div>
        <a ${externalOpenAttributes(source.link || recommendationActionUrl(source.source, data.term, data.geo || "US"))}>打开平台复核</a>
      </article>
    `).join("")
    : `<div class="source-data-empty">没有实时推荐词。请使用下方趋势验证入口人工复核。</div>`;

  keywordDemandGrid.innerHTML = `
    ${renderKeywordTrendPanel(data.term, data.geo || "US", trendData, data) || renderKeywordTrendUnavailable(data.term, data.geo || "US")}
    ${summaryHtml}
    ${evidenceChainHtml(data.term, data)}
    <section class="keyword-demand-cards">${cardsHtml}</section>
    <section class="keyword-demand-verify">
      <strong>趋势验证入口</strong>
      <p>站内卡片只展示真实来源返回的当前需求信号；如需确认历史季节走势，可用这些入口打开官方平台复核。</p>
      <div>${keywordDemandVerificationLinks(data.term, data.geo || "US")}</div>
    </section>
    ${manualTrendReviewHtml(data.term, data.geo || "US")}
  `;
}

async function runKeywordDemand(keyword) {
  const clean = String(keyword || "").trim();
  if (!clean) return;
  const requestId = ++state.keywordDemandRequestId;
  const geo = geoInput.value || "US";
  const view = viewInput.value || "5";
  const cacheKey = `${geo}:${view}:${clean.toLowerCase()}`;
  renderKeywordDemandLoading(clean);
  keywordDemandGrid?.scrollIntoView({ block: "start" });

  const cached = state.keywordDemandCache.get(cacheKey);
  if (cached) {
    renderKeywordDemand(cached.sourceData, cached.trendData);
    return;
  }

  if (state.keywordDemandInFlightKey === cacheKey) {
    return;
  }

  if (state.keywordDemandAbort) {
    state.keywordDemandAbort.abort();
  }
  const controller = new AbortController();
  state.keywordDemandAbort = controller;
  state.keywordDemandInFlightKey = cacheKey;

  try {
    const trendPromise = fetchJson(`/api/quick-get?term=${encodeURIComponent(clean)}&geo=${encodeURIComponent(geo)}&view=${encodeURIComponent(view)}`, { signal: controller.signal, timeoutMs: 7000 })
      .catch((error) => ({ mode: "unavailable", warning: error.name === "AbortError" ? "请求已取消" : error.message, series: [] }));
    const sourcePromise = fetchJson(`/api/source-check?term=${encodeURIComponent(clean)}&geo=${encodeURIComponent(geo)}`, { signal: controller.signal, timeoutMs: 16000 });
    const trendData = await trendPromise;
    if (requestId === state.keywordDemandRequestId && !controller.signal.aborted) {
      renderKeywordDemandTrendOnly(clean, geo, trendData);
    }
    const data = await sourcePromise;
    if (requestId !== state.keywordDemandRequestId) return;
    state.keywordDemandCache.set(cacheKey, { trendData, sourceData: data, cachedAt: Date.now() });
    renderKeywordDemand(data, trendData);
  } catch (error) {
    if (error.name === "AbortError") return;
    if (requestId !== state.keywordDemandRequestId) return;
    renderKeywordDemandError(clean, error.message);
  } finally {
    if (state.keywordDemandAbort === controller) {
      state.keywordDemandAbort = null;
    }
    if (state.keywordDemandInFlightKey === cacheKey) {
      state.keywordDemandInFlightKey = "";
    }
  }
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
  const term = state.sourceCheck?.term || termInput.value.trim() || "";
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

function verificationStatusMeta(status) {
  const map = {
    verified: { label: "已验证", className: "manual-status-verified" },
    invalid: { label: "不成立", className: "manual-status-invalid" },
    watch: { label: "待观察", className: "manual-status-watch" }
  };
  return map[status] || map.verified;
}

function setVerification(sourceName, status = "verified") {
  localStorage.setItem(verificationKey(sourceName), JSON.stringify({
    source: sourceName,
    status,
    verifiedAt: new Date().toISOString()
  }));
}

async function saveManualTrendReview(keyword, geo, status, platform = "Google Trends 5Y") {
  const clean = String(keyword || "").trim();
  if (!clean) return;
  const label = trendReviewStatusLabel(status);
  const normalizedPlatform = normalizeManualTrendPlatform(platform);
  setManualTrendReview(clean, geo || "US", status, label, normalizedPlatform);
  try {
    await fetchJson("/api/manual-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 9000,
      body: JSON.stringify({
        keyword: clean,
        geo: geo || "US",
        sourcePlatform: normalizedPlatform,
        status,
        note: label
      })
    });
  } catch (error) {
    console.warn("manual trend review cloud save failed", error);
  }
  refreshCloudHistory(clean, geo || "US");
  runKeywordDemand(clean);
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
    const verificationMeta = verificationStatusMeta(verification?.status);
    const cardStatus = needsVerification && verification ? verification.status : source.status;
    const label = needsVerification && verification ? verificationMeta.label : sourceStatusText(source.status);
    const itemHtml = items.length
      ? `<ul>${items.map((item) => `<li>${keywordSourceTrigger(item, source.source, data.geo || "US", "source-keyword-button")}</li>`).join("")}</ul>`
      : `<div class="source-note">${escapeHtml(source.note || "暂无可展示数据")}</div>`;
    const footNote = items.length && source.note ? `<small>${escapeHtml(source.note)}</small>` : "";
    const generatedAt = data.generatedAt ? formatVerificationTime(data.generatedAt) : formatVerificationTime(new Date().toISOString());
    const tier = sourceTrustTier(source.source, source.status);
    return `
      <article class="source-data-card ${escapeHtml(cardStatus)} ${needsVerification ? "needs-verification" : ""}">
        <div class="source-data-head">
          <strong>${escapeHtml(source.source)}</strong>
          <span>${label}</span>
        </div>
        <dl class="source-evidence-meta">
          <div><dt>来源等级</dt><dd>${escapeHtml(tier.label)}</dd></div>
          <div><dt>来源类型</dt><dd>${escapeHtml(sourceEvidenceType(source.source, source.status))}</dd></div>
          <div><dt>关键词</dt><dd>${escapeHtml(data.term || "")}</dd></div>
          <div><dt>国家</dt><dd>${escapeHtml(data.geo || "US")}</dd></div>
          <div><dt>时间范围</dt><dd>${escapeHtml(sourceTimeRangeText(source.source, source.status))}</dd></div>
          <div><dt>采集时间</dt><dd>${escapeHtml(generatedAt)}</dd></div>
          <div><dt>评分状态</dt><dd>${escapeHtml(sourceScoringText(source))}</dd></div>
        </dl>
        ${itemHtml}
        ${verification ? `<div class="manual-verified ${verificationMeta.className}">${verificationMeta.label}：${formatVerificationTime(verification.verifiedAt)}</div>` : ""}
        <div class="source-data-foot">
          ${footNote}
          <div class="source-actions">
            ${source.link ? `<a ${externalOpenAttributes(source.link)}>打开验证页</a>` : ""}
            ${needsVerification ? `
              <div class="source-action-stack">
                <button type="button" class="verify-source-btn" data-verify-source="${escapeHtml(source.source)}" data-verify-status="verified">已验证</button>
                <button type="button" class="verify-source-btn secondary" data-verify-source="${escapeHtml(source.source)}" data-verify-status="invalid">不成立</button>
                <button type="button" class="verify-source-btn secondary" data-verify-source="${escapeHtml(source.source)}" data-verify-status="watch">待观察</button>
              </div>
            ` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderSourceCheckResult(data) {
  state.platformGuards = Array.isArray(data.platformGuards) ? data.platformGuards : state.platformGuards;
  renderTrendGuard(data.googleTrendsGuard, data.term, data.geo, state.platformGuards);
  renderSourceData(data);
  renderSources(data);
  renderPlatformWorkbench(data);
  renderSignalTaxonomy(data);
  renderSourceAudit(data);
  renderPlatformHeat(data);
  renderKeywordDemand(data, state.current?.term === data.term ? state.current : null);
  renderLiveRecommendations(data);
  renderThemeExpansions(data);
  renderOpportunityInsights(data);
  refreshCloudHistory(data.term || "", data.geo || currentInputGeo());
}

function sourceAuditStatus(source) {
  if (sourceScoringEligible(source)) {
    return {
      label: "参与自动评分",
      tone: "live",
      confidence: "较高",
      reason: "返回的是搜索/购物/内容推荐词，且有原始链接，适合做推荐词信号。"
    };
  }
  if (source.status === "live") {
    return {
      label: "真实数据但不评分",
      tone: "watch",
      confidence: "中等",
      reason: "来源返回的不是稳定关键词推荐词，适合辅助判断，不直接计入评分。"
    };
  }
  if (source.status === "link-only") {
    return {
      label: "仅人工复核",
      tone: "manual",
      confidence: "需人工确认",
      reason: "没有稳定公开接口，保留真实平台入口，点击后人工判断。"
    };
  }
  return {
    label: "当前被限制",
    tone: "blocked",
    confidence: "暂不可用",
    reason: "平台限制、接口变动、限流或网络失败，不能作为当前评分依据。"
  };
}

function sourceMethodText(sourceName) {
  const name = String(sourceName || "");
  if (/Google 输入/.test(name)) return "Google autocomplete";
  if (/Google Shopping/.test(name)) return "Google Shopping autocomplete";
  if (/Google Images/.test(name)) return "Google Images autocomplete";
  if (/Google News/.test(name)) return "Google News autocomplete";
  if (/Bing/.test(name)) return "Bing suggest";
  if (/DuckDuckGo/.test(name)) return "DuckDuckGo autocomplete";
  if (/Amazon/.test(name)) return "Amazon completion";
  if (/eBay/.test(name)) return "eBay autosug";
  if (/TikTok 搜索/.test(name)) return "TikTok suggest";
  if (/YouTube/.test(name)) return "YouTube autocomplete";
  if (/Google Trends/.test(name)) return "Google Trends 网页接口";
  if (/Etsy Open API/.test(name)) return "Etsy Open API v3";
  if (/Reddit/.test(name)) return "Reddit search.json";
  return "平台搜索/验证页面";
}

function renderSourceAudit(data = state.sourceCheck) {
  if (!sourceAuditGrid) return;
  if (!data) {
    sourceAuditGrid.innerHTML = `<div class="source-data-empty">等待来源数据，生成可信度审计...</div>`;
    return;
  }

  const sources = data.sources || [];
  const scored = sources.filter(sourceScoringEligible);
  const manual = sources.filter((source) => source.status === "link-only");
  const blocked = sources.filter((source) => source.status === "blocked");
  const totalKeywords = scored.reduce((sum, source) => sum + (source.items || []).length, 0);
  const credibility = credibilitySummary(data);
  const auditRows = sources.map((source) => {
    const meta = sourceAuditStatus(source);
    return { source, meta };
  });

  sourceAuditGrid.innerHTML = `
    <section class="audit-summary-card">
      <strong>${escapeHtml(data.term || "当前关键词")}</strong>
      <span>${scored.length} 个自动评分源 · ${manual.length} 个复核入口 · ${blocked.length} 个受限源 · ${totalKeywords} 条推荐词</span>
      <small>推荐词 ≠ 搜索量 ≠ 销量；系统只把有原始链接和采集时间的自动来源计入评分。</small>
      <div class="audit-grade-grid">
        ${Object.keys(TRUST_GRADE_META).map((grade) => `
          <span class="${TRUST_GRADE_META[grade].className}"><b>${grade}</b><em>${credibility.counts[grade] || 0}</em></span>
        `).join("")}
      </div>
    </section>
    <section class="audit-issue-card">
      <h3>数据定义</h3>
      <ul>
        <li>真实推荐词信号：Google、Bing、Amazon、TikTok、YouTube 等搜索框返回词。</li>
        <li>趋势历史信号：Google Trends / Pinterest Trends，只能作为相对指数复核。</li>
        <li>购物、内容、视觉、人工复核分开显示，不混成一个“热度”。</li>
      </ul>
    </section>
    <section class="audit-issue-card">
      <h3>反误导规则</h3>
      <ul>
        <li>无原始链接或采集时间，不参与评分。</li>
        <li>只有单平台出现，最高为 C 级观察线索。</li>
        <li>只有 Google 系来源时不判为高潜力。</li>
        <li>Google Trends 429 或空白时，不生成趋势结论。</li>
      </ul>
    </section>
    <div class="audit-source-table">
      ${auditRows.map(({ source, meta }) => `
        <article class="audit-source-row status-${meta.tone}">
          <div>
            <strong>${escapeHtml(source.source)}</strong>
            <span>${escapeHtml(sourceEvidenceType(source.source, source.status))} · ${escapeHtml(sourceMethodText(source.source))}</span>
          </div>
          <em>${escapeHtml(meta.label)}</em>
          <small>${escapeHtml(meta.confidence)}</small>
          <p>${escapeHtml(sourceRawSummary(source) || meta.reason)}</p>
          ${source.link ? `<a ${externalOpenAttributes(source.link)}>打开来源</a>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderSourceLoading() {
  sourceDataGrid.innerHTML = `<div class="source-data-empty">正在抓取 Google、Amazon、TikTok 等美国站来源...</div>`;
  renderPlatformWorkbenchLoading();
  renderSignalTaxonomyLoading();
  renderPlatformLoading();
  if (keywordDemandGrid) {
    keywordDemandTitle.textContent = "热门词多平台需求走势";
    keywordDemandSubtitle.textContent = "正在等待当前关键词的多平台信号...";
    keywordDemandGrid.innerHTML = `<div class="source-data-empty">等待真实平台推荐词...</div>`;
  }
  renderRecommendationLoading();
  renderSourceAudit();
  renderThemeLoading();
  renderInsightLoading();
}

function renderStartState(message = "请输入关键词后开始查询。") {
  state.current = null;
  state.sourceCheck = null;
  setTrendSectionsVisible(false);
  setPlatformMetricLabels();
  averageMetric.textContent = "--";
  averageNote.textContent = "等待输入关键词";
  growthMetric.textContent = "--";
  growthNote.textContent = "还没有开始采集";
  paceMetric.textContent = "待输入";
  paceNote.textContent = message;
  searchMetric.textContent = "--";
  searchNote.textContent = "输入后再打开多平台验证";
  chartTitle.textContent = "等待输入关键词";
  chartSubtitle.textContent = message;
  modeBadge.textContent = "待输入";
  modeBadge.classList.remove("live");
  trendChart.innerHTML = "";
  renderSources({ term: "", geo: geoInput.value || "US" });
  if (hotDiscoveryGrid) hotDiscoveryGrid.innerHTML = `<div class="source-data-empty">等待输入关键词后自动发现相关热词。</div>`;
  if (socialRadarGrid) socialRadarGrid.innerHTML = `<div class="source-data-empty">等待输入关键词后生成社媒平台关注建议、当下热点和未来节日机会。</div>`;
  sourceDataGrid.innerHTML = `<div class="source-data-empty">等待输入关键词后采集真实平台来源。</div>`;
  renderPlatformWorkbench();
  renderSignalTaxonomy();
  if (platformHeatGrid) platformHeatGrid.innerHTML = `<div class="source-data-empty">等待关键词后计算推荐词信号指数。</div>`;
  if (keywordDemandGrid) {
    keywordDemandTitle.textContent = "热门词多平台需求信号";
    keywordDemandSubtitle.textContent = "输入关键词或点击推荐词后显示真实来源信号。";
    keywordDemandGrid.innerHTML = `<div class="source-data-empty">等待关键词。</div>`;
  }
  relatedRows.innerHTML = `<tr><td colspan="3">等待关键词后显示多平台推荐词。</td></tr>`;
  renderSourceAudit();
  if (themeExpansionGrid) themeExpansionGrid.innerHTML = `<div class="source-data-empty">等待关键词后生成场景延伸。</div>`;
  renderInsightLoading();
  if (holidayKeywordGrid) holidayKeywordGrid.innerHTML = `<div class="source-data-empty">等待关键词后生成美国节日真实词库。</div>`;
  if (cloudHistoryGrid) cloudHistoryGrid.innerHTML = `<div class="source-data-empty">等待关键词后读取云端历史库。</div>`;
  if (reportGrid) reportGrid.innerHTML = `<div class="source-data-empty">输入关键词后生成报告，并提供 Markdown / PDF 导出。</div>`;
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
    const scoredItem = {
      keyword: item.keyword,
      heat,
      sourceCount: item.sourceCount || (item.sources || []).length || 0,
      sources: item.sources || [],
      families: item.families || [],
      buyingIntent: true,
      ...scoreKeywordSignal({
        keyword: item.keyword,
        heat,
        sourceCount: item.sourceCount || (item.sources || []).length || 0,
        sources: item.sources || [],
        families: item.families || [],
        buyingIntent: true
      }, data)
    };
    const level = item.heatLevel || heatClass(heat);
    const heatWidth = Math.max(5, Math.min(100, heat));
    const events = item.events || (item.event ? [item.event] : []);
    const links = (item.links || []).slice(0, 2).map((link) => `
      <a class="scored" ${externalOpenAttributes(link.url)}>${escapeHtml(shortSourceName(link.source))}</a>
    `).join("");
    const sourceBadges = (item.sources || []).slice(0, 7).map((source) => `
      <span>${escapeHtml(shortSourceName(source))}</span>
    `).join("");
    const validationLinks = (item.validationLinks || []).slice(0, 6).map((link) => `
      <a class="verify" ${externalOpenAttributes(link.url)}>${escapeHtml(link.label)}</a>
    `).join("");
    return `
      <li class="holiday-keyword-item heat-${level}">
        <div class="holiday-keyword-main">
          ${keywordTrigger(item.keyword, "holiday-keyword-button", bestKeywordExternalUrl(item, data.geo || "US"))}
          <span>${escapeHtml(events.join(" / "))} · ${item.sourceCount || 1} 个计分来源 · ${heatLabel(heat)}</span>
          ${scorePillsHtml(scoredItem)}
          <div class="holiday-source-badges">${sourceBadges}</div>
        </div>
        <div class="holiday-heat" aria-label="${escapeHtml(item.keyword)} 推荐词信号 ${heat}">
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
      const scoredItem = {
        keyword: item.keyword,
        heat,
        sourceCount: item.sourceCount || (item.sources || []).length || 0,
        sources: item.sources || [],
        families: item.families || [],
        buyingIntent: true,
        ...scoreKeywordSignal({
          keyword: item.keyword,
          heat,
          sourceCount: item.sourceCount || (item.sources || []).length || 0,
          sources: item.sources || [],
          families: item.families || [],
          buyingIntent: true
        }, data)
      };
      const level = item.heatLevel || heatClass(heat);
      return `
      <button class="holiday-hotword heat-${level}" type="button" data-demand-keyword="${escapeHtml(item.keyword)}" data-trends-link="${escapeHtml(item.trendsLink || "")}">
        <strong>${escapeHtml(item.keyword)}</strong>
        <span>${escapeHtml(item.category)} / ${escapeHtml(item.subcategory)} · ${item.sourceCount || 1} 个计分来源</span>
        ${scorePillsHtml(scoredItem)}
        <em>${heat}<small>${heatLabel(heat)}</small></em>
      </button>
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
          <div class="holiday-season-bar" aria-label="${escapeHtml(subcategory.label)} 推荐词信号 ${subScore}">
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
            <span>大类信号 · ${heatLabel(score)}</span>
          </div>
        </div>
        <div class="holiday-season-bar category" aria-label="${escapeHtml(category.label)} 大类推荐词信号 ${score}">
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
        <p>按推荐词信号指数排序，颜色越深代表实时推荐来源越集中；点击可查看多平台需求信号，并跳转原始平台复核。</p>
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
    const data = await fetchJson(`/api/seasonal-keywords?${query.toString()}`, { timeoutMs: 18000 });
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
    const data = await fetchJson(`/api/source-check?term=${encodeURIComponent(term)}&geo=${encodeURIComponent(geo)}`, { timeoutMs: 17000 });
    renderSourceCheckResult(data);
  } catch (error) {
    sourceDataGrid.innerHTML = `<div class="source-data-empty">来源数据抓取失败：${escapeHtml(error.message)}</div>`;
    if (platformHeatGrid) {
      platformHeatGrid.innerHTML = `<div class="source-data-empty">平台推荐词信号计算失败：${escapeHtml(error.message)}</div>`;
    }
    if (keywordDemandGrid) {
      keywordDemandGrid.innerHTML = `<div class="source-data-empty">热门词需求走势生成失败：${escapeHtml(error.message)}</div>`;
    }
    if (sourceAuditGrid) {
      sourceAuditGrid.innerHTML = `<div class="source-data-empty">数据可信度审计失败：${escapeHtml(error.message)}</div>`;
    }
    if (platformWorkbenchGrid) {
      platformWorkbenchGrid.innerHTML = `<div class="source-data-empty">平台采集工作台生成失败：${escapeHtml(error.message)}</div>`;
    }
    if (signalTaxonomyGrid) {
      signalTaxonomyGrid.innerHTML = `<div class="source-data-empty">关键词分类失败：${escapeHtml(error.message)}</div>`;
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
}

async function runSearch() {
  const term = termInput.value.trim();
  if (!term) {
    renderStartState("请输入关键词后再查询。");
    termInput.focus();
    return;
  }
  const geo = geoInput.value;
  const view = viewInput.value;
  state.sourceCheck = null;
  renderHotDiscoveryLoading(term);
  renderSocialRadarLoading(term);
  renderReportPanelLoading(term);
  setLoading(true);
  try {
    let data;
    try {
      data = await fetchJson(`/api/quick-get?term=${encodeURIComponent(term)}&geo=${encodeURIComponent(geo)}&view=${encodeURIComponent(view)}`, { timeoutMs: 7000 });
    } catch (error) {
      data = {
        mode: "unavailable",
        term,
        geo,
        view: String(view) === "1" ? 1 : 5,
        series: [],
        summary: {
          average: 0,
          peak: 0,
          growth: 0,
          pace: "Pending",
          paceType: "Realtime suggest only",
          monthlySearches: null,
          updated: new Date().toISOString().slice(0, 10)
        },
        warning: error.message || "趋势历史接口不可用，继续采集真实推荐词。"
      };
    }
    renderCurrent(data);
    runHotKeywordDiscovery(term, geo);
    runSocialRadar(term, geo);
    runSourceCheck(term, geo);
    runHolidayKeywords(geo, term);
    triggerSearchCollection(term, geo);
  } catch (error) {
    renderStartState(error.message || "查询失败，请稍后重试。");
  } finally {
    setLoading(false);
  }
}

function compareSeedTerm() {
  const manual = (compareInput.value || "")
    .split(/[,，\n]/)
    .map((term) => term.trim())
    .filter(Boolean)[0];
  return manual || termInput.value.trim() || state.sourceCheck?.term || "";
}

async function runCompare() {
  const term = compareSeedTerm();
  const geo = geoInput.value || state.sourceCheck?.geo || "US";
  const currentTerm = state.sourceCheck?.term || "";

  if (!term) {
    compareList.innerHTML = `<div class="source-data-empty">请先输入一个关键词，再生成选品机会建议。</div>`;
    compareInput.focus();
    return;
  }

  if (state.sourceCheck && currentTerm.toLowerCase() === term.toLowerCase()) {
    renderOpportunityInsights(state.sourceCheck);
    return;
  }

  if (!termInput.value.trim()) {
    termInput.value = term;
  }

  compareList.innerHTML = `<div class="source-data-empty">正在围绕 ${escapeHtml(term)} 采集多平台推荐词，生成选品机会建议...</div>`;
  renderSourceLoading();
  setLoading(true);
  try {
    const data = await fetchJson(`/api/source-check?term=${encodeURIComponent(term)}&geo=${encodeURIComponent(geo)}`, { timeoutMs: 17000 });
    renderSourceCheckResult(data);
  } catch (error) {
    compareList.innerHTML = `<div class="source-data-empty">选品机会建议生成失败：${escapeHtml(error.message)}</div>`;
  } finally {
    setLoading(false);
  }
}

async function init() {
  applyWorkspaceView();
  renderStartState();
  state.config = await fetchJson(`/api/config?ts=${Date.now()}`);
  renderApiStatus();
  refreshCloudHistory("", currentInputGeo());
}

searchBtn.addEventListener("click", runSearch);
compareBtn.addEventListener("click", runCompare);
termInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});
sourceDataGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-verify-source]");
  if (!button) return;
  const sourceName = button.getAttribute("data-verify-source");
  const status = button.getAttribute("data-verify-status") || "verified";
  setVerification(sourceName, status);
  if (state.sourceCheck) {
    renderSourceData(state.sourceCheck);
    renderPlatformWorkbench(state.sourceCheck);
    renderSourceAudit(state.sourceCheck);
  }
});

sourceLinks.addEventListener("click", (event) => {
  const button = event.target.closest("[data-refresh-verification]");
  if (!button) return;
  event.preventDefault();
  renderSources({
    term: currentInputTerm(),
    geo: currentInputGeo()
  });
});

window.addEventListener("hashchange", () => {
  applyWorkspaceView();
});

window.addEventListener("focus", () => {
  markManualTrendReturned();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    markManualTrendReturned();
  }
});

document.addEventListener("click", (event) => {
  const printButton = event.target.closest("[data-print-report]");
  if (printButton) {
    event.preventDefault();
    window.print();
    return;
  }

  const trendReviewButton = event.target.closest("[data-trend-review-status]");
  if (trendReviewButton) {
    event.preventDefault();
    const status = trendReviewButton.getAttribute("data-trend-review-status");
    const keyword = trendReviewButton.getAttribute("data-trend-review-keyword") || currentInputTerm();
    const geo = trendReviewButton.getAttribute("data-trend-review-geo") || currentInputGeo();
    const platform = trendReviewButton.getAttribute("data-trend-review-platform") || "Google Trends 5Y";
    saveManualTrendReview(keyword, geo, status, platform);
    return;
  }

  const externalLink = event.target.closest("[data-open-external]");
  if (externalLink) {
    event.preventDefault();
    const url = externalLink.getAttribute("data-open-external") || externalLink.getAttribute("href");
    trackManualTrendOpen(url);
    openExternalUrl(url);
    return;
  }

  const externalKeyword = event.target.closest("[data-open-keyword-url], [data-open-keyword-external]");
  if (externalKeyword) {
    event.preventDefault();
    event.stopPropagation();
    const explicitUrl = externalKeyword.getAttribute("data-open-keyword-url");
    const keyword = externalKeyword.getAttribute("data-open-keyword-external");
    const url = explicitUrl || sourceUrl("Google Search", keyword, currentInputGeo());
    trackManualTrendOpen(url);
    openExternalUrl(url);
    return;
  }

  const button = event.target.closest("[data-demand-keyword]");
  if (!button) return;
  event.preventDefault();
  if (activeViewKey() !== "keyword-demand") {
    window.location.hash = "keyword-demand";
  } else {
    applyWorkspaceView();
  }
  runKeywordDemand(button.getAttribute("data-demand-keyword"));
});

init().catch((error) => {
  apiStatus.querySelector("span:last-child").textContent = error.message;
});

