const $ = (id) => document.getElementById(id);

const storageKey = "xingan-trade-journal-v4";
const feeSettingsKey = "xingan-fee-settings-v1";
const appSettingsKey = "xingan-app-settings-v1";
const oldStorageKeys = ["xingan-trade-journal-v3", "xingan-trade-journal-v2", "xingan-trade-journal-v1"];
const analysisOptions = ["技術面", "籌碼面", "基本面", "消息面", "混合判斷"];
const reasonGroups = {
  "技術面": ["突破壓力", "回測支撐不破", "均線多頭排列", "量增價漲", "KD 或 RSI 轉強", "型態整理後突破", "跌深反彈"],
  "籌碼面": ["外資或投信買超", "主力或法人連買", "融資下降籌碼乾淨", "券資比轉強", "大戶持股增加", "成交量換手健康"],
  "基本面": ["營收成長", "獲利轉強", "毛利率改善", "產業展望變好", "除息或配息規劃", "低估值修復"],
  "消息面": ["產業題材發酵", "政策利多", "新產品或新訂單", "法說會展望佳", "新聞催化", "市場資金熱點"],
  "混合判斷": ["技術與籌碼同向", "基本面加技術轉強", "風險報酬划算", "大盤環境配合", "符合原本交易計畫"],
};
const stopAlertPercent = 3;
const commissionRate = 0.001425;
const defaultFeeSettings = {
  discount: 0.6,
  minFee: 20,
  stockTax: 0.003,
  etfTax: 0.001,
};
const defaultAppSettings = {
  name: "星安",
  avatar: "安",
  motto: "只做看得懂的交易",
  sessionTheme: true,
  stopAlert: true,
  language: "zh",
};
const analysisWeights = {
  "技術面": 10,
  "籌碼面": 9,
  "基本面": 8,
  "消息面": 5,
  "混合判斷": 7,
};
const reasonWeights = {
  "技術面": {
    "突破壓力": 18,
    "回測支撐不破": 20,
    "均線多頭排列": 14,
    "量增價漲": 16,
    "KD 或 RSI 轉強": 8,
    "型態整理後突破": 14,
    "跌深反彈": 10,
  },
  "籌碼面": {
    "外資或投信買超": 20,
    "主力或法人連買": 20,
    "融資下降籌碼乾淨": 16,
    "券資比轉強": 12,
    "大戶持股增加": 18,
    "成交量換手健康": 14,
  },
  "基本面": {
    "營收成長": 18,
    "獲利轉強": 20,
    "毛利率改善": 16,
    "產業展望變好": 18,
    "除息或配息規劃": 10,
    "低估值修復": 18,
  },
  "消息面": {
    "產業題材發酵": 18,
    "政策利多": 16,
    "新產品或新訂單": 20,
    "法說會展望佳": 18,
    "新聞催化": 12,
    "市場資金熱點": 16,
  },
  "混合判斷": {
    "技術與籌碼同向": 24,
    "基本面加技術轉強": 24,
    "風險報酬划算": 22,
    "大盤環境配合": 14,
    "符合原本交易計畫": 16,
  },
};

const state = {
  stocks: [
    { code: "0050", name: "元大台灣50", market: "上市" },
    { code: "0056", name: "元大高股息", market: "上市" },
    { code: "00878", name: "國泰永續高股息", market: "上市" },
    { code: "2303", name: "聯電", market: "上市" },
    { code: "2317", name: "鴻海", market: "上市" },
    { code: "2330", name: "台積電", market: "上市" },
    { code: "2412", name: "中華電", market: "上市" },
    { code: "2454", name: "聯發科", market: "上市" },
    { code: "2881", name: "富邦金", market: "上市" },
    { code: "2882", name: "國泰金", market: "上市" },
    { code: "3008", name: "大立光", market: "上市" },
    { code: "3034", name: "聯詠", market: "上市" },
    { code: "8069", name: "元太", market: "上櫃" },
    { code: "8299", name: "群聯", market: "上櫃" },
  ],
  selectedStock: null,
  selectedReasons: new Set(),
  activeAnalysis: "技術面",
  editReasons: new Set(),
  editActiveAnalysis: "技術面",
  lastPrices: {},
  quoteTimer: null,
  liveMode: location.protocol.startsWith("http"),
  settings: { ...defaultAppSettings },
  calendarMonth: null,
  calendarMode: "plan",
};

function nowForInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function currentDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function currentMonth() {
  return currentDate().slice(0, 7);
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function parseMoneyInput(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, ""));
}

function formatMoneyInput(event) {
  const input = event.target;
  const raw = String(input.value || "").replace(/[^\d]/g, "");
  input.value = raw ? Number(raw).toLocaleString("zh-TW") : "";
}

function signedMoney(value) {
  const num = Number(value) || 0;
  return `${num >= 0 ? "+" : ""}${formatMoney(num)}`;
}

function topbarDateTime() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return state.settings.language === "en"
    ? `${year}/${month}/${day} ${hour}:${minute}`
    : `${year}年${month}月${day}日 ${hour}:${minute}`;
}

function signedCompactMoney(value) {
  const num = Number(value) || 0;
  const sign = num >= 0 ? "+" : "";
  const abs = Math.abs(num);
  if (abs >= 10000) {
    const wan = abs / 10000;
    const text = wan >= 10 ? Math.round(wan).toString() : wan.toFixed(1);
    return `${sign}${text}萬`;
  }
  return `${sign}${formatMoney(abs)}`;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function joinLabels(value) {
  const labels = toArray(value);
  return labels.length ? labels.join("、") : "--";
}

function formatPrice(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num.toFixed(2).replace(/\.00$/, "") : "--";
}

function normalizeJournal(value) {
  if (!value) return { open: [], closed: [], cashflows: [] };
  if (value.open || value.closed) {
    return {
      open: (value.open || []).map(normalizeTrade),
      closed: (value.closed || []).map(normalizeTrade),
      cashflows: (value.cashflows || []).map(normalizeCashflow),
    };
  }
  if (!Array.isArray(value)) return { open: [], closed: [], cashflows: [] };
  return {
    open: value.map((trade) => ({
      id: trade.id || crypto.randomUUID(),
      entryTime: String(trade.date || currentDate()).slice(0, 10),
      code: trade.code,
      name: trade.name,
      market: trade.market,
      analysisType: ["混合判斷"],
      reason: trade.reason ? [trade.reason] : ["舊資料"],
      entryPrice: Number(trade.price) || 0,
      stopPrice: 0,
      shares: Number(trade.shares) || 0,
      mood: trade.mood || "",
      note: trade.note || "",
    })),
    closed: [],
    cashflows: [],
  };
}

function normalizeTrade(trade) {
  return {
    ...trade,
    entryTime: normalizeDateOnly(trade.entryTime),
    exitTime: trade.exitTime ? normalizeDateOnly(trade.exitTime) : trade.exitTime,
    analysisType: Array.isArray(trade.analysisType) ? trade.analysisType : [trade.analysisType || "混合判斷"],
    reason: Array.isArray(trade.reason) ? trade.reason : [trade.reason || "舊資料"],
  };
}

function normalizeCashflow(flow) {
  const type = ["initial", "deposit", "withdraw"].includes(flow.type) ? flow.type : "deposit";
  const raw = Math.abs(Number(flow.amount || 0));
  return {
    id: flow.id || crypto.randomUUID(),
    date: normalizeDateOnly(flow.date || currentDate()),
    type,
    amount: type === "withdraw" ? -raw : raw,
    note: flow.note || "",
  };
}

function normalizeDateOnly(value) {
  const text = String(value || currentDate());
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  return text.slice(0, 10);
}

function getJournal() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return normalizeJournal(JSON.parse(saved));
    } catch {
      return { open: [], closed: [], cashflows: [] };
    }
  }
  for (const key of oldStorageKeys) {
    const old = localStorage.getItem(key);
    if (!old) continue;
    try {
      return normalizeJournal(JSON.parse(old));
    } catch {}
  }
  return { open: [], closed: [], cashflows: [] };
}

function saveJournal(journal) {
  localStorage.setItem(storageKey, JSON.stringify(journal));
}

function getFeeSettings() {
  try {
    return { ...defaultFeeSettings, ...JSON.parse(localStorage.getItem(feeSettingsKey)) };
  } catch {
    return { ...defaultFeeSettings };
  }
}

function saveFeeSettings() {
  const settings = {
    discount: Number($("settingDiscount").value) || defaultFeeSettings.discount,
    minFee: Number($("settingMinFee").value) || defaultFeeSettings.minFee,
    stockTax: Number($("settingStockTax").value) || defaultFeeSettings.stockTax,
    etfTax: Number($("settingEtfTax").value) || defaultFeeSettings.etfTax,
  };
  localStorage.setItem(feeSettingsKey, JSON.stringify(settings));
  renderAll();
}

function loadAppSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(appSettingsKey) || "{}");
    state.settings = { ...defaultAppSettings, ...saved };
    state.settings.sessionTheme = true;
    saveAppSettings();
  } catch {
    state.settings = { ...defaultAppSettings };
  }
}

function saveAppSettings() {
  localStorage.setItem(appSettingsKey, JSON.stringify(state.settings));
}

function renderAppSettings() {
  const settings = state.settings;
  if ($("profileAvatar")) $("profileAvatar").textContent = (settings.avatar || settings.name || "安").slice(0, 2);
  if ($("greetingName")) $("greetingName").textContent = settings.name || "星安";
  if ($("profileNameInput")) $("profileNameInput").value = settings.name || "";
  if ($("profileMottoInput")) $("profileMottoInput").value = settings.motto || "";
  if ($("profileLanguageInput")) $("profileLanguageInput").value = settings.language || "zh";
  if ($("sessionThemeToggle")) $("sessionThemeToggle").checked = settings.sessionTheme !== false;
  if ($("stopAlertToggle")) $("stopAlertToggle").checked = settings.stopAlert !== false;
  document.documentElement.lang = settings.language === "en" ? "en" : "zh-Hant";
  document.body.classList.toggle("fixed-session-theme", settings.sessionTheme === false);
}

function saveProfile(event) {
  event.preventDefault();
  state.settings.name = $("profileNameInput").value.trim() || "星安";
  state.settings.avatar = state.settings.name.slice(0, 1) || "安";
  state.settings.motto = $("profileMottoInput").value.trim() || defaultAppSettings.motto;
  state.settings.language = $("profileLanguageInput")?.value || "zh";
  saveAppSettings();
  renderAll();
  closeSheets();
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function applyLanguageText() {
  const en = state.settings.language === "en";
  const copy = en
    ? {
        buy: "+ Buy",
        cashflow: "+ Funds",
        marketOpen: "TW market open · Live mode",
        marketClosed: "TW market closed · Closed mode",
        accountNow: "Account equity",
        accountHint: "Includes deposits, withdrawals and trade P&L",
        totalPnl: "Total trade P&L",
        equityChart: "Account equity curve",
        showStrategy: "Show strategy line",
        quote: "Quote",
        openCount: "Open",
        closedCount: "Closed",
        rangePnl: "Range",
        openTab: "Open",
        closedTab: "Closed",
        calendarTab: "Calendar",
        statsTab: "Stats",
        openTitle: "Holdings",
        closedTitle: "Closed trades",
        openSmall: "holdings · sorted by stop-risk",
        closedSmall: "closed · newest first",
        calendarKicker: "Trading Calendar",
        profileLabel: "Profile",
        profileTitle: "Personal settings",
        profileSave: "Save profile",
        clearTitle: "Clear trade records",
        clearText: "Deletes holdings, closed trades and cashflow records only. Profile and fee settings stay unchanged.",
        clearButton: "Clear records",
        seedTitle: "Test data",
        seedText: "Create 100 random trade records to stress-test the UI and statistics.",
        seedButton: "Create 100",
        nameLabel: "Display name",
        languageLabel: "Language",
        mottoLabel: "Reminder",
        stockPlaceholder: "Search stock: 2330 or TSMC",
      }
    : {
        buy: "＋買進",
        cashflow: "＋出入資金",
        marketOpen: "台股開盤中 · 即時模式",
        marketClosed: "台股收盤 · 收盤模式",
        accountNow: "帳戶目前資金",
        accountHint: "含出入金與交易損益",
        totalPnl: "目前累積損益",
        equityChart: "帳戶資金曲線",
        showStrategy: "顯示交易績效線",
        quote: "參考價",
        openCount: "持有",
        closedCount: "平倉",
        rangePnl: "區間",
        openTab: "持有",
        closedTab: "平倉",
        calendarTab: "日曆",
        statsTab: "統計",
        openTitle: "持有個股",
        closedTitle: "平倉紀錄",
        openSmall: "檔持有 · 依停損風險排序",
        closedSmall: "筆平倉 · 依時間排序",
        calendarKicker: "交易日曆",
        profileLabel: "個人設定",
        profileTitle: "設定交易日誌",
        profileSave: "保存個人資訊",
        clearTitle: "清空交易紀錄",
        clearText: "只刪除持有、平倉、出入金紀錄；個人設定與手續費不會刪除。",
        clearButton: "一鍵清空",
        seedTitle: "測試資料",
        seedText: "建立 100 筆隨機交易紀錄，用來檢查大量資料下的畫面與統計。",
        seedButton: "產生100筆",
        nameLabel: "顯示名稱",
        languageLabel: "介面語言",
        mottoLabel: "一句提醒",
        stockPlaceholder: "找股票：2330 或 台積電",
      };
  setText(".hello-copy span", topbarDateTime());
  setText("#marketSessionLabel", isMarketOpen() ? copy.marketOpen : copy.marketClosed);
  setText(".hero-balance .kicker", copy.accountNow);
  setText(".session-pill", copy.accountHint);
  setText(".hero-side span", copy.totalPnl);
  setText(".equity-head span", copy.equityChart);
  const chartToggle = document.querySelector(".chart-toggle");
  if (chartToggle) {
    const input = chartToggle.querySelector("input");
    chartToggle.textContent = "";
    if (input) chartToggle.appendChild(input);
    chartToggle.append(document.createTextNode(copy.showStrategy));
  }
  setText(".quote-chip span", copy.quote);
  const metricLabels = document.querySelectorAll(".metrics span");
  if (metricLabels[0]) metricLabels[0].textContent = copy.openCount;
  if (metricLabels[1]) metricLabels[1].textContent = copy.closedCount;
  if (metricLabels[2]) metricLabels[2].textContent = copy.rangePnl;
  setText("#openBuySheet", copy.buy);
  setText("#openCashflowSheet", copy.cashflow);
  setText('.tab-button[data-tab="open"] b', copy.openTab);
  setText('.tab-button[data-tab="closed"] b', copy.closedTab);
  setText('.tab-button[data-tab="calendar"] b', copy.calendarTab);
  setText('.tab-button[data-tab="stats"] b', copy.statsTab);
  setText("#openPanelTitle", copy.openTitle);
  setText("#closedPanelTitle", copy.closedTitle);
  const openSmall = document.querySelector("#openPanel .panel-title-row small");
  if (openSmall) openSmall.innerHTML = `<b id="openTitleCount">${getJournal().open.length}</b> ${copy.openSmall}`;
  const closedSmall = document.querySelector("#closedPanel .panel-title-row small");
  if (closedSmall) closedSmall.innerHTML = `<b id="closedTitleCount">${getJournal().closed.length}</b> ${copy.closedSmall}`;
  setText(".calendar-kicker", copy.calendarKicker);
  setText("#profileSheet .sheet-title span", copy.profileLabel);
  setText("#profileSheet .sheet-title h2", copy.profileTitle);
  setText('#profileForm button[type="submit"]', copy.profileSave);
  setText("#clearJournalTitle", copy.clearTitle);
  setText("#clearJournalText", copy.clearText);
  setText("#clearJournalData", copy.clearButton);
  setText("#seedTestTitle", copy.seedTitle);
  setText("#seedTestText", copy.seedText);
  setText("#seedTestData", copy.seedButton);
  const profileLabels = document.querySelectorAll("#profileForm label");
  if (profileLabels[0]) profileLabels[0].childNodes[0].nodeValue = copy.nameLabel;
  if (profileLabels[1]) profileLabels[1].childNodes[0].nodeValue = copy.languageLabel;
  if (profileLabels[2]) profileLabels[2].childNodes[0].nodeValue = copy.mottoLabel;
  if ($("stockSearch")) $("stockSearch").placeholder = copy.stockPlaceholder;
}

function loadFeeSettings() {
  const settings = getFeeSettings();
  $("settingDiscount").value = settings.discount;
  $("settingMinFee").value = settings.minFee;
  $("settingStockTax").value = settings.stockTax;
  $("settingEtfTax").value = settings.etfTax;
}

function totalShares(unit, quantity) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return unit === "lot" ? qty * 1000 : qty;
}

function riskAmount(entryPrice, stopPrice, shares, code = "") {
  const entry = Number(entryPrice);
  const stop = Number(stopPrice);
  const qty = Number(shares);
  if (!entry || !stop || !qty || stop >= entry) return 0;
  const buy = buyCost(entry, qty);
  const sell = sellProceeds(stop, qty, code);
  return Math.max(0, Math.round(buy.total - sell.total));
}

function riskPercent(entryPrice, stopPrice) {
  const entry = Number(entryPrice);
  const stop = Number(stopPrice);
  if (!entry || !stop || stop >= entry) return 0;
  return ((entry - stop) / entry) * 100;
}

function tradeValue(price, shares) {
  return Math.round(Number(price) * Number(shares));
}

function commission(value) {
  const amount = Number(value);
  if (!amount) return 0;
  const settings = getFeeSettings();
  return Math.max(settings.minFee, Math.round(amount * commissionRate * settings.discount));
}

function isEtfCode(code = "") {
  return String(code).startsWith("00");
}

function transactionTax(value, code = "") {
  const amount = Number(value);
  const settings = getFeeSettings();
  const taxRate = isEtfCode(code) ? settings.etfTax : settings.stockTax;
  return amount ? Math.round(amount * taxRate) : 0;
}

function buyCost(price, shares) {
  const value = tradeValue(price, shares);
  const fee = commission(value);
  return { value, fee, total: value + fee };
}

function sellProceeds(price, shares, code = "") {
  const value = tradeValue(price, shares);
  const fee = commission(value);
  const tax = transactionTax(value, code);
  return { value, fee, tax, total: value - fee - tax };
}

function netPnl(entryPrice, exitPrice, shares, code = "") {
  const buy = buyCost(entryPrice, shares);
  const sell = sellProceeds(exitPrice, shares, code);
  return {
    buy,
    sell,
    grossPnl: sell.value - buy.value,
    pnl: sell.total - buy.total,
  };
}

function splitShares(shares) {
  const total = Number(shares || 0);
  if (total >= 1000 && total % 1000 === 0) return { unit: "lot", quantity: total / 1000 };
  return { unit: "share", quantity: total || 1 };
}

function selectedOptions(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function labelUsageRank(label) {
  const journal = getJournal();
  return [...journal.open, ...journal.closed].reduce((count, trade) => {
    return count
      + (toArray(trade.analysisType).includes(label) ? 1 : 0)
      + (toArray(trade.reason).includes(label) ? 1 : 0);
  }, 0);
}

function sortByUsage(options) {
  return [...options].sort((a, b) => labelUsageRank(b) - labelUsageRank(a));
}

function renderChoiceGrid(id, options, selected = []) {
  const box = $(id);
  box.innerHTML = "";
  const list = id === "reasonChoices" || id === "editReasonChoices" ? sortByUsage(options) : options;
  list.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-chip";
    button.dataset.value = label;
    button.textContent = label;
    if (selected.includes(label)) button.classList.add("active");
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      if (id === "reasonChoices") syncSelectedReasons();
      if (id === "editReasonChoices") syncEditReasons();
      renderCurrentReasonScore();
      renderEditReasonScore();
    });
    box.appendChild(button);
  });
}

function renderAnalysisTabs(selected = ["技術面"], mode = "buy") {
  const box = $(mode === "buy" ? "analysisChoices" : "editAnalysisChoices");
  const activeKey = mode === "buy" ? "activeAnalysis" : "editActiveAnalysis";
  const reasonsSet = mode === "buy" ? state.selectedReasons : state.editReasons;
  box.innerHTML = "";
  analysisOptions.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "analysis-tab";
    button.dataset.value = label;
    button.textContent = label;
    if (hasSelectedReasonForType(label, reasonsSet)) button.classList.add("selected");
    if (state[activeKey] === label) button.classList.add("active");
    button.addEventListener("click", () => {
      if (mode === "buy") syncSelectedReasons();
      else syncEditReasons();
      const id = mode === "buy" ? "analysisChoices" : "editAnalysisChoices";
      state[activeKey] = label;
      renderAnalysisTabs(selectedChoices(id), mode);
      if (mode === "buy") renderReasonChoices();
      else renderEditReasonChoices();
      renderCurrentReasonScore();
      renderEditReasonScore();
    });
    button.addEventListener("dblclick", () => {
      clearReasonsForType(label, reasonsSet);
      if (mode === "buy") state.selectedReasons = reasonsSet;
      else state.editReasons = reasonsSet;
      state[activeKey] = label;
      renderAnalysisTabs(selectedChoices(mode === "buy" ? "analysisChoices" : "editAnalysisChoices"), mode);
      if (mode === "buy") renderReasonChoices();
      else renderEditReasonChoices();
      renderCurrentReasonScore();
      renderEditReasonScore();
    });
    box.appendChild(button);
  });
}

function hasSelectedReasonForType(type, reasonsSet) {
  const reasons = reasonGroups[type] || [];
  return reasons.some((reason) => reasonsSet.has(reason));
}

function clearReasonsForType(type, reasonsSet) {
  (reasonGroups[type] || []).forEach((reason) => reasonsSet.delete(reason));
}

function selectedChoices(id) {
  const selector = id === "analysisChoices" || id === "editAnalysisChoices" ? ".analysis-tab.selected" : ".choice-chip.active";
  return [...$(id).querySelectorAll(selector)].map((button) => button.dataset.value);
}

function selectedAnalysisTypes(mode = "buy") {
  const active = mode === "buy" ? state.activeAnalysis : state.editActiveAnalysis;
  const reasonsSet = mode === "buy" ? state.selectedReasons : state.editReasons;
  const withReasons = analysisOptions.filter((type) => hasSelectedReasonForType(type, reasonsSet));
  return [...new Set([active, ...withReasons])];
}

function syncSelectedReasons() {
  const visibleReasons = new Set(reasonGroups[state.activeAnalysis] || []);
  const next = new Set([...state.selectedReasons].filter((reason) => !visibleReasons.has(reason)));
  selectedChoices("reasonChoices").forEach((reason) => next.add(reason));
  state.selectedReasons = next;
}

function syncEditReasons() {
  const visibleReasons = new Set(reasonGroups[state.editActiveAnalysis] || []);
  const next = new Set([...state.editReasons].filter((reason) => !visibleReasons.has(reason)));
  selectedChoices("editReasonChoices").forEach((reason) => next.add(reason));
  state.editReasons = next;
}

function renderReasonChoices() {
  const reasons = reasonGroups[state.activeAnalysis] || [];
  const previous = new Set(state.selectedReasons);
  selectedChoices("reasonChoices").forEach((reason) => previous.add(reason));
  state.selectedReasons = previous;
  renderChoiceGrid("reasonChoices", reasons, [...state.selectedReasons].filter((reason) => reasons.includes(reason)));
  $("activeReasonTitle").textContent = `${state.activeAnalysis}買進理由，可多選`;
  renderCurrentReasonScore();
}

function renderEditReasonChoices() {
  const reasons = reasonGroups[state.editActiveAnalysis] || [];
  const previous = new Set(state.editReasons);
  selectedChoices("editReasonChoices").forEach((reason) => previous.add(reason));
  state.editReasons = previous;
  renderChoiceGrid("editReasonChoices", reasons, [...state.editReasons].filter((reason) => reasons.includes(reason)));
  $("editActiveReasonTitle").textContent = `${state.editActiveAnalysis}買進理由，可多選`;
  renderEditReasonScore();
}

function scoreRows(closedTrades = getJournal().closed) {
  const rows = new Map();
  closedTrades.forEach((trade) => {
    const labels = [...toArray(trade.analysisType), ...toArray(trade.reason)];
    if (!labels.length) return;
    const share = Number(trade.pnl || 0) / labels.length;
    labels.forEach((label) => {
      const row = rows.get(label) || { label, count: 0, wins: 0, weightedPnl: 0 };
      row.count += 1;
      row.wins += Number(trade.pnl || 0) > 0 ? 1 : 0;
      row.weightedPnl += share;
      rows.set(label, row);
    });
  });
  return [...rows.values()].map((row) => ({
    ...row,
    winRate: row.count ? row.wins / row.count : 0,
    score: Math.round(row.weightedPnl * Math.sqrt(row.count)),
  }));
}

function scoreMap() {
  return new Map(scoreRows().map((row) => [row.label, row]));
}

function renderCurrentReasonScore() {
  if (!$("currentReasonScore")) return;
  const selected = [...selectedChoices("analysisChoices"), ...selectedChoices("reasonChoices")];
  if (!selected.length) {
    $("currentReasonScore").textContent = "--";
    $("currentReasonScoreText").textContent = "先選分析類型與買進理由。";
    $("reasonScoreHint").textContent = "評分：--";
    return;
  }
  const scores = typeScores(selectedAnalysisTypes("buy"), [...state.selectedReasons]);
  const activeScore = scores[state.activeAnalysis] || 0;
  $("currentReasonScore").textContent = `${state.activeAnalysis} ${activeScore} / 100`;
  $("currentReasonScoreText").innerHTML = Object.entries(scores)
    .map(([type, score]) => `${type} ${score}/100`)
    .join("　");
  $("reasonScoreHint").textContent = `${state.activeAnalysis}：${activeScore}`;
}

function renderEditReasonScore() {
  if (!$("editCurrentReasonScore")) return;
  const selected = [...selectedChoices("editAnalysisChoices"), ...selectedChoices("editReasonChoices")];
  if (!selected.length) {
    $("editCurrentReasonScore").textContent = "--";
    $("editCurrentReasonScoreText").textContent = "先選分析類型與買進理由。";
    $("editReasonScoreHint").textContent = "評分：--";
    return;
  }
  const scores = typeScores(selectedAnalysisTypes("edit"), [...state.editReasons]);
  const activeScore = scores[state.editActiveAnalysis] || 0;
  $("editCurrentReasonScore").textContent = `${state.editActiveAnalysis} ${activeScore} / 100`;
  $("editCurrentReasonScoreText").innerHTML = Object.entries(scores)
    .map(([type, score]) => `${type} ${score}/100`)
    .join("　");
  $("editReasonScoreHint").textContent = `${state.editActiveAnalysis}：${activeScore}`;
}

function renderRiskPreview(prefix = "") {
  const isEdit = prefix === "edit";
  const entry = $(isEdit ? "editEntryPrice" : "entryPrice").value;
  const stop = $(isEdit ? "editStopPrice" : "stopPrice").value;
  const unit = $(isEdit ? "editShareUnit" : "shareUnit").value;
  const quantity = $(isEdit ? "editShareQuantity" : "shareQuantity").value;
  const shares = totalShares(unit, quantity);
  const code = isEdit ? getJournal().open.find((trade) => trade.id === $("editId").value)?.code : state.selectedStock?.code;
  const amount = riskAmount(entry, stop, shares, code);
  const percent = riskPercent(entry, stop);
  const amountEl = $(isEdit ? "editRiskPreview" : "riskPreview");
  const textEl = $(isEdit ? "editRiskPreviewText" : "riskPreviewText");
  if (!amount) {
    amountEl.textContent = "--";
    textEl.textContent = "停損價需低於買進價，且數量要大於 0。";
    return;
  }
  amountEl.textContent = `最多虧 ${formatMoney(amount)} 元`;
  const buy = buyCost(entry, shares);
  const stopSell = sellProceeds(stop, shares, code);
  textEl.textContent = `風險約 ${percent.toFixed(1)}%，買手續費 ${formatMoney(buy.fee)}，停損賣手續費 ${formatMoney(stopSell.fee)}，證交稅 ${formatMoney(stopSell.tax)}。`;
}

const quickTemplates = {
  breakout: {
    active: "技術面",
    analysis: ["技術面"],
    reasons: ["突破壓力", "量增價漲", "型態整理後突破"],
  },
  pullback: {
    active: "技術面",
    analysis: ["技術面"],
    reasons: ["回測支撐不破", "均線多頭排列"],
  },
  chip: {
    active: "籌碼面",
    analysis: ["籌碼面"],
    reasons: ["外資或投信買超", "主力或法人連買", "融資下降籌碼乾淨"],
  },
  rebound: {
    active: "技術面",
    analysis: ["技術面", "消息面"],
    reasons: ["跌深反彈", "市場資金熱點"],
  },
};

function allTradesNewestFirst() {
  const journal = getJournal();
  return [...journal.open, ...journal.closed].sort((a, b) => {
    const da = a.entryTime || a.exitTime || "";
    const db = b.entryTime || b.exitTime || "";
    return String(db).localeCompare(String(da));
  });
}

function mostUsedLabels(source) {
  const counts = new Map();
  allTradesNewestFirst().forEach((trade) => {
    toArray(source === "analysis" ? trade.analysisType : trade.reason).forEach((label) => {
      counts.set(label, (counts.get(label) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
}

function applyTradeToBuyForm(trade, copyStock = true) {
  if (!trade) return false;
  if (copyStock) {
    const stock = state.stocks.find((item) => item.code === trade.code) || {
      code: trade.code,
      name: trade.name,
      market: trade.market || "上市",
    };
    selectStock(stock);
  }
  const split = splitShares(trade.shares);
  $("entryTime").value = currentDate();
  $("mood").value = trade.mood || $("mood").value;
  $("shareUnit").value = split.unit;
  $("shareQuantity").value = split.quantity;
  $("stopPrice").value = trade.stopPrice || "";
  state.activeAnalysis = toArray(trade.analysisType)[0] || state.activeAnalysis;
  state.selectedReasons = new Set(toArray(trade.reason));
  renderAnalysisTabs(toArray(trade.analysisType));
  renderReasonChoices();
  renderRiskPreview("");
  return true;
}

function applyHabitTemplate() {
  const analysis = mostUsedLabels("analysis").filter((label) => analysisOptions.includes(label));
  const reasons = mostUsedLabels("reason").filter((label) => Object.values(reasonGroups).flat().includes(label));
  const last = allTradesNewestFirst()[0];
  if (last) applyTradeToBuyForm(last, false);
  if (analysis.length) {
    state.activeAnalysis = analysis[0];
    state.selectedReasons = new Set(reasons.slice(0, 4));
    renderAnalysisTabs(analysis.slice(0, 3));
    renderReasonChoices();
  }
  $("checkStop").checked = true;
  $("checkRisk").checked = true;
  $("checkEmotion").checked = true;
  renderCurrentReasonScore();
}

function applyLazyAction(action) {
  if (action === "copy-last") {
    if (!applyTradeToBuyForm(allTradesNewestFirst()[0])) alert("還沒有上一筆可以複製。");
    return;
  }
  applyHabitTemplate();
  if (action === "quick") {
    $("note").value = $("note").value || "懶人快速紀錄";
    $("entryPrice").focus();
  }
}

function applyTemplate(name) {
  const template = quickTemplates[name];
  if (!template) return;
  state.activeAnalysis = template.active;
  state.selectedReasons = new Set(template.reasons);
  renderAnalysisTabs(template.analysis);
  renderReasonChoices();
  renderCurrentReasonScore();
}

function ensureLazyBuyDefaults() {
  $("entryTime").value = $("entryTime").value || currentDate();
  if (state.selectedReasons.size) return;
  state.activeAnalysis = "技術面";
  state.selectedReasons = new Set(["突破壓力"]);
  renderAnalysisTabs(["技術面"]);
  renderReasonChoices();
  renderCurrentReasonScore();
}

function checklistPassed() {
  if (!$("buyForm").classList.contains("show-advanced")) return true;
  return $("checkStop").checked && $("checkRisk").checked && $("checkEmotion").checked;
}

function setSheetAdvanced(formId, buttonId, open, openText, closeText) {
  const form = $(formId);
  const button = $(buttonId);
  if (!form || !button) return;
  form.classList.toggle("show-advanced", open);
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? closeText : openText;
}

function toggleSheetAdvanced(formId, buttonId, openText, closeText) {
  const form = $(formId);
  setSheetAdvanced(formId, buttonId, !form.classList.contains("show-advanced"), openText, closeText);
}

function generateReviewLine(trade) {
  const result = Number(trade.pnl || 0) >= 0 ? "獲利" : "虧損";
  const plan = trade.planFollowed || "未記錄是否照計畫";
  const reason = joinLabels(trade.reason);
  const lesson = toArray(trade.reviewMistakes)[0] || trade.exitReason || "等待更多樣本";
  return `這筆${result}，${plan}，主要條件是「${reason}」，復盤重點：${lesson}。`;
}

function autoTagsForTrade(trade) {
  const tags = [];
  const risk = Number(trade.riskPercent || riskPercent(trade.entryPrice, trade.stopPrice));
  if (risk >= 8) tags.push("高風險單");
  if (risk > 0 && risk <= 3) tags.push("停損很近");
  if (toArray(trade.reason).some((label) => label.includes("突破") || label.includes("量增"))) tags.push("動能單");
  if (toArray(trade.reason).some((label) => label.includes("反彈") || label.includes("跌深"))) tags.push("反彈單");
  if (trade.planFollowed === "照計畫") tags.push("有照計畫");
  if (trade.planFollowed && trade.planFollowed !== "照計畫") tags.push("需檢討");
  if (Number(trade.pnl || 0) > 0) tags.push("獲利單");
  if (Number(trade.pnl || 0) < 0) tags.push("虧損單");
  return [...new Set(tags)];
}

function baseScore(analysisList, reasonList) {
  const scores = typeScores(analysisList, reasonList);
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function typeScores(analysisList, reasonList) {
  const scores = {};
  analysisList.forEach((type) => {
    const weights = reasonWeights[type] || {};
    scores[type] = reasonList.reduce((sum, reason) => sum + (weights[reason] || 0), 0);
  });
  return scores;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadStocks() {
  try {
    const data = await fetchJson("/api/stocks");
    if (data.stocks && data.stocks.length) state.stocks = data.stocks;
  } catch {}
  selectStock(state.stocks[0]);
}

function renderStockOptions(keyword) {
  const box = $("stockDropdown");
  const key = keyword.trim().toLowerCase();
  if (!key) {
    box.hidden = true;
    return;
  }
  const matches = state.stocks
    .filter((stock) => `${stock.code} ${stock.name}`.toLowerCase().includes(key))
    .slice(0, 30);
  box.innerHTML = "";
  matches.forEach((stock) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stock-option";
    button.innerHTML = `<strong>${stock.code} ${stock.name}</strong><span>${stock.market}</span>`;
    button.addEventListener("click", () => selectStock(stock));
    box.appendChild(button);
  });
  box.hidden = matches.length === 0;
}

function selectStock(stock) {
  state.selectedStock = stock;
  $("stockSearch").value = `${stock.code} ${stock.name}`;
  $("stockDropdown").hidden = true;
  updateQuote();
}

async function updateQuote() {
  const stock = state.selectedStock;
  if (!stock) return;
  try {
    const quote = await fetchJson(`/api/quote?code=${encodeURIComponent(stock.code)}&market=${encodeURIComponent(stock.market)}`);
    const price = quote.price || quote.close;
    state.lastPrices[stock.code] = Number(price) || null;
    $("referencePrice").textContent = formatPrice(price);
    if (price) $("entryPrice").value = formatPrice(price);
    renderAll();
  } catch {
    $("referencePrice").textContent = "--";
  }
}

function openSheet(id) {
  $("sheetBackdrop").hidden = false;
  $(id).hidden = false;
  document.body.classList.add("sheet-open");
}

function closeSheets() {
  $("sheetBackdrop").hidden = true;
  document.querySelectorAll(".sheet").forEach((sheet) => {
    sheet.hidden = true;
  });
  document.body.classList.remove("sheet-open");
}

function addTrade(event) {
  event.preventDefault();
  ensureLazyBuyDefaults();
  const shares = totalShares($("shareUnit").value, $("shareQuantity").value);
  const entryPrice = Number($("entryPrice").value);
  const analysisType = analysisOptions.filter((type) => hasSelectedReasonForType(type, state.selectedReasons));
  const reason = [...state.selectedReasons];
  if (!state.selectedStock || shares <= 0 || !entryPrice || !analysisType.length || !reason.length) {
    alert("請確認股票、買進價、張數或零股、分析類型、買進理由都有填。");
    return;
  }
  if (!checklistPassed()) {
    alert("請先完成交易前檢查清單。");
    return;
  }
  const journal = getJournal();
  const newTrade = {
    id: crypto.randomUUID(),
    entryTime: $("entryTime").value,
    code: state.selectedStock.code,
    name: state.selectedStock.name,
    market: state.selectedStock.market,
    analysisType,
    reason,
    baseScore: baseScore(analysisType, reason),
    typeScores: typeScores(analysisType, reason),
    entryPrice,
    stopPrice: Number($("stopPrice").value) || 0,
    shares,
    riskAmount: riskAmount(entryPrice, $("stopPrice").value, shares, state.selectedStock.code),
    riskPercent: riskPercent(entryPrice, $("stopPrice").value),
    buyFee: buyCost(entryPrice, shares).fee,
    stopSellFee: sellProceeds($("stopPrice").value, shares, state.selectedStock.code).fee,
    stopTax: sellProceeds($("stopPrice").value, shares, state.selectedStock.code).tax,
    mood: $("mood").value,
    note: $("note").value.trim(),
  };
  newTrade.autoTags = autoTagsForTrade(newTrade);
  journal.open.unshift(newTrade);
  saveJournal(journal);
  closeSheets();
  $("note").value = "";
  $("checkStop").checked = false;
  $("checkRisk").checked = false;
  $("checkEmotion").checked = false;
  state.selectedReasons.clear();
  renderReasonChoices();
  showTab("open");
  renderAll();
  startQuotePolling();
}

function openEditSheet(id) {
  const trade = getJournal().open.find((item) => item.id === id);
  if (!trade) return;
  const split = splitShares(trade.shares);
  $("editId").value = id;
  $("editSubtitle").textContent = `${trade.code} ${trade.name}`;
  $("editEntryTime").value = normalizeDateOnly(trade.entryTime);
  $("editMood").value = trade.mood || "冷靜";
  const analysis = toArray(trade.analysisType).length ? toArray(trade.analysisType) : ["技術面"];
  state.editActiveAnalysis = analysis[0];
  state.editReasons = new Set(toArray(trade.reason));
  renderAnalysisTabs(analysis, "edit");
  renderEditReasonChoices();
  $("editEntryPrice").value = trade.entryPrice;
  $("editStopPrice").value = trade.stopPrice || "";
  $("editNote").value = trade.note || "";
  $("editShareUnit").value = split.unit;
  $("editShareQuantity").value = split.quantity;
  renderRiskPreview("edit");
  openSheet("editSheet");
}

function editTrade(event) {
  event.preventDefault();
  const journal = getJournal();
  const trade = journal.open.find((item) => item.id === $("editId").value);
  if (!trade) return;
  syncEditReasons();
  const analysisType = analysisOptions.filter((type) => hasSelectedReasonForType(type, state.editReasons));
  const reason = [...state.editReasons];
  const shares = totalShares($("editShareUnit").value, $("editShareQuantity").value);
  if (shares <= 0 || !analysisType.length || !reason.length) {
    alert("請確認分析類型、買進理由、數量都有填。");
    return;
  }
  trade.entryTime = $("editEntryTime").value;
  trade.analysisType = analysisType;
  trade.reason = reason;
  trade.baseScore = baseScore(analysisType, reason);
  trade.typeScores = typeScores(analysisType, reason);
  trade.entryPrice = Number($("editEntryPrice").value) || trade.entryPrice;
  trade.stopPrice = Number($("editStopPrice").value) || 0;
  trade.shares = shares;
  trade.riskAmount = riskAmount(trade.entryPrice, trade.stopPrice, shares, trade.code);
  trade.riskPercent = riskPercent(trade.entryPrice, trade.stopPrice);
  trade.buyFee = buyCost(trade.entryPrice, shares).fee;
  trade.stopSellFee = sellProceeds(trade.stopPrice, shares, trade.code).fee;
  trade.stopTax = sellProceeds(trade.stopPrice, shares, trade.code).tax;
  trade.mood = $("editMood").value;
  trade.note = $("editNote").value.trim();
  trade.autoTags = autoTagsForTrade(trade);
  saveJournal(journal);
  renderAll();
  startQuotePolling();
  closeSheets();
}

function openCloseSheet(id) {
  const trade = getJournal().open.find((item) => item.id === id);
  if (!trade) return;
  $("closeId").value = id;
  $("closeSubtitle").textContent = `${trade.code} ${trade.name}`;
  $("exitTime").value = currentDate();
  $("exitPrice").value = "";
  $("exitNote").value = "";
  $("exitReason").value = "停利";
  $("planFollowed").value = "照計畫";
  setFastClosePlan("照計畫");
  [...$("reviewMistakes").options].forEach((option) => {
    option.selected = false;
  });
  setSheetAdvanced("closeForm", "toggleCloseReview", false, "補充詳細檢討", "收起詳細檢討");
  openSheet("closeSheet");
}

function setFastClosePlan(plan) {
  $("planFollowed").value = plan;
  if (plan === "照計畫") $("exitReason").value = "停利";
  if (plan === "太早賣") $("exitReason").value = "手動出場";
  if (plan === "沒紀律") $("exitReason").value = "其他";
  document.querySelectorAll("[data-fast-plan]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.fastPlan === plan);
  });
  const feedback = $("quickCloseFeedback");
  if (feedback) {
    const text = {
      "照計畫": "已選：照計畫。系統會記錄為紀律出場。",
      "太早賣": "已選：太早賣。之後可檢討是不是被情緒影響。",
      "沒紀律": "已選：沒紀律。這筆會標記成需要檢討。",
    };
    feedback.textContent = text[plan] || "已選擇平倉結果。";
  }
}

function closeTrade(event) {
  event.preventDefault();
  const journal = getJournal();
  const index = journal.open.findIndex((trade) => trade.id === $("closeId").value);
  if (index === -1) return;
  const trade = journal.open[index];
  const exitPrice = Number($("exitPrice").value);
  if (!exitPrice) {
    alert("請輸入平倉價。");
    return;
  }
  const result = netPnl(trade.entryPrice, exitPrice, trade.shares, trade.code);
  const closedTrade = {
    ...trade,
    exitTime: $("exitTime").value,
    exitPrice,
    exitReason: $("exitReason").value,
    planFollowed: $("planFollowed").value,
    reviewMistakes: selectedOptions($("reviewMistakes")),
    exitNote: $("exitNote").value.trim(),
    grossPnl: result.grossPnl,
    buyValue: result.buy.value,
    sellValue: result.sell.value,
    buyFee: result.buy.fee,
    sellFee: result.sell.fee,
    tax: result.sell.tax,
    totalFees: result.buy.fee + result.sell.fee + result.sell.tax,
    pnl: result.pnl,
  };
  closedTrade.reviewLine = generateReviewLine(closedTrade);
  closedTrade.autoTags = autoTagsForTrade(closedTrade);
  journal.closed.unshift({
    ...closedTrade,
  });
  journal.open.splice(index, 1);
  saveJournal(journal);
  closeSheets();
  showTab("closed");
  renderAll();
  startQuotePolling();
}

function addCashflowFrom(prefix = "") {
  const amountEl = $(prefix ? `${prefix}CashflowAmount` : "cashflowAmount");
  const typeEl = $(prefix ? `${prefix}CashflowType` : "cashflowType");
  const dateEl = $(prefix ? `${prefix}CashflowDate` : "cashflowDate");
  const noteEl = $(prefix ? `${prefix}CashflowNote` : "cashflowNote");
  const amount = parseMoneyInput(amountEl.value);
  if (!amount || amount <= 0) {
    alert("請輸入資金金額。");
    return false;
  }
  const journal = getJournal();
  const type = typeEl.value;
  const flow = normalizeCashflow({
    id: crypto.randomUUID(),
    date: dateEl?.value || currentDate(),
    type,
    amount,
    note: noteEl?.value.trim() || "",
  });
  if (type === "initial") {
    journal.cashflows = (journal.cashflows || []).filter((item) => item.type !== "initial");
  }
  journal.cashflows = [flow, ...(journal.cashflows || [])];
  saveJournal(journal);
  amountEl.value = "";
  if (noteEl) noteEl.value = "";
  renderAll();
  return true;
}

function addCashflow() {
  addCashflowFrom("");
}

function deleteCashflow(id) {
  const journal = getJournal();
  journal.cashflows = (journal.cashflows || []).filter((flow) => flow.id !== id);
  saveJournal(journal);
  renderAll();
}

function renderAll() {
  renderAppSettings();
  renderMarketSession();
  const journal = getJournal();
  renderStats(journal);
  try { renderOpen(journal.open); } catch (error) { console.error(error); }
  try { renderClosed(journal.closed); } catch (error) { console.error(error); }
  try { renderCalendar(journal.closed); } catch (error) { console.error(error); }
  try { renderLazyBrief(journal); } catch (error) { console.error(error); }
  applyLanguageText();
}

function renderMarketSession() {
  const open = isMarketOpen();
  document.body.dataset.marketSession = state.settings.sessionTheme === false ? "manual" : open ? "open" : "closed";
  setText(".hello-copy span", topbarDateTime());
  const label = $("marketSessionLabel");
  if (label) {
    label.textContent = open ? "台股開盤中 · 即時模式" : "台股收盤 · 收盤模式";
  }
  if (label) {
    const en = state.settings.language === "en";
    label.textContent = open
      ? (en ? "TW market open · Live mode" : "台股開盤中 · 即時模式")
      : (en ? "TW market closed · Closed mode" : "台股收盤 · 收盤模式");
  }
}

function renderLazyBrief(journal) {
  const box = $("lazyBrief");
  if (!box) return;
  const today = currentDate();
  const danger = journal.open.filter((trade) => ["danger", "broken"].includes(stopLevel(trade).className));
  const unreviewed = journal.closed.filter((trade) => !trade.exitNote && !toArray(trade.reviewMistakes).length);
  const tradedToday = [...journal.open, ...journal.closed].some((trade) => trade.entryTime === today || trade.exitTime === today);
  const insight = weeklyInsight(journal.closed);
  const items = [
    danger.length ? `${danger.length} 筆接近停損` : "停損狀態正常",
    unreviewed.length ? `${unreviewed.length} 筆平倉未補檢討` : "平倉檢討已完成",
    tradedToday ? "今天已有交易紀錄" : "今天尚未記錄交易",
  ];
  box.innerHTML = `
    <div class="brief-main">
      <span>今日待處理</span>
      <strong>${items[0]}</strong>
    </div>
    <div class="brief-list">
      ${items.map((item) => `<span>${item}</span>`).join("")}
    </div>
    <p>${insight}</p>
  `;
}

function weeklyInsight(closedTrades) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const start = weekAgo.toISOString().slice(0, 10);
  const trades = closedTrades.filter((trade) => (trade.exitTime || "") >= start);
  if (!trades.length) return "這週還沒有平倉資料，先累積樣本。";
  const total = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const planned = trades.filter((trade) => trade.planFollowed === "照計畫");
  const badReason = bestLabel(trades.filter((trade) => Number(trade.pnl || 0) < 0), false);
  if (badReason) return `這週${signedMoney(total)}，虧損單常出現在「${badReason}」，下次進場前先確認它是不是必要條件。`;
  if (planned.length) return `這週${signedMoney(total)}，照計畫的單占 ${Math.round(planned.length / trades.length * 100)}%，繼續保留這個節奏。`;
  return `這週${signedMoney(total)}，先把每筆平倉補上「有沒有照計畫」。`;
}

function isMarketOpen(now = new Date()) {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes <= 13 * 60 + 30;
}

function quoteItemsForOpenTrades() {
  const journal = getJournal();
  const map = new Map();
  journal.open.forEach((trade) => {
    if (trade.code) map.set(trade.code, { code: trade.code, market: trade.market || "上市" });
  });
  if (state.selectedStock?.code) {
    map.set(state.selectedStock.code, { code: state.selectedStock.code, market: state.selectedStock.market || "上市" });
  }
  return [...map.values()];
}

async function updateHeldQuotes() {
  if (!state.liveMode) {
    renderAll();
    return;
  }
  const items = quoteItemsForOpenTrades();
  if (!items.length) return;
  try {
    const encoded = items.map((item) => `${item.code}:${item.market}`).join(",");
    const data = await fetchJson(`/api/quotes?items=${encodeURIComponent(encoded)}`);
    (data.quotes || []).forEach((quote) => {
      const price = isMarketOpen() ? quote.price : quote.close;
      state.lastPrices[quote.code] = Number(price) || null;
    });
    renderAll();
  } catch {
    renderAll();
  }
}

function startQuotePolling() {
  clearInterval(state.quoteTimer);
  updateHeldQuotes();
  state.quoteTimer = setInterval(updateHeldQuotes, isMarketOpen() ? 30000 : 300000);
}

function renderOpen(openTrades) {
  const list = $("openList");
  const template = $("openTemplate");
  const previousScrollTop = list.scrollTop || 0;
  list.innerHTML = "";
  $("openCount").textContent = openTrades.length;
  if ($("openTitleCount")) $("openTitleCount").textContent = openTrades.length;
  if (!openTrades.length) {
    list.innerHTML = `<p class="empty-note">目前沒有持有單。按右上「＋買進」就能新增。</p>`;
    return;
  }
  const sortedTrades = [...openTrades].sort((a, b) => dangerRank(b) - dangerRank(a));
  sortedTrades.forEach((trade) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".trade-title").textContent = `${trade.code} ${trade.name}`;
    const risk = trade.riskAmount || riskAmount(trade.entryPrice, trade.stopPrice, trade.shares, trade.code);
    const buyFee = trade.buyFee || buyCost(trade.entryPrice, trade.shares).fee;
    const stopSell = sellProceeds(trade.stopPrice, trade.shares, trade.code);
    const scores = trade.typeScores || typeScores(toArray(trade.analysisType), toArray(trade.reason));
    const scoreText = Object.entries(scores).map(([type, score]) => `${type}${score}`).join(" / ");
    node.querySelector(".trade-meta").textContent = `${trade.entryPrice} 元 · ${trade.shares} 股 · 風險 ${formatMoney(risk)} · 買手續 ${formatMoney(buyFee)} · 停損賣手續 ${formatMoney(stopSell.fee)} · 稅 ${formatMoney(stopSell.tax)} · ${joinLabels(trade.reason)} · ${scoreText}`;
    const tagRow = node.querySelector(".tag-row");
    toArray(trade.autoTags || autoTagsForTrade(trade)).forEach((tag) => addTag(tagRow, tag));
    const level = stopLevel(trade);
    const pill = node.querySelector(".risk-pill");
    pill.textContent = `${level.label} ${trade.stopPrice || "--"}`;
    pill.className = `risk-pill ${level.className}`;
    const alertNode = node.querySelector(".price-alert");
    const showStopAlert = state.settings.stopAlert !== false;
    alertNode.hidden = !showStopAlert;
    alertNode.textContent = showStopAlert ? stopAlertText(trade) : "";
    alertNode.classList.toggle("warn", showStopAlert && isNearStop(trade));
    node.querySelector(".edit-button").addEventListener("click", () => openEditSheet(trade.id));
    node.querySelector(".close-button").addEventListener("click", () => openCloseSheet(trade.id));
    list.appendChild(node);
  });
  list.scrollTop = previousScrollTop;
}

function dangerRank(trade) {
  const distance = stopDistancePercent(trade);
  if (distance !== null) return 1000 - distance;
  return Number(trade.riskAmount || riskAmount(trade.entryPrice, trade.stopPrice, trade.shares));
}

function currentPriceForTrade(trade) {
  return state.lastPrices[trade.code] || null;
}

function stopDistancePercent(trade) {
  const price = currentPriceForTrade(trade);
  const stop = Number(trade.stopPrice);
  if (!price || !stop) return null;
  return ((price - stop) / price) * 100;
}

function isNearStop(trade) {
  const distance = stopDistancePercent(trade);
  return distance !== null && distance >= 0 && distance <= stopAlertPercent;
}

function stopAlertText(trade) {
  const price = currentPriceForTrade(trade);
  const distance = stopDistancePercent(trade);
  if (!price || distance === null) {
    return state.liveMode ? "現價/收盤價更新中" : "現價/收盤價：需用 localhost 開啟";
  }
  if (distance < 0) return `已跌破停損 ${Math.abs(distance).toFixed(1)}%`;
  if (distance <= stopAlertPercent) return `離停損 ${distance.toFixed(1)}% 內`;
  return `離停損 ${distance.toFixed(1)}%`;
}

function stopLevel(trade) {
  const distance = stopDistancePercent(trade);
  if (distance === null) return { label: "未更新", className: "unknown" };
  if (distance < 0) return { label: "破線", className: "broken" };
  if (distance <= 3) return { label: "危險", className: "danger" };
  if (distance <= 8) return { label: "注意", className: "watch" };
  return { label: "安全", className: "safe" };
}

function renderClosed(closedTrades) {
  const list = $("closedList");
  const template = $("closedTemplate");
  list.innerHTML = "";
  $("closedCount").textContent = closedTrades.length;
  if ($("closedTitleCount")) $("closedTitleCount").textContent = closedTrades.length;
  if (!closedTrades.length) {
    list.innerHTML = `<p class="empty-note">還沒有平倉紀錄。</p>`;
    return;
  }
  closedTrades.forEach((trade) => {
    const node = template.content.cloneNode(true);
    const pnl = node.querySelector(".closed-pnl");
    pnl.textContent = signedMoney(trade.pnl);
    pnl.classList.toggle("profit", trade.pnl > 0);
    pnl.classList.toggle("loss", trade.pnl < 0);
    node.querySelector(".trade-title").textContent = `${trade.code} ${trade.name}`;
    const buyFee = trade.buyFee ?? buyCost(trade.entryPrice, trade.shares).fee;
    const sellFee = trade.sellFee ?? sellProceeds(trade.exitPrice, trade.shares).fee;
    const tax = trade.tax ?? sellProceeds(trade.exitPrice, trade.shares).tax;
    node.querySelector(".trade-meta").textContent = `${trade.entryPrice} → ${trade.exitPrice} · ${trade.shares} 股 · 買手續 ${formatMoney(buyFee)} · 賣手續 ${formatMoney(sellFee)} · 證交稅 ${formatMoney(tax)} · ${trade.exitReason} · ${trade.planFollowed || "未記錄計畫"}`;
    node.querySelector(".closed-review").textContent = trade.reviewLine || generateReviewLine(trade);
    const row = node.querySelector(".tag-row");
    [...toArray(trade.analysisType), ...toArray(trade.reason), ...toArray(trade.autoTags || autoTagsForTrade(trade)), ...(trade.reviewMistakes || [])].filter(Boolean).forEach((tag) => addTag(row, tag));
    list.appendChild(node);
  });
}

function addTag(container, text) {
  const span = document.createElement("span");
  span.textContent = text;
  container.appendChild(span);
}

function renderStats(journal) {
  const total = journal.closed.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  $("totalPnl").textContent = signedMoney(total);
  $("totalPnl").classList.toggle("profit", total > 0);
  $("totalPnl").classList.toggle("loss", total < 0);
  renderAccount(journal);
  try { renderEquityChart(journal); } catch (error) { console.error(error); }

  const start = $("rangeStart").value;
  const end = $("rangeEnd").value;
  const from = start && end && start > end ? end : start;
  const to = start && end && start > end ? start : end;
  const rangeTotal = journal.closed
    .filter((trade) => {
      const exitTime = trade.exitTime || "";
      if (from && exitTime < from) return false;
      if (to && exitTime > to) return false;
      return true;
    })
    .reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  $("rangePnl").textContent = signedMoney(rangeTotal);
  $("rangePnl").classList.toggle("profit", rangeTotal > 0);
  $("rangePnl").classList.toggle("loss", rangeTotal < 0);
  renderHeroRangeStats(journal, rangeTotal, to);
  renderMonthlyReport(journal.closed);
  renderScoreTable(journal.closed);
  renderConditionTable(journal.closed);
}

function cashflowLabel(type) {
  return { initial: "初始資金", deposit: "入金", withdraw: "出金" }[type] || "入金";
}

function cashflowSignedAmount(flow) {
  const amount = Math.abs(Number(flow.amount || 0));
  return flow.type === "withdraw" ? -amount : amount;
}

function openUnrealizedPnl(openTrades) {
  return openTrades.reduce((sum, trade) => {
    const price = currentPriceForTrade(trade);
    if (!price) return sum;
    const result = netPnl(trade.entryPrice, price, trade.shares, trade.code);
    return sum + Number(result.pnl || 0);
  }, 0);
}

function accountSummary(journal) {
  const cashflows = (journal.cashflows || []).map(normalizeCashflow);
  const cashflowTotal = cashflows.reduce((sum, flow) => sum + cashflowSignedAmount(flow), 0);
  const deposits = cashflows.filter((flow) => flow.type === "deposit").reduce((sum, flow) => sum + Math.abs(Number(flow.amount || 0)), 0);
  const withdrawals = cashflows.filter((flow) => flow.type === "withdraw").reduce((sum, flow) => sum + Math.abs(Number(flow.amount || 0)), 0);
  const realized = journal.closed.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const unrealized = openUnrealizedPnl(journal.open || []);
  return {
    cashflowTotal,
    deposits,
    withdrawals,
    realized,
    unrealized,
    equity: cashflowTotal + realized + unrealized,
  };
}

function accountSummaryThrough(journal, endDate) {
  const end = endDate || currentDate();
  const cashflows = (journal.cashflows || []).map(normalizeCashflow).filter((flow) => flow.date <= end);
  const cashflowTotal = cashflows.reduce((sum, flow) => sum + cashflowSignedAmount(flow), 0);
  const deposits = cashflows.filter((flow) => flow.type === "deposit").reduce((sum, flow) => sum + Math.abs(Number(flow.amount || 0)), 0);
  const withdrawals = cashflows.filter((flow) => flow.type === "withdraw").reduce((sum, flow) => sum + Math.abs(Number(flow.amount || 0)), 0);
  const realized = (journal.closed || [])
    .filter((trade) => String(trade.exitTime || "").slice(0, 10) <= end)
    .reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const unrealized = end >= currentDate() ? openUnrealizedPnl(journal.open || []) : 0;
  return {
    cashflowTotal,
    deposits,
    withdrawals,
    realized,
    unrealized,
    equity: cashflowTotal + realized + unrealized,
  };
}

function renderHeroRangeStats(journal, rangeTotal, endDate) {
  const app = document.querySelector(".app");
  if (app?.dataset.activeTab !== "stats") return;
  const summary = accountSummaryThrough(journal, endDate || currentDate());
  if ($("heroAccountEquity")) $("heroAccountEquity").textContent = formatMoney(summary.equity);
  if ($("totalPnl")) {
    $("totalPnl").textContent = signedMoney(rangeTotal);
    $("totalPnl").classList.toggle("profit", rangeTotal > 0);
    $("totalPnl").classList.toggle("loss", rangeTotal < 0);
  }
  if ($("equityStatus")) {
    $("equityStatus").textContent = `區間資金 ${formatMoney(summary.equity)} · 交易 ${signedMoney(rangeTotal)}`;
  }
}

function renderAccount(journal) {
  if (!$("accountEquity")) return;
  const summary = accountSummary(journal);
  $("accountEquity").textContent = formatMoney(summary.equity);
  $("accountTradePnl").textContent = signedMoney(summary.realized + summary.unrealized);
  $("accountTradePnl").classList.toggle("profit", summary.realized + summary.unrealized > 0);
  $("accountTradePnl").classList.toggle("loss", summary.realized + summary.unrealized < 0);
  $("accountDeposits").textContent = formatMoney(summary.deposits);
  $("accountWithdrawals").textContent = formatMoney(summary.withdrawals);
  if ($("quickAccountEquity")) {
    const strategy = summary.realized + summary.unrealized;
    $("quickAccountEquity").textContent = formatMoney(summary.equity);
    $("quickStrategyPnl").textContent = signedMoney(strategy);
    $("quickStrategyPnl").classList.toggle("profit", strategy > 0);
    $("quickStrategyPnl").classList.toggle("loss", strategy < 0);
  }
  if ($("heroAccountEquity")) {
    $("heroAccountEquity").textContent = formatMoney(summary.equity);
  }
  const box = $("cashflowList");
  const flows = [...(journal.cashflows || [])].map(normalizeCashflow).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!flows.length) {
    box.innerHTML = `<p class="empty-note">先新增初始資金，之後每次入金或出金都記在這裡。</p>`;
    return;
  }
  box.innerHTML = flows.map((flow) => `
    <div class="cashflow-row">
      <div>
        <strong>${cashflowLabel(flow.type)}</strong>
        <span>${flow.date}${flow.note ? ` · ${flow.note}` : ""}</span>
      </div>
      <b class="${cashflowSignedAmount(flow) >= 0 ? "profit" : "loss"}">${signedMoney(cashflowSignedAmount(flow))}</b>
      <button type="button" data-delete-cashflow="${flow.id}" aria-label="刪除資金紀錄">刪除</button>
    </div>
  `).join("");
}

function monthDate(monthText) {
  const [year, month] = String(monthText || currentMonth()).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function shiftMonth(monthText, amount) {
  const date = monthDate(monthText);
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calendarMonthLabel(monthText) {
  const date = monthDate(monthText);
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月`;
}

function calendarCells(monthText) {
  const first = monthDate(monthText);
  const start = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const end = new Date(last);
  const sundayOffset = 6 - ((last.getDay() + 6) % 7);
  end.setDate(last.getDate() + sundayOffset);
  const dayCount = Math.round((end - start) / 86400000) + 1;
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      value,
      day: date.getDate(),
      inMonth: value.slice(0, 7) === monthText,
    };
  });
}

function calendarDailyStats(closedTrades, monthText) {
  const map = new Map();
  closedTrades
    .filter((trade) => (trade.exitTime || "").slice(0, 7) === monthText)
    .forEach((trade) => {
      const date = (trade.exitTime || "").slice(0, 10);
      const row = map.get(date) || { date, count: 0, wins: 0, plan: 0, pnl: 0 };
      const pnl = Number(trade.pnl || 0);
      row.count += 1;
      row.wins += pnl > 0 ? 1 : 0;
      row.plan += trade.planFollowed === "照計畫" ? 1 : 0;
      row.pnl += pnl;
      map.set(date, row);
    });
  return map;
}

function calendarTone(row) {
  if (!row || !row.count) return "";
  if (row.pnl > 0) return "good";
  if (row.pnl < 0) return "bad";
  if (state.calendarMode === "pnl") return "flat";
  const rate = row.plan / row.count;
  if (rate >= .8) return "good";
  if (rate >= .5) return "warn";
  return "bad";
}

function renderCalendar(closedTrades) {
  const grid = $("calendarGrid");
  if (!grid) return;
  const calendarCard = grid.closest(".calendar-card");
  const tooltip = $("calendarTooltip") || document.createElement("div");
  tooltip.id = "calendarTooltip";
  tooltip.className = "chart-tooltip calendar-tooltip";
  if (calendarCard && !tooltip.parentNode) calendarCard.appendChild(tooltip);
  const hideTooltip = () => {
    tooltip.hidden = true;
  };
  grid.onmouseleave = hideTooltip;
  const month = state.calendarMonth || currentMonth();
  state.calendarMonth = month;
  const daily = calendarDailyStats(closedTrades, month);
  const monthTrades = [...daily.values()];
  const totalTrades = monthTrades.reduce((sum, row) => sum + row.count, 0);
  const totalPnl = monthTrades.reduce((sum, row) => sum + row.pnl, 0);
  const totalPlan = monthTrades.reduce((sum, row) => sum + row.plan, 0);
  const planRate = totalTrades ? Math.round(totalPlan / totalTrades * 100) : 0;

  $("calendarMonthLabel").textContent = calendarMonthLabel(month);
  $("calendarSummary").textContent = totalTrades
    ? `${totalTrades} 筆平倉 · ${signedMoney(totalPnl)} · 照計畫 ${planRate}%`
    : "這個月還沒有平倉紀錄。";
  const highlightBox = $("calendarHighlights");
  if (highlightBox) {
    const bestDay = monthTrades.reduce((best, row) => (!best || row.pnl > best.pnl ? row : best), null);
    const worstDay = monthTrades.reduce((worst, row) => (!worst || row.pnl < worst.pnl ? row : worst), null);
    highlightBox.innerHTML = totalTrades ? `
      <div><span>本月損益</span><small>全部交易</small><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${signedMoney(totalPnl)}</strong></div>
      <div><span>最好一天</span><small>${bestDay ? bestDay.date.slice(5).replace("-", "/") : "--"}</small><strong class="${(bestDay?.pnl || 0) >= 0 ? "profit" : "loss"}">${bestDay ? signedMoney(bestDay.pnl) : "--"}</strong></div>
      <div><span>最差一天</span><small>${worstDay ? worstDay.date.slice(5).replace("-", "/") : "--"}</small><strong class="${(worstDay?.pnl || 0) >= 0 ? "profit" : "loss"}">${worstDay ? signedMoney(worstDay.pnl) : "--"}</strong></div>
    ` : `
      <div><span>本月損益</span><small>全部交易</small><strong>--</strong></div>
      <div><span>最好一天</span><small>--</small><strong>--</strong></div>
      <div><span>最差一天</span><small>--</small><strong>--</strong></div>
    `;
  }

  document.querySelectorAll("[data-calendar-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.calendarMode === state.calendarMode);
  });

  grid.replaceChildren();
  const cells = calendarCells(month);
  grid.dataset.renderedCells = String(cells.length);
  cells.forEach((cell) => {
    const row = daily.get(cell.value);
    const tone = calendarTone(row);
    const amount = signedMoney(row?.pnl || 0);
    const day = document.createElement("div");
    const isWeekend = [0, 6].includes(new Date(`${cell.value}T00:00:00`).getDay());
    const isToday = cell.value === currentDate();
    day.className = `calendar-day ${cell.inMonth ? "" : "muted"} ${isWeekend && cell.inMonth ? "weekend" : ""} ${row?.count ? "has-trades" : ""} ${isToday ? "today" : ""}`;
    day.dataset.date = cell.value;
    const dayNumber = document.createElement("span");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = cell.inMonth ? String(cell.day) : "";
    day.appendChild(dayNumber);
    if (cell.inMonth && row?.count) {
      const result = document.createElement("div");
      result.className = `calendar-result ${tone}`;
      const money = document.createElement("strong");
      const rate = row.count ? Math.round(row.plan / row.count * 100) : 0;
      money.textContent = state.calendarMode === "plan" ? `${rate}%` : signedCompactMoney(row?.pnl || 0);
      const count = document.createElement("span");
      count.textContent = state.calendarMode === "plan" ? `${row.count} 筆照計畫` : `${row.count} 筆`;
      result.appendChild(money);
      result.appendChild(count);
      day.appendChild(result);
      const showTooltip = (event) => {
        if (!calendarCard) return;
        const rect = calendarCard.getBoundingClientRect();
        tooltip.hidden = false;
        tooltip.innerHTML = `
          <strong>${cell.value}</strong>
          <span>當日損益 ${signedMoney(row.pnl)}</span>
          <span>平倉 ${row.count} 筆 · 照計畫 ${rate}%</span>
          <span>平均 ${signedMoney(row.pnl / row.count)}</span>
        `;
        tooltip.style.left = `${Math.min(rect.width - 174, Math.max(8, event.clientX - rect.left + 10))}px`;
        tooltip.style.top = `${Math.min(rect.height - 96, Math.max(8, event.clientY - rect.top - 20))}px`;
      };
      day.addEventListener("mouseenter", showTooltip);
      day.addEventListener("mousemove", showTooltip);
      day.addEventListener("mouseleave", hideTooltip);
    }
    grid.appendChild(day);
  });
  if (!grid.children.length) {
    grid.textContent = "日曆載入失敗，請重新整理。";
  }
  hideTooltip();
}

function renderEquityChart(journal) {
  const svg = $("equityChart");
  const status = $("equityStatus");
  if (!svg || !status) return;

  const closedTrades = journal.closed || [];
  const flows = (journal.cashflows || []).map(normalizeCashflow);
  const dailyEvents = new Map();

  flows.forEach((flow) => {
    const date = flow.date;
    const row = dailyEvents.get(date) || { date, pnl: 0, cash: 0, count: 0, wins: 0, flowCount: 0 };
    row.cash += cashflowSignedAmount(flow);
    row.flowCount += 1;
    dailyEvents.set(date, row);
  });

  const dailyTrades = [...closedTrades]
    .filter((trade) => trade.exitTime)
    .reduce((map, trade) => {
      const date = String(trade.exitTime).slice(0, 10);
      const row = map.get(date) || { date, pnl: 0, cash: 0, count: 0, wins: 0, flowCount: 0 };
      const pnl = Number(trade.pnl || 0);
      row.pnl += pnl;
      row.count += 1;
      row.wins += pnl > 0 ? 1 : 0;
      map.set(date, row);
      return map;
    }, dailyEvents);
  const trades = [...dailyTrades.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (!trades.length) {
    status.textContent = "尚無資金紀錄";
    svg.innerHTML = `
      <line class="chart-grid" x1="8" y1="90" x2="312" y2="90"></line>
      <path class="chart-empty" d="M 12 122 C 70 64, 122 124, 176 74 S 268 104, 308 54"></path>
      <text class="chart-empty-text" x="160" y="164" text-anchor="middle">平倉後這裡會自動畫出賺賠曲線</text>
    `;
    return;
  }

  let runningTotal = 0;
  let strategyTotal = 0;
  const values = trades.map((day) => {
    runningTotal += Number(day.cash || 0) + Number(day.pnl || 0);
    return runningTotal;
  });
  const strategyValues = trades.map((day) => {
    strategyTotal += Number(day.pnl || 0);
    return strategyTotal;
  });
  const summary = accountSummary(journal);
  if (values.length) values[values.length - 1] = summary.equity;
  if (strategyValues.length) strategyValues[strategyValues.length - 1] = summary.realized + summary.unrealized;
  const total = summary.equity;
  const tradeCount = trades.reduce((sum, day) => sum + day.count, 0);
  const flowCount = trades.reduce((sum, day) => sum + day.flowCount, 0);
  const wins = trades.reduce((sum, day) => sum + day.wins, 0);
  const winRate = Math.round(wins / Math.max(1, tradeCount) * 100);

  const width = 320;
  const height = 180;
  const padX = 10;
  const padY = 12;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  const accountMin = Math.min(...values);
  const accountMax = Math.max(...values);
  const accountRange = accountMax - accountMin || Math.max(1, Math.abs(accountMax || 1));
  const accountMinY = accountMin - accountRange * .12;
  const accountMaxY = accountMax + accountRange * .12;
  const accountRangeY = accountMaxY - accountMinY || 1;
  const strategyMin = Math.min(...strategyValues, 0);
  const strategyMax = Math.max(...strategyValues, 0);
  const strategyRange = strategyMax - strategyMin || Math.max(1, Math.abs(strategyMax || 1));
  const strategyMinY = strategyMin - strategyRange * .18;
  const strategyMaxY = strategyMax + strategyRange * .18;
  const strategyRangeY = strategyMaxY - strategyMinY || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padX + index / (values.length - 1) * plotWidth;
    const y = padY + (accountMaxY - value) / accountRangeY * plotHeight;
    return { x, y, value };
  });
  const strategyPoints = strategyValues.map((value, index) => {
    const x = strategyValues.length === 1 ? width / 2 : padX + index / (strategyValues.length - 1) * plotWidth;
    const y = padY + (strategyMaxY - value) / strategyRangeY * plotHeight;
    return { x, y, value };
  });
  const labelIndexes = trades.length <= 4
    ? trades.map((_, index) => index)
    : [0, Math.floor((trades.length - 1) / 2), trades.length - 1];
  const dateLabels = [...new Set(labelIndexes)].map((index) => ({
    text: trades[index].date.slice(5).replace("-", "/"),
    x: points[index].x,
    anchor: index === 0 ? "start" : index === trades.length - 1 ? "end" : "middle",
  }));
  const line = points.length === 1
    ? `M ${padX} ${points[0].y.toFixed(1)} L ${width - padX} ${points[0].y.toFixed(1)}`
    : points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const strategyLine = strategyPoints.length === 1
    ? `M ${padX} ${strategyPoints[0].y.toFixed(1)} L ${width - padX} ${strategyPoints[0].y.toFixed(1)}`
    : strategyPoints.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area = points.length === 1
    ? `M ${padX} ${(height - padY).toFixed(1)} L ${padX} ${points[0].y.toFixed(1)} L ${width - padX} ${points[0].y.toFixed(1)} L ${width - padX} ${(height - padY).toFixed(1)} Z`
    : `M ${points[0].x.toFixed(1)} ${(height - padY).toFixed(1)} ${points.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")} L ${points.at(-1).x.toFixed(1)} ${(height - padY).toFixed(1)} Z`;
  const zeroY = padY + (strategyMaxY - 0) / strategyRangeY * plotHeight;
  const tradePnlTotal = closedTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const tone = tradePnlTotal >= 0 ? "profit" : "loss";
  const last = points.length === 1 ? { ...points[0], x: width - padX } : points.at(-1);
  const tradeDots = points
    .map((point, index) => trades[index].count ? `<circle class="chart-dot trade-day-dot ${trades[index].pnl >= 0 ? "profit" : "loss"}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.2"></circle>` : "")
    .join("");
  const strategyDots = strategyPoints
    .map((point, index) => trades[index].count ? `<circle class="chart-dot strategy-day-dot ${trades[index].pnl >= 0 ? "profit" : "loss"}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.4"></circle>` : "")
    .join("");

  status.textContent = `帳戶 ${formatMoney(total)} · 策略 ${signedMoney(summary.realized + summary.unrealized)}`;
  const hitWidth = Math.max(18, plotWidth / Math.max(1, trades.length));
  svg.innerHTML = `
    <line class="chart-grid" x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}"></line>
    <line class="chart-grid" x1="${padX}" y1="${height / 2}" x2="${width - padX}" y2="${height / 2}"></line>
    <line class="chart-grid" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line>
    <line class="chart-zero" x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${width - padX}" y2="${zeroY.toFixed(1)}"></line>
    <path class="chart-area account-area" d="${area}"></path>
    <path class="chart-line account-line" d="${line}"></path>
    ${$("showStrategyLine")?.checked ? `<path class="chart-line strategy-line ${tone}" d="${strategyLine}"></path>` : ""}
    ${$("showStrategyLine")?.checked ? strategyDots : ""}
    ${tradeDots}
    <circle class="chart-dot account-dot" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4"></circle>
    ${dateLabels.map((label) => `<text class="chart-date" x="${label.x.toFixed(1)}" y="${height - 2}" text-anchor="${label.anchor}">${label.text}</text>`).join("")}
    ${trades.map((day, index) => `
      <rect class="chart-hit" x="${(points[index].x - hitWidth / 2).toFixed(1)}" y="0" width="${hitWidth.toFixed(1)}" height="${height}" fill="transparent">
        <title>${day.date}
帳戶資金：${formatMoney(values[index])}
策略損益：${signedMoney(strategyValues[index])}
當日交易損益：${signedMoney(day.pnl)}
出入金：${signedMoney(day.cash)}
平倉：${day.count} 筆</title>
      </rect>
    `).join("")}
    <line id="chartCursorLine" class="chart-cursor-line" x1="-10" y1="${padY}" x2="-10" y2="${height - padY}"></line>
  `;
  setupChartCursor(trades, points, values, strategyValues);
}

function setupChartCursor(days, points, accountValues, strategyValues) {
  const svg = $("equityChart");
  const tooltip = $("chartTooltip") || document.createElement("div");
  tooltip.id = "chartTooltip";
  tooltip.className = "chart-tooltip";
  if (!tooltip.parentNode) svg.parentNode.appendChild(tooltip);
  const line = svg.querySelector("#chartCursorLine");
  const hide = () => {
    tooltip.hidden = true;
    if (line) {
      line.setAttribute("x1", "-10");
      line.setAttribute("x2", "-10");
    }
  };
  svg.onmouseleave = hide;
  svg.onmousemove = (event) => {
    const rect = svg.getBoundingClientRect();
    const ratioX = (event.clientX - rect.left) / rect.width * 320;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(point.x - ratioX) < Math.abs(points[nearest].x - ratioX)) nearest = index;
    });
    const point = points[nearest];
    const day = days[nearest];
    if (line) {
      line.setAttribute("x1", point.x.toFixed(1));
      line.setAttribute("x2", point.x.toFixed(1));
    }
    tooltip.hidden = false;
    tooltip.innerHTML = `
      <strong>${day.date}</strong>
      <span>帳戶 ${formatMoney(accountValues[nearest])}</span>
      ${$("showStrategyLine")?.checked ? `<span>策略 ${signedMoney(strategyValues[nearest])}</span>` : ""}
      <span>當日 ${signedMoney(day.pnl)} · 出入金 ${signedMoney(day.cash)}</span>
    `;
    tooltip.style.left = `${Math.min(rect.width - 168, Math.max(8, event.clientX - rect.left + 10))}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 24)}px`;
  };
  hide();
}

function renderMonthlyReport(closedTrades) {
  const month = ($("rangeEnd").value || currentDate()).slice(0, 7);
  const trades = closedTrades.filter((trade) => (trade.exitTime || "").slice(0, 7) === month);
  const box = $("monthlyReport");
  if (!trades.length) {
    box.innerHTML = `<p class="empty-note">${month} 還沒有平倉資料。</p>`;
    return;
  }
  const total = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const wins = trades.filter((trade) => Number(trade.pnl || 0) > 0);
  const losses = trades.filter((trade) => Number(trade.pnl || 0) < 0);
  const avgWin = wins.length ? wins.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0) / losses.length : 0;
  const maxLoss = losses.length ? Math.min(...losses.map((trade) => Number(trade.pnl || 0))) : 0;
  const planRate = Math.round(trades.filter((trade) => trade.planFollowed === "照計畫").length / trades.length * 100);
  const bestReason = bestLabel(trades, true);
  const worstReason = bestLabel(trades, false);
  box.innerHTML = `
    <div class="report-grid">
      <div><span>總損益</span><strong class="${total >= 0 ? "profit" : "loss"}">${signedMoney(total)}</strong></div>
      <div><span>勝率</span><strong>${Math.round(wins.length / trades.length * 100)}%</strong></div>
      <div><span>平均賺</span><strong>${formatMoney(avgWin)}</strong></div>
      <div><span>平均賠</span><strong>${formatMoney(avgLoss)}</strong></div>
      <div><span>最大虧損</span><strong class="loss">${formatMoney(maxLoss)}</strong></div>
      <div><span>照計畫率</span><strong>${planRate}%</strong></div>
    </div>
    <div class="pnl-bars">
      ${trades.map((trade) => {
        const pnl = Number(trade.pnl || 0);
        const width = Math.max(8, Math.min(100, Math.abs(pnl) / Math.max(1, Math.abs(maxLoss), Math.abs(total)) * 100));
        return `<div class="pnl-bar-row"><span>${trade.code}</span><div class="pnl-track"><b class="${pnl >= 0 ? "profit-bg" : "loss-bg"}" style="width:${width}%"></b></div><em class="${pnl >= 0 ? "profit" : "loss"}">${signedMoney(pnl)}</em></div>`;
      }).join("")}
    </div>
    <p class="report-line">最常賺錢理由：${bestReason || "--"}</p>
    <p class="report-line">最常賠錢理由：${worstReason || "--"}</p>
  `;
}

function bestLabel(trades, positive) {
  const scores = new Map();
  trades.forEach((trade) => {
    const pnl = Number(trade.pnl || 0);
    if (positive && pnl <= 0) return;
    if (!positive && pnl >= 0) return;
    toArray(trade.reason).forEach((label) => {
      scores.set(label, (scores.get(label) || 0) + pnl);
    });
  });
  return [...scores.entries()].sort((a, b) => positive ? b[1] - a[1] : a[1] - b[1])[0]?.[0];
}

function renderScoreTable(closedTrades) {
  const labels = [...analysisOptions, ...Object.values(reasonGroups).flat()];
  const uniqueLabels = [...new Set(labels)];
  const history = new Map(scoreRows(closedTrades).map((row) => [row.label, row]));
  const sorted = uniqueLabels.map((label) => {
    const row = history.get(label);
    const preset = presetWeight(label);
    return {
      label,
      preset,
      count: row ? row.count : 0,
      winRate: row ? row.winRate : 0,
      score: row ? row.score : 0,
      adjusted: row ? adjustedWeight(preset, row) : preset,
    };
  }).sort((a, b) => b.preset - a.preset || b.score - a.score);

  const box = $("scoreTable");
  if (!sorted.length) {
    box.innerHTML = `<p class="empty-note">平倉後會自動統計：哪個分析類型、買進理由比較有貢獻。</p>`;
    return;
  }
  box.innerHTML = sorted.map((row) => `
    <div class="score-row">
      <strong>${row.label}</strong>
      <span>預設 ${row.preset} · 修正 ${row.adjusted} · ${row.count} 筆 · 勝率 ${Math.round(row.winRate * 100)}%</span>
      <b class="${row.score >= 0 ? "profit" : "loss"}">${row.count ? signedMoney(row.score) : "未驗證"}</b>
    </div>
  `).join("");
}

function adjustedWeight(preset, row) {
  const performance = row.weightedPnl > 0 ? 6 : row.weightedPnl < 0 ? -6 : 0;
  const winBonus = row.winRate >= 0.6 ? 4 : row.winRate <= 0.4 ? -4 : 0;
  return Math.max(0, Math.min(100, preset + performance + winBonus));
}

function renderConditionTable(closedTrades) {
  const box = $("conditionTable");
  const rows = conditionRows(closedTrades);
  if (!rows.length) {
    box.innerHTML = `<p class="empty-note">平倉資料累積後，這裡會判斷哪些條件比較像必要條件。</p>`;
    return;
  }
  box.innerHTML = rows.map((row) => `
    <div class="condition-row ${row.levelClass}">
      <div>
        <strong>${row.label}</strong>
        <span>${row.kind} · ${row.count} 筆 · 勝率 ${Math.round(row.winRate * 100)}% · 平均 ${signedMoney(row.avgPnl)}</span>
      </div>
      <b>${row.level}</b>
    </div>
  `).join("");
}

function conditionRows(closedTrades) {
  const rows = new Map();
  closedTrades.forEach((trade) => {
    const pnl = Number(trade.pnl || 0);
    [
      ...toArray(trade.analysisType).map((label) => ({ label, kind: "分析類型" })),
      ...toArray(trade.reason).map((label) => ({ label, kind: "買進理由" })),
    ].forEach((item) => {
      const key = `${item.kind}:${item.label}`;
      const row = rows.get(key) || { ...item, count: 0, wins: 0, totalPnl: 0 };
      row.count += 1;
      row.wins += pnl > 0 ? 1 : 0;
      row.totalPnl += pnl;
      rows.set(key, row);
    });
  });

  return [...rows.values()]
    .map((row) => {
      const winRate = row.count ? row.wins / row.count : 0;
      const avgPnl = row.count ? Math.round(row.totalPnl / row.count) : 0;
      const level = conditionLevel(row.count, winRate, avgPnl);
      return { ...row, winRate, avgPnl, ...level };
    })
    .sort((a, b) => levelRank(b.level) - levelRank(a.level) || b.avgPnl - a.avgPnl || b.count - a.count);
}

function conditionLevel(count, winRate, avgPnl) {
  if (count >= 3 && winRate >= 0.6 && avgPnl > 0) {
    return { level: "建議必要", levelClass: "must" };
  }
  if (count >= 2 && (winRate >= 0.5 || avgPnl > 0)) {
    return { level: "觀察保留", levelClass: "watch" };
  }
  if (count >= 2 && winRate < 0.5 && avgPnl <= 0) {
    return { level: "可能非必要", levelClass: "optional" };
  }
  return { level: "樣本不足", levelClass: "unknown" };
}

function levelRank(level) {
  return { "建議必要": 4, "觀察保留": 3, "樣本不足": 2, "可能非必要": 1 }[level] || 0;
}

function presetWeight(label) {
  if (analysisWeights[label]) return analysisWeights[label];
  for (const weights of Object.values(reasonWeights)) {
    if (weights[label]) return weights[label];
  }
  return 0;
}

function showTab(tabName) {
  document.querySelector(".app").dataset.activeTab = tabName;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}Panel`);
  });
  try { renderStats(getJournal()); } catch (error) { console.error(error); }
  applyLanguageText();
}

function exportData() {
  const data = JSON.stringify(getJournal(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trade-journal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const journal = normalizeJournal(JSON.parse(reader.result));
      saveJournal(journal);
      renderAll();
      startQuotePolling();
      alert("匯入完成。");
    } catch {
      alert("匯入失敗，請確認 JSON 檔案格式。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function clearJournalData() {
  const journal = getJournal();
  const count = (journal.open || []).length + (journal.closed || []).length + (journal.cashflows || []).length;
  if (!count) {
    alert(state.settings.language === "en" ? "There are no records to clear." : "目前沒有紀錄可以清空。");
    return;
  }
  const message = state.settings.language === "en"
    ? `Clear ${count} records? This cannot be undone.`
    : `確定要清空 ${count} 筆交易/資金紀錄嗎？這個動作不能復原。`;
  if (!confirm(message)) return;
  localStorage.removeItem(storageKey);
  oldStorageKeys.forEach((key) => localStorage.removeItem(key));
  state.selectedReasons.clear();
  state.editReasons.clear();
  renderAll();
  showTab("open");
  closeSheets();
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function pickRandom(items) {
  return items[randomInt(0, items.length - 1)];
}

function createRandomTrade(index, closed = true) {
  const stocks = state.stocks.length ? state.stocks : [
    { code: "0050", name: "元大台灣50", market: "上市" },
    { code: "2330", name: "台積電", market: "上市" },
  ];
  const stock = pickRandom(stocks.slice(0, Math.min(80, stocks.length)));
  const analysisCount = randomInt(1, 3);
  const analysisType = [...analysisOptions]
    .sort(() => Math.random() - .5)
    .slice(0, analysisCount);
  const reason = analysisType.flatMap((type) => {
    const group = reasonGroups[type] || [];
    return group.length ? [pickRandom(group)] : [];
  });
  const entryPrice = Number(randomBetween(25, 220).toFixed(2));
  const shares = pickRandom([100, 200, 300, 500, 1000]);
  const stopPrice = Number((entryPrice * randomBetween(.88, .96)).toFixed(2));
  const entryTime = dateDaysAgo(closed ? randomInt(3, 60) : randomInt(0, 20));
  const trade = {
    id: crypto.randomUUID(),
    entryTime,
    code: stock.code,
    name: stock.name,
    market: stock.market,
    analysisType,
    reason,
    baseScore: baseScore(analysisType, reason),
    typeScores: typeScores(analysisType, reason),
    entryPrice,
    stopPrice,
    shares,
    riskAmount: riskAmount(entryPrice, stopPrice, shares, stock.code),
    riskPercent: riskPercent(entryPrice, stopPrice),
    buyFee: buyCost(entryPrice, shares).fee,
    stopSellFee: sellProceeds(stopPrice, shares, stock.code).fee,
    stopTax: sellProceeds(stopPrice, shares, stock.code).tax,
    mood: pickRandom(["冷靜", "有信心", "猶豫", "貪心"]),
    note: `測試紀錄 ${index}`,
  };
  trade.autoTags = autoTagsForTrade(trade);
  if (!closed) return trade;
  const exitPrice = Number((entryPrice * randomBetween(.92, 1.10)).toFixed(2));
  const result = netPnl(entryPrice, exitPrice, shares, stock.code);
  const exitDaysAgo = Math.max(0, randomInt(0, Math.max(1, Math.floor((Date.now() - new Date(`${entryTime}T00:00:00`).getTime()) / 86400000))));
  return {
    ...trade,
    exitTime: dateDaysAgo(exitDaysAgo),
    exitPrice,
    exitReason: pickRandom(["停利", "停損", "手動出場", "其他"]),
    planFollowed: pickRandom(["照計畫", "太早賣", "沒紀律", "沒有停損"]),
    reviewMistakes: [pickRandom(["照計畫執行", "追高追錯", "過度交易", "停損任移", "部位太大"])],
    exitNote: "測試用隨機平倉紀錄",
    grossPnl: result.grossPnl,
    buyValue: result.buy.value,
    sellValue: result.sell.value,
    buyFee: result.buy.fee,
    sellFee: result.sell.fee,
    tax: result.sell.tax,
    totalFees: result.buy.fee + result.sell.fee + result.sell.tax,
    pnl: result.pnl,
  };
}

function seedTestData() {
  const open = [];
  const closed = [];
  for (let index = 1; index <= 100; index += 1) {
    if (index <= 20) open.push(createRandomTrade(index, false));
    else closed.push(createRandomTrade(index, true));
  }
  const journal = {
    open,
    closed,
    cashflows: [{
      id: crypto.randomUUID(),
      date: dateDaysAgo(65),
      type: "initial",
      amount: 10000000,
      note: "100筆測試初始資金",
    }],
  };
  saveJournal(journal);
  renderAll();
  showTab("open");
  closeSheets();
  startQuotePolling();
}

function setup() {
  loadFeeSettings();
  loadAppSettings();
  state.calendarMonth = currentMonth();
  renderAnalysisTabs(["技術面"]);
  state.selectedReasons = new Set(["突破壓力"]);
  renderReasonChoices();
  $("entryTime").value = currentDate();
  $("cashflowDate").value = currentDate();
  if ($("quickCashflowDate")) $("quickCashflowDate").value = currentDate();
  $("rangeStart").value = currentDate();
  $("rangeEnd").value = currentDate();
  $("stockSearch").addEventListener("input", (event) => renderStockOptions(event.target.value));
  $("profileButton").addEventListener("click", () => openSheet("profileSheet"));
  $("profileForm").addEventListener("submit", saveProfile);
  $("clearJournalData").addEventListener("click", clearJournalData);
  $("seedTestData").addEventListener("click", seedTestData);
  $("profileLanguageInput").addEventListener("change", (event) => {
    state.settings.language = event.target.value || "zh";
    saveAppSettings();
    renderAll();
  });
  $("sessionThemeToggle").addEventListener("change", (event) => {
    state.settings.sessionTheme = event.target.checked;
    saveAppSettings();
    renderAll();
  });
  $("stopAlertToggle").addEventListener("change", (event) => {
    state.settings.stopAlert = event.target.checked;
    saveAppSettings();
    renderAll();
  });
  $("quickCashflowAmount").addEventListener("input", formatMoneyInput);
  $("openCashflowSheet").addEventListener("click", () => {
    if ($("quickCashflowDate")) $("quickCashflowDate").value = currentDate();
    openSheet("cashflowSheet");
  });
  $("openBuySheet").addEventListener("click", () => {
    ensureLazyBuyDefaults();
    setSheetAdvanced("buyForm", "toggleAdvancedBuy", false, "顯示完整買進設定", "收起完整買進設定");
    openSheet("buySheet");
  });
  $("toggleAdvancedBuy").addEventListener("click", () => {
    toggleSheetAdvanced("buyForm", "toggleAdvancedBuy", "顯示完整買進設定", "收起完整買進設定");
  });
  $("toggleCloseReview").addEventListener("click", () => {
    toggleSheetAdvanced("closeForm", "toggleCloseReview", "補充詳細檢討", "收起詳細檢討");
  });
  $("buyForm").addEventListener("submit", addTrade);
  $("editForm").addEventListener("submit", editTrade);
  $("closeForm").addEventListener("submit", closeTrade);
  ["entryPrice", "stopPrice", "shareQuantity", "shareUnit"].forEach((id) => {
    $(id).addEventListener("input", () => renderRiskPreview(""));
    $(id).addEventListener("change", () => renderRiskPreview(""));
  });
  ["editEntryPrice", "editStopPrice", "editShareQuantity", "editShareUnit"].forEach((id) => {
    $(id).addEventListener("input", () => renderRiskPreview("edit"));
    $(id).addEventListener("change", () => renderRiskPreview("edit"));
  });
  $("rangeStart").addEventListener("input", renderAll);
  $("rangeEnd").addEventListener("input", renderAll);
  $("exportData").addEventListener("click", exportData);
  if ($("importData")) $("importData").addEventListener("change", importData);
  $("saveFeeSettings").addEventListener("click", saveFeeSettings);
  $("showStrategyLine").addEventListener("change", renderAll);
  $("addCashflow").addEventListener("click", addCashflow);
  $("quickCashflowForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (addCashflowFrom("quick")) closeSheets();
  });
  $("cashflowList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-cashflow]");
    if (button) deleteCashflow(button.dataset.deleteCashflow);
  });
  document.querySelectorAll("[data-lazy-action]").forEach((button) => {
    button.addEventListener("click", () => applyLazyAction(button.dataset.lazyAction));
  });
  document.querySelectorAll("[data-fast-plan]").forEach((button) => {
    button.addEventListener("click", () => setFastClosePlan(button.dataset.fastPlan));
  });
  $("calendarPrev").addEventListener("click", () => {
    state.calendarMonth = shiftMonth(state.calendarMonth, -1);
    renderAll();
  });
  $("calendarNext").addEventListener("click", () => {
    state.calendarMonth = shiftMonth(state.calendarMonth, 1);
    renderAll();
  });
  document.querySelectorAll("[data-calendar-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.calendarMode = button.dataset.calendarMode;
      renderAll();
    });
  });
  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => applyTemplate(button.dataset.template));
  });
  $("sheetBackdrop").addEventListener("click", closeSheets);
  document.querySelectorAll("[data-close-sheet]").forEach((button) => {
    button.addEventListener("click", closeSheets);
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });
  loadStocks();
  renderAll();
  setInterval(renderMarketSession, 60 * 1000);
  startQuotePolling();
}

setup();
