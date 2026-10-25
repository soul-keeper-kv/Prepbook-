"use strict";

// =====================================================================
// Cấu hình
// =====================================================================
const DATA_DIR = "data/";
const MANIFEST_FILE = "manifest.json";
const KEY_PROGRESS = "dsa_progress_v3";
const KEY_CONTENT_CACHE = "dsa_content_cache_v2"; // chỉ dùng khi mở thẳng file
const KEY_LANG = "dsa_lang";
const KEY_CODE_LANG = "dsa_code_lang";
const KEY_AI_MODE = "dsa_ai_mode";
const KEY_THEME = "dsa_theme";                  // index.html cũng đọc key này trong <head>
const THEMES = ["auto", "light", "dark"];       // auto = theo hệ điều hành
const KEY_FILE_SYNC = "dsa_progress_file_sync"; // xem phần "Lưu tiến độ ra file"
const LEGACY_KEYS = { v2: "dsa_roadmap_v2", v1: "dsa_roadmap_v1" };
const PROGRESS_API = "api/progress";            // chỉ có khi chạy bằng start.sh (server.js)
const PROGRESS_FILE = "progress/progress.json";
const FILE_SAVE_DELAY_MS = 300;                 // gom các lần gõ phím liền nhau thành 1 lần ghi
const REVIEW_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const TYPE_CLASS = { theory: "tag-theory", practice: "tag-practice" };
const RESOURCE_TYPES = ["article", "video", "course", "docs", "book", "visual", "practice"];
const CODE_LANG_LABEL = { python: "Python", java: "Java", cpp: "C++", javascript: "JavaScript", go: "Go" };

const FILTERS = {
  all: () => true,
  todo: (item) => !isDone(item),
  review: (item) => needsReview(item),
};

const SOURCES = {
  "leetcode.com": "LeetCode",
  "hackerrank.com": "HackerRank",
  "cses.fi": "CSES",
  "atcoder.jp": "AtCoder",
  "codeforces.com": "Codeforces",
};

// Trang lời giải của từng nơi, suy ra từ URL bài: phần khớp regex + đuôi trong pages.
// Nơi không có ở đây (CSES...) thì dùng link tìm kiếm Google.
const SOLUTION_PAGES = [
  {
    match: /^https:\/\/leetcode\.com\/problems\/[^/?#]+/i,
    pages: [["help.editorial", "/editorial/"], ["help.solutions", "/solutions/"]],
  },
  {
    match: /^https:\/\/(?:www\.)?hackerrank\.com\/challenges\/[^/?#]+/i,
    pages: [["help.editorial", "/editorial"], ["help.discussions", "/forum"]],
  },
  {
    match: /^https:\/\/atcoder\.jp\/contests\/[^/?#]+\/tasks\/[^/?#]+/i,
    pages: [["help.editorial", "/editorial"]],
  },
];

// Mở AI kèm sẵn câu hỏi qua ?q=. Tham số này không có tài liệu chính thức nên có thể ngừng chạy,
// vì vậy câu hỏi luôn được copy trước: ô chat trống thì người dùng chỉ cần dán.
const AI_TOOLS = {
  claude: { name: "Claude", url: "https://claude.ai/new?q=" },
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com/?q=" },
};
const AI_MODES = ["hint", "explain"]; // chỉ gợi ý / giải thích đầy đủ; câu hỏi nằm trong i18n.js (prompt.*)

// =====================================================================
// State
// =====================================================================
const state = {
  lang: DEFAULT_LANG,         // ngôn ngữ giao diện + nội dung (i18n.js)
  codeLang: "python",         // ngôn ngữ code mẫu đang chọn
  aiMode: "hint",             // kiểu câu hỏi gửi AI ở khung "Cách giải"
  content: null,              // { title, subtitle, codeReviewChecklist, phases }
  index: new Map(),           // itemId -> { item, phase }
  progress: emptyProgress(),
  filter: "all",
  expanded: new Set(),        // id các giai đoạn đang mở
  openId: null,               // id mục đang xem trong dialog
  loadError: null,            // lỗi đang hiện ở màn hình nạp dữ liệu
};

// =====================================================================
// Tiện ích
// =====================================================================
const $ = (id) => document.getElementById(id);

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Định dạng tối giản cho text trong data: `code` và **đậm**
const fmt = (text = "") => esc(text)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const paragraphs = (text) => text
  .split(/\n{2,}/)
  .map((p) => `<p>${fmt(p).replace(/\n/g, "<br>")}</p>`)
  .join("");

const bulletList = (items) => `<ul class="bullets">${items.map((x) => `<li>${fmt(localize(x))}</li>`).join("")}</ul>`;
const block = (titleKey, html) => `<div class="block"><h3>${esc(t(titleKey))}</h3>${html}</div>`;
const emptyNote = (text) => `<p class="empty-note">${esc(text)}</p>`;

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const codeText = (code) => (Array.isArray(code) ? code.join("\n") : code || "");
const plainText = (text = "") => String(text).replace(/`|\*\*/g, ""); // bỏ định dạng của fmt()
const safeUrl = (url) => (/^https?:\/\//i.test(url) ? url : "#");

const nowIso = () => new Date().toISOString();
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

function timeAgo(iso) {
  const days = daysSince(iso);
  if (days <= 0) return t("time.today");
  if (days === 1) return t("time.yesterday");
  return t("time.daysAgo", days);
}

function sourceOf(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SOURCES[host] || host;
  } catch {
    return "";
  }
}

function groupBy(list, keyOf) {
  const groups = new Map();
  for (const x of list) {
    const key = keyOf(x);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }
  return groups;
}

const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage bị chặn hoặc đầy: app vẫn chạy, chỉ không lưu được
    }
  },
};

// =====================================================================
// Ngôn ngữ
// =====================================================================
// Chữ của phần vỏ app, lấy từ i18n.js
function t(key, ...args) {
  const value = I18N[state.lang]?.[key] ?? I18N[DEFAULT_LANG][key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

// Chữ trong data: chuỗi/mảng thường (dùng chung mọi ngôn ngữ) hoặc { "vi": ..., "en": ... }
const isLocalized = (value) => isObject(value) && LANGUAGES.some((l) => l.code in value);

function localize(value) {
  if (!isLocalized(value)) return value;
  return value[state.lang] ?? value[DEFAULT_LANG] ?? Object.values(value)[0];
}

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(LANGUAGES.find((l) => l.code === state.lang)?.locale);

// Lỗi kèm key dịch, để đổi ngôn ngữ thì thông báo lỗi cũng đổi theo
function appError(key, ...args) {
  const err = new Error(t(key, ...args));
  err.i18n = { key, args };
  return err;
}
const errorText = (err) => (err.i18n ? t(err.i18n.key, ...err.i18n.args) : err.message);

function setLanguage(code) {
  if (!I18N[code] || code === state.lang) return;
  state.lang = code;
  storage.set(KEY_LANG, code);
  applyStaticTexts();
  renderLoaderError();
  if (state.content) render();
}

// Gán chữ cho các phần tử tĩnh trong index.html (data-i18n, data-i18n-html, data-i18n-aria)
function applyStaticTexts() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  for (const btn of document.querySelectorAll("[data-lang]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === state.lang));
  }
}

// =====================================================================
// Giao diện Sáng / Tối (màu nằm trong index.css, dạng light-dark())
// =====================================================================
function setTheme(theme) {
  if (!THEMES.includes(theme)) theme = "auto";
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  for (const btn of document.querySelectorAll("[data-set-theme]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.setTheme === theme));
  }
  storage.set(KEY_THEME, theme);
}

// =====================================================================
// Nạp nội dung từ thư mục data/
// =====================================================================
function parseJson(name, text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw appError("error.invalidJson", name, err.message);
  }
}

// readText(name) trả về nội dung 1 file trong data/, đọc từ server hoặc từ thư mục người dùng chọn
async function loadContent(readText) {
  const manifest = parseJson(MANIFEST_FILE, await readText(MANIFEST_FILE));
  if (!Array.isArray(manifest.phases)) throw appError("error.noPhases", MANIFEST_FILE);
  const phases = await Promise.all(
    manifest.phases.map(async (file) => parseJson(file, await readText(file)))
  );
  validatePhases(phases, manifest.phases);
  return { ...manifest, phases };
}

function validatePhases(phases, files) {
  const phaseIds = new Set();
  const itemIds = new Set();
  phases.forEach((phase, i) => {
    const file = files[i];
    if (!phase.id || !Array.isArray(phase.items)) throw appError("error.badPhase", file);
    if (phaseIds.has(phase.id)) throw appError("error.dupPhase", file, phase.id);
    phaseIds.add(phase.id);
    for (const item of phase.items) {
      if (!item.id || !item.title) throw appError("error.badItem", file);
      if (itemIds.has(item.id)) throw appError("error.dupItem", file, item.id);
      itemIds.add(item.id);
    }
  });
}

async function readFromServer(name) {
  const res = await fetch(DATA_DIR + name, { cache: "no-cache" });
  if (!res.ok) throw appError("error.http", DATA_DIR + name, res.status);
  return res.text();
}

function readFromFiles(files) {
  // webkitRelativePath có dạng "data/phase-0.json"; bỏ tên thư mục gốc đi
  const byPath = new Map(files.map((f) => [f.webkitRelativePath.split("/").slice(1).join("/") || f.name, f]));
  return async (name) => {
    const file = byPath.get(name);
    if (!file) throw appError("error.missingFile", name);
    return file.text();
  };
}

async function boot() {
  const isFile = location.protocol === "file:";
  try {
    const content = await loadContent(readFromServer);
    await openProgressFile();
    showApp(content);
  } catch (err) {
    const cached = storage.get(KEY_CONTENT_CACHE, null);
    if (isFile && cached) showApp(cached);
    else showLoader(isFile ? null : err);
  }
}

function showApp(content) {
  state.content = content;
  state.loadError = null;
  state.index = new Map();
  for (const phase of content.phases) {
    for (const item of phase.items) state.index.set(item.id, { item, phase });
  }
  state.progress = syncWithFile(loadProgress(content.phases));
  if (!state.expanded.size && content.phases.length) state.expanded.add(content.phases[0].id);

  $("btn-reload-data").hidden = location.protocol !== "file:";
  $("loader").hidden = true;
  $("app").hidden = false;
  render();
}

function showLoader(err) {
  state.loadError = err || null;
  document.title = t("pageTitle");
  $("app").hidden = true;
  $("loader").hidden = false;
  renderLoaderError();
}

function renderLoaderError() {
  const box = $("loader-error");
  box.hidden = !state.loadError;
  box.textContent = state.loadError ? errorText(state.loadError) : "";
}

// =====================================================================
// Tiến độ (lưu trong localStorage, và trong progress/progress.json khi chạy bằng start.sh)
//   items:  { [itemId]: { done, doneAt, notes, code, checks: { [checkId]: true }, reviews: [isoDate] } }
//   solved: { [problemUrl]: isoDate }   1 bài xuất hiện ở nhiều mục vẫn tính chung
// =====================================================================
function emptyProgress() {
  return { items: {}, solved: {} };
}

function loadProgress(phases) {
  const saved = storage.get(KEY_PROGRESS, null);
  if (isObject(saved?.items) && isObject(saved?.solved)) return saved;

  // Chuyển tiến độ từ các bản cũ (chỉ có trạng thái đã tick)
  const v2 = storage.get(LEGACY_KEYS.v2, {});
  const v1 = storage.get(LEGACY_KEYS.v1, {});
  const doneIds = Object.keys(v2).filter((id) => v2[id]);
  if (!doneIds.length) {
    for (const [key, checked] of Object.entries(v1)) {
      const [pi, ii] = key.split("-").map(Number);
      const item = phases[pi]?.items[ii];
      if (checked && item) doneIds.push(item.id);
    }
  }

  const progress = emptyProgress();
  for (const id of doneIds) progress.items[id] = { done: true, doneAt: nowIso() };
  if (doneIds.length) storage.set(KEY_PROGRESS, progress);
  return progress;
}

// Mọi thay đổi tiến độ (tick, giải bài, ghi chú, code, ôn tập, nhập, làm lại) đều đi qua đây
function saveProgress() {
  storage.set(KEY_PROGRESS, state.progress);
  fileSync.version++;
  // Đánh dấu còn thay đổi chưa ghi ra file, để lần sau mở trang bản file cũ không đè mất
  if (fileSync.enabled || storage.get(KEY_FILE_SYNC, null)) storage.set(KEY_FILE_SYNC, "pending");
  queueFileSave();
}

const itemProgress = (id) => state.progress.items[id] || {};

function updateItem(id, changes) {
  state.progress.items[id] = { ...itemProgress(id), ...changes };
  saveProgress();
}

function setDone(id, done) {
  updateItem(id, { done, doneAt: done ? nowIso() : undefined });
}

function setSolved(url, solved) {
  if (solved) state.progress.solved[url] = nowIso();
  else delete state.progress.solved[url];
  saveProgress();
}

const isDone = (item) => Boolean(itemProgress(item.id).done);
const isSolved = (url) => Boolean(state.progress.solved[url]);
const solvedCount = (item) => (item.problems || []).filter((p) => isSolved(p.url)).length;

function lastStudied(item) {
  const p = itemProgress(item.id);
  return p.reviews?.at(-1) || p.doneAt;
}

function needsReview(item) {
  const last = lastStudied(item);
  return isDone(item) && Boolean(last) && daysSince(last) >= REVIEW_AFTER_DAYS;
}

// =====================================================================
// Danh sách
// =====================================================================
const allExpanded = () => state.content.phases.every((p) => state.expanded.has(p.id));
const typeOf = (item) => (item.type in TYPE_CLASS ? item.type : "theory");

function render(focusSelector) {
  const title = localize(state.content.title) || "";
  document.title = title || t("pageTitle");
  $("title").textContent = title;
  $("subtitle").textContent = localize(state.content.subtitle) || "";

  $("phases").innerHTML = state.content.phases.map(renderPhase).join("");
  renderStats();
  renderSyncStatus();

  for (const btn of document.querySelectorAll("[data-filter]")) {
    btn.classList.toggle("on", btn.dataset.filter === state.filter);
  }
  $("btn-expand").textContent = allExpanded() ? t("toolbar.collapse") : t("toolbar.expand");

  // innerHTML thay toàn bộ phần tử, nên trả focus về đúng chỗ cho người dùng bàn phím
  if (focusSelector) $("phases").querySelector(focusSelector)?.focus();
}

function renderPhase(phase) {
  const total = phase.items.length;
  const doneCount = phase.items.filter(isDone).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const isOpen = state.expanded.has(phase.id);
  const meta = [localize(phase.time), t("stats.items", doneCount, total)].filter(Boolean).map(esc).join(" · ");

  let body = "";
  if (isOpen) {
    const visible = phase.items.filter(FILTERS[state.filter]);
    body = visible.length
      ? visible.map(renderItem).join("")
      : `<div class="empty">${esc(t(`filter.empty.${state.filter}`))}</div>`;
  }

  return `
    <div class="phase">
      <button type="button" class="phase-head" data-phase="${esc(phase.id)}" aria-expanded="${isOpen}">
        <span class="arrow" aria-hidden="true">▶</span>
        <div class="phase-info">
          <div class="phase-title">${esc(localize(phase.name))}</div>
          <div class="phase-meta">${meta}</div>
          <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>
        <span class="phase-pct">${pct}%</span>
      </button>
      ${body}
    </div>`;
}

function renderItem(item) {
  const p = itemProgress(item.id);
  const type = typeOf(item);
  const problems = item.problems || [];

  const meta = [];
  if (problems.length) meta.push(t("item.problems", solvedCount(item), problems.length));
  if (p.reviews?.length) meta.push(t("item.reviews", p.reviews.length));
  if (p.notes || p.code) meta.push(t("item.hasNotes"));

  return `
    <div class="item ${p.done ? "done" : ""}">
      <input type="checkbox" data-done="${esc(item.id)}" ${p.done ? "checked" : ""} aria-label="${esc(t("item.markDone"))}">
      <button type="button" class="item-open" data-open="${esc(item.id)}">
        <span class="item-title">${fmt(localize(item.title))}</span>
        <span class="tag ${TYPE_CLASS[type]}">${esc(t(`type.${type}`))}</span>
        ${needsReview(item) ? `<span class="tag tag-review">${esc(t("tag.review"))}</span>` : ""}
        ${meta.length ? `<span class="item-meta">${esc(meta.join(" · "))}</span>` : ""}
      </button>
    </div>`;
}

function renderStats() {
  const { phases } = state.content;
  const items = phases.flatMap((p) => p.items);
  const doneCount = items.filter(isDone).length;
  const current = phases.findIndex((p) => !p.items.every(isDone));
  const urls = new Set(items.flatMap((it) => (it.problems || []).map((p) => p.url)));
  const solved = [...urls].filter(isSolved).length;

  $("stat-pct").textContent = `${items.length ? Math.round((doneCount / items.length) * 100) : 0}%`;
  $("stat-done").textContent = t("stats.items", doneCount, items.length);
  $("stat-current").textContent = current === -1 ? t("stats.allDone") : String(current);
  $("stat-solved").textContent = `${solved}/${urls.size}`;
  $("stat-review").textContent = String(items.filter(needsReview).length);
}

function setFilter(filter) {
  state.filter = filter;
  // Mục cần ôn thường ít và nằm rải rác, nên mở sẵn các giai đoạn có mục cần ôn
  if (filter === "review") {
    for (const phase of state.content.phases) {
      if (phase.items.some(needsReview)) state.expanded.add(phase.id);
    }
  }
  render();
}

// =====================================================================
// Màn hình chi tiết (dialog)
// =====================================================================
function openDetail(id) {
  const entry = state.index.get(id);
  if (!entry) return;
  state.openId = id;
  $("detail-body").innerHTML = renderDetail(entry.item, entry.phase);
  refreshDetail();
  $("detail").showModal();
}

function renderDetail(item, phase) {
  const type = typeOf(item);
  const tabs = [
    { id: "learn", label: esc(t("tab.learn")), body: renderLearnTab(item) },
    { id: "problems", label: `${esc(t("tab.problems"))} <span id="problems-count"></span>`, body: renderProblemsTab(item) },
    { id: "notes", label: esc(t("tab.notes")), body: renderNotesTab(item) },
  ];

  return `
    <header class="detail-head">
      <div class="detail-heading">
        <div class="detail-phase">
          ${esc(localize(phase.name))} <span class="tag ${TYPE_CLASS[type]}">${esc(t(`type.${type}`))}</span>
        </div>
        <h2 id="detail-title">${fmt(localize(item.title))}</h2>
      </div>
      <button type="button" class="icon-btn" data-action="close" aria-label="${esc(t("detail.close"))}">✕</button>
    </header>
    <div class="tabs" role="tablist">
      ${tabs.map((tab, i) => `
        <button type="button" role="tab" data-tab="${tab.id}" aria-selected="${i === 0}">${tab.label}</button>`).join("")}
    </div>
    <div class="detail-scroll">
      ${tabs.map((tab, i) => `
        <section class="panel" role="tabpanel" data-panel="${tab.id}" ${i === 0 ? "" : "hidden"}>${tab.body}</section>`).join("")}
    </div>
    <footer class="detail-foot">
      <label class="check">
        <input type="checkbox" data-done="${esc(item.id)}" ${isDone(item) ? "checked" : ""}> ${esc(t("foot.done"))}
      </label>
      <span class="foot-info" id="foot-info"></span>
      <button type="button" class="primary" id="btn-review" data-action="review"></button>
    </footer>`;
}

function renderLearnTab(item) {
  const keyPoints = localize(item.keyPoints) || [];
  const examples = localize(item.examples) || [];
  const templates = [].concat(item.template || []);
  const pitfalls = localize(item.pitfalls) || [];
  const resources = (item.resources || []).filter((r) => r.type !== "practice");

  const blocks = [
    item.description && block("block.description", paragraphs(localize(item.description))),
    keyPoints.length && block("block.keyPoints", bulletList(keyPoints)),
    examples.length && block("block.examples", examples.map(renderExample).join("")),
    templates.length && block("block.template", renderTemplates(templates)),
    item.complexity && block("block.complexity", `<p>${fmt(localize(item.complexity))}</p>`),
    pitfalls.length && block("block.pitfalls", bulletList(pitfalls)),
    resources.length && block("block.resources", `<ul class="resources">${resources.map(renderResource).join("")}</ul>`),
  ].filter(Boolean);
  return blocks.join("") || emptyNote(t("learn.empty"));
}

function renderExample(ex) {
  const row = (labelKey, value) =>
    value ? `<div class="example-row"><span>${esc(t(labelKey))}</span><code>${esc(localize(value))}</code></div>` : "";
  return `
    <div class="example">
      ${ex.title ? `<div class="example-title">${fmt(localize(ex.title))}</div>` : ""}
      ${row("example.input", ex.input)}
      ${row("example.output", ex.output)}
      ${ex.explain ? `<p>${fmt(localize(ex.explain))}</p>` : ""}
    </div>`;
}

// Nhiều ngôn ngữ code trong 1 khung, có nút chọn Python / Java...
function renderTemplates(templates) {
  const active = templates.some((tpl) => tpl.lang === state.codeLang) ? state.codeLang : templates[0].lang;
  const langButtons = templates.map((tpl) => `
    <button type="button" class="code-lang" data-code-lang="${esc(tpl.lang)}" aria-pressed="${tpl.lang === active}">
      ${esc(CODE_LANG_LABEL[tpl.lang] || tpl.lang || "code")}
    </button>`).join("");
  const blocks = templates.map((tpl) => `
    <pre data-code="${esc(tpl.lang)}" ${tpl.lang === active ? "" : "hidden"}><code>${esc(codeText(localize(tpl.code)))}</code></pre>`).join("");

  return `
    <div class="code">
      <div class="code-head">
        <div class="code-langs">${langButtons}</div>
        <button type="button" class="small" data-action="copy">${esc(t("copy"))}</button>
      </div>
      ${blocks}
    </div>`;
}

function renderResource(resource) {
  const type = RESOURCE_TYPES.includes(resource.type) ? resource.type : "article";
  return `
    <li>
      <span class="res-type res-${type}">${esc(t(`res.${type}`))}</span>
      <a href="${esc(safeUrl(resource.url))}" target="_blank" rel="noopener noreferrer">${esc(localize(resource.title))}</a>
    </li>`;
}

function renderProblemsTab(item) {
  const groups = groupBy(item.problems || [], (p) => sourceOf(p.url));
  const lists = (item.resources || []).filter((r) => r.type === "practice");

  const groupHtml = [...groups].map(([source, problems]) => `
    <div class="problem-group">
      <h4>${esc(source)} <span class="group-count"></span></h4>
      <ul class="problems">${problems.map(renderProblem).join("")}</ul>
    </div>`).join("");

  const blocks = [
    groups.size && block("block.problems", groupHtml),
    lists.length && block("block.moreLists", `<ul class="resources">${lists.map(renderResource).join("")}</ul>`),
  ].filter(Boolean);
  return blocks.join("") || emptyNote(t("problems.empty"));
}

function renderProblem(problem) {
  const solved = isSolved(problem.url);
  const title = localize(problem.title);
  const level = problem.level
    ? `<span class="level level-${esc(problem.level.toLowerCase())}">${esc(problem.level)}</span>`
    : "";
  return `
    <li class="problem ${solved ? "solved" : ""}" data-url="${esc(problem.url)}">
      <input type="checkbox" data-solved="${esc(problem.url)}" ${solved ? "checked" : ""}
        aria-label="${esc(t("problem.solvedLabel", title))}">
      <a href="${esc(safeUrl(problem.url))}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>
      ${level}
      <button type="button" class="small help-toggle" data-action="help" aria-expanded="false">${esc(t("help.toggle"))}</button>
      ${problem.note ? `<span class="problem-note">${fmt(localize(problem.note))}</span>` : ""}
      ${renderHelp(problem)}
    </li>`;
}

// Khung "Cách giải" dưới mỗi bài: link lời giải + hỏi AI với câu hỏi soạn sẵn
function renderHelp(problem) {
  const links = solutionLinks(problem).map((link) => `
    <a href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.label)}</a>`).join("");
  const modes = AI_MODES.map((mode) => `
    <button type="button" data-ai-mode="${mode}" aria-pressed="${mode === state.aiMode}">${esc(t(`help.mode.${mode}`))}</button>`).join("");
  const tools = Object.entries(AI_TOOLS).map(([id, tool]) => `
    <button type="button" class="small" data-action="ask" data-tool="${id}">${esc(t("help.open", tool.name))}</button>`).join("");

  return `
    <div class="help" hidden>
      <p class="help-tip">${esc(t("help.tip"))}</p>
      <span class="help-label">${esc(t("help.read"))}</span>
      <div class="help-links">${links}</div>
      <span class="help-label">${esc(t("help.ask"))}</span>
      <div class="help-ai">
        <div class="switch" role="group" aria-label="${esc(t("help.modeLabel"))}">${modes}</div>
        ${tools}
        <button type="button" class="small" data-action="ask">${esc(t("help.copy"))}</button>
      </div>
      <p class="help-status" aria-live="polite"></p>
    </div>`;
}

// guides trong data (nếu có) đứng đầu, rồi tới trang lời giải của nơi ra đề, cuối cùng là video
function solutionLinks(problem) {
  const query = `${sourceOf(problem.url)} ${localize(problem.title)}`;
  const links = (problem.guides || []).map((g) => ({ label: localize(g.title) || sourceOf(g.url), url: g.url }));
  const site = SOLUTION_PAGES.find((s) => s.match.test(problem.url));
  if (site) {
    const base = problem.url.match(site.match)[0];
    links.push(...site.pages.map(([key, path]) => ({ label: t(key), url: base + path })));
  } else {
    links.push({
      label: t("help.web"),
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} solution explanation`)}`,
    });
  }
  links.push({
    label: t("help.video"),
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} explained`)}`,
  });
  return links;
}

function problemOf(li) {
  const { item } = state.index.get(state.openId);
  return (item.problems || []).find((p) => p.url === li.dataset.url);
}

function aiPrompt(problem) {
  const { item } = state.index.get(state.openId);
  return t(`prompt.${state.aiMode}`, {
    title: localize(problem.title),
    url: problem.url,
    site: [sourceOf(problem.url), problem.level && `(${problem.level})`].filter(Boolean).join(" "),
    lesson: plainText(localize(item.title)),
    lang: CODE_LANG_LABEL[state.codeLang] || state.codeLang,
  });
}

function toggleHelp(li) {
  const btn = li.querySelector(".help-toggle");
  const open = btn.getAttribute("aria-expanded") !== "true";
  btn.setAttribute("aria-expanded", String(open));
  li.querySelector(".help").hidden = !open;
}

// Ghi nhớ để các bài khác, mục khác cũng dùng kiểu câu hỏi này
function setAiMode(mode) {
  if (!AI_MODES.includes(mode)) return;
  state.aiMode = mode;
  storage.set(KEY_AI_MODE, mode);
  for (const btn of $("detail-body").querySelectorAll("[data-ai-mode]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.aiMode === mode));
  }
}

// Copy câu hỏi trước rồi mới mở tab: mở tab trước thì trang mất focus và trình duyệt chặn copy.
// Nút không có data-tool là nút "Copy câu hỏi".
async function askAi(btn) {
  const li = btn.closest(".problem");
  const problem = problemOf(li);
  if (!problem) return;
  const prompt = aiPrompt(problem);
  const tool = AI_TOOLS[btn.dataset.tool];

  let copied = true;
  try {
    await navigator.clipboard.writeText(prompt);
  } catch {
    copied = false;
  }
  if (tool) window.open(tool.url + encodeURIComponent(prompt), "_blank", "noopener,noreferrer");

  const messages = tool
    ? [t("help.opened", tool.name), t(copied ? "help.pasteHint" : "help.copyFailed")]
    : [t(copied ? "help.copied" : "help.copyFailed")];
  li.querySelector(".help-status").textContent = messages.join(" ");
}

function renderNotesTab(item) {
  const p = itemProgress(item.id);
  const checklist = state.content.codeReviewChecklist || [];
  const checks = checklist.map((c) => `
    <label>
      <input type="checkbox" data-check="${esc(c.id)}" ${p.checks?.[c.id] ? "checked" : ""}>
      <span>${fmt(localize(c.text))}</span>
    </label>`).join("");

  return [
    block("block.notes", `<textarea data-field="notes" rows="5"
      placeholder="${esc(t("notes.placeholder"))}">${esc(p.notes || "")}</textarea>`),
    block("block.code", `<textarea data-field="code" class="mono" rows="12" wrap="off" spellcheck="false"
      placeholder="${esc(t("code.placeholder"))}">${esc(p.code || "")}</textarea>`),
    checklist.length > 0 && block("block.checklist", `<div class="checklist">${checks}</div>`),
    block("block.history", '<div id="review-history"></div>'),
  ].filter(Boolean).join("");
}

function renderHistory(p) {
  const rows = [];
  if (p.doneAt) rows.push(`<li>${esc(t("history.done", formatDate(p.doneAt)))}</li>`);
  (p.reviews || []).forEach((iso, i) => rows.push(`<li>${esc(t("history.review", i + 1, formatDate(iso)))}</li>`));
  return rows.length ? `<ul class="history">${rows.join("")}</ul>` : emptyNote(t("history.empty", REVIEW_AFTER_DAYS));
}

// Cập nhật các phần thay đổi theo tiến độ mà không vẽ lại cả dialog (giữ nguyên textarea đang gõ)
function refreshDetail() {
  const { item } = state.index.get(state.openId);
  const p = itemProgress(item.id);
  const last = lastStudied(item);
  const reviewedToday = Boolean(p.reviews?.length) && isToday(p.reviews.at(-1));
  const problems = item.problems || [];
  const body = $("detail-body");

  $("problems-count").textContent = problems.length ? `${solvedCount(item)}/${problems.length}` : "";
  for (const group of body.querySelectorAll(".problem-group")) {
    const boxes = [...group.querySelectorAll("[data-solved]")];
    group.querySelector(".group-count").textContent = `${boxes.filter((b) => b.checked).length}/${boxes.length}`;
  }
  $("review-history").innerHTML = renderHistory(p);
  $("foot-info").innerHTML = last
    ? esc(t("foot.lastStudied", timeAgo(last))) +
      (needsReview(item) ? ` · <strong class="warn">${esc(t("foot.due"))}</strong>` : "")
    : "";
  $("btn-review").disabled = reviewedToday;
  $("btn-review").textContent = reviewedToday ? t("foot.reviewed") : t("foot.review");
}

function selectTab(tabId) {
  const body = $("detail-body");
  for (const tab of body.querySelectorAll("[data-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === tabId));
  }
  for (const panel of body.querySelectorAll("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== tabId;
  }
  body.querySelector(".detail-scroll").scrollTop = 0;
}

// Chọn Python / Java; ghi nhớ để các mục khác mở ra cũng hiện ngôn ngữ đó
function selectCodeLang(lang) {
  state.codeLang = lang;
  storage.set(KEY_CODE_LANG, lang);
  for (const box of $("detail-body").querySelectorAll(".code")) {
    if (!box.querySelector(`pre[data-code="${CSS.escape(lang)}"]`)) continue;
    for (const btn of box.querySelectorAll("[data-code-lang]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.codeLang === lang));
    }
    for (const pre of box.querySelectorAll("pre[data-code]")) pre.hidden = pre.dataset.code !== lang;
  }
}

async function copyCode(box) {
  const btn = box.querySelector('[data-action="copy"]');
  try {
    await navigator.clipboard.writeText(box.querySelector("pre:not([hidden])").textContent);
    btn.textContent = t("copy.done");
  } catch {
    btn.textContent = t("copy.failed");
  }
  setTimeout(() => { btn.textContent = t("copy"); }, 1500);
}

function markReviewed(id) {
  updateItem(id, { reviews: [...(itemProgress(id).reviews || []), nowIso()] });
  refreshDetail();
}

// =====================================================================
// Lưu tiến độ ra file progress/progress.json (qua server.js, chạy bằng start.sh),
// để đổi trình duyệt không mất dữ liệu. localStorage vẫn giữ 1 bản trong trình duyệt.
//
// KEY_FILE_SYNC cho biết bản trong trình duyệt này so với file:
//   (chưa có)  chưa từng ghi ra file  -> mở trang: gộp vào file, bên file thắng khi trùng
//   "synced"   file đã có mọi thay đổi -> mở trang: lấy bản trong file
//   "pending"  còn thay đổi chưa ghi   -> mở trang: gộp vào file, bên trình duyệt thắng khi trùng
// =====================================================================
const fileSync = {
  enabled: false,     // server có API lưu file
  remote: null,       // tiến độ đọc từ file lúc mở trang, null nếu chưa có file
  baseSavedAt: null,  // savedAt của bản file mà trang này đang dựa vào
  error: null,        // lỗi gần nhất (appError), hiện ở cuối trang
  version: 0,         // tăng mỗi lần tiến độ đổi
  timer: null,
  saving: false,
  again: false,       // có thay đổi mới trong lúc đang ghi
};

async function openProgressFile() {
  let res, body;
  try {
    res = await fetch(PROGRESS_API, { cache: "no-store" });
    body = await res.json();
  } catch {
    return; // server khác (Live Server, http.server...) không có API: chỉ lưu trong trình duyệt
  }
  if (!res.ok) {
    if (body?.error) fileSync.error = appError("sync.error", body.error);
    return;
  }
  if (body !== null && !(isObject(body?.items) && isObject(body?.solved))) {
    // File bị sửa tay sai định dạng: báo lỗi, không ghi đè
    fileSync.error = appError("sync.error", `${PROGRESS_FILE}: ${t("error.notProgress")}`);
    return;
  }
  fileSync.enabled = true;
  fileSync.remote = body && { items: body.items, solved: body.solved };
  fileSync.baseSavedAt = body?.savedAt ?? null;
}

function syncWithFile(local) {
  if (!fileSync.enabled) return local;
  const { remote } = fileSync;
  const status = storage.get(KEY_FILE_SYNC, null);
  if (remote && status === "synced") {
    storage.set(KEY_PROGRESS, remote);
    return remote;
  }
  let progress = local;
  if (remote) progress = status === "pending" ? mergeProgress(remote, local) : mergeProgress(local, remote);
  storage.set(KEY_PROGRESS, progress);
  queueFileSave();
  return progress;
}

// Gộp 2 bản tiến độ: giữ mọi mục của cả hai, `winner` thắng khi cùng 1 trường của cùng 1 mục
function mergeProgress(base, winner) {
  const items = { ...base.items };
  for (const [id, p] of Object.entries(winner.items)) items[id] = { ...items[id], ...p };
  return { items, solved: { ...base.solved, ...winner.solved } };
}

function queueFileSave() {
  if (!fileSync.enabled) return;
  clearTimeout(fileSync.timer);
  fileSync.timer = setTimeout(saveToFile, FILE_SAVE_DELAY_MS);
}

// Mỗi lúc chỉ có 1 request ghi; thay đổi đến trong lúc đang ghi được gửi tiếp ngay sau đó
async function saveToFile({ keepalive = false } = {}) {
  clearTimeout(fileSync.timer);
  fileSync.timer = null;
  if (!fileSync.enabled) return;
  if (fileSync.saving) {
    fileSync.again = true;
    return;
  }

  fileSync.saving = true;
  const version = fileSync.version;
  const savedAt = nowIso();
  const body = JSON.stringify({ savedAt, baseSavedAt: fileSync.baseSavedAt, ...state.progress });
  try {
    const res = await fetch(PROGRESS_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      // keepalive cho request đi tiếp khi tab đã đóng, nhưng trình duyệt giới hạn ~64KB
      keepalive: keepalive && new Blob([body]).size < 60000,
    });
    if (res.status === 409) {
      // Trình duyệt khác đã ghi bản mới hơn: ngừng ghi để không đè mất bản đó
      fileSync.enabled = false;
      throw appError("sync.conflict");
    }
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    fileSync.baseSavedAt = savedAt;
    if (version === fileSync.version) storage.set(KEY_FILE_SYNC, "synced");
    setSyncError(null);
  } catch (err) {
    setSyncError(err.i18n ? err : appError("sync.error", err.message));
  } finally {
    fileSync.saving = false;
    if (fileSync.again) {
      fileSync.again = false;
      saveToFile();
    }
  }
}

function setSyncError(err) {
  if (fileSync.error === err) return;
  fileSync.error = err;
  if (state.content) renderSyncStatus();
}

function renderSyncStatus() {
  const el = $("sync-status");
  el.classList.toggle("warn", Boolean(fileSync.error));
  if (fileSync.error) el.textContent = errorText(fileSync.error);
  else el.textContent = fileSync.enabled ? t("sync.file", PROGRESS_FILE) : t("sync.browser");
}

// =====================================================================
// Xuất / nhập tiến độ
// =====================================================================
function exportProgress() {
  const json = JSON.stringify({ exportedAt: nowIso(), ...state.progress }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dsa-progress-${nowIso().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importProgress(file) {
  try {
    const data = parseJson(file.name, await file.text());
    if (!isObject(data?.items) || !isObject(data?.solved)) throw appError("error.notProgress");
    if (!confirm(t("confirm.import"))) return;
    state.progress = { items: data.items, solved: data.solved };
    saveProgress();
    render();
  } catch (err) {
    alert(t("error.import", errorText(err)));
  }
}

// =====================================================================
// Sự kiện
// =====================================================================
$("lang-switch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-lang]");
  if (btn) setLanguage(btn.dataset.lang);
});

$("theme-switch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-set-theme]");
  if (btn) setTheme(btn.dataset.setTheme);
});

$("phases").addEventListener("click", (e) => {
  const head = e.target.closest("[data-phase]");
  if (head) {
    const id = head.dataset.phase;
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    render(`[data-phase="${CSS.escape(id)}"]`);
    return;
  }
  const opener = e.target.closest("[data-open]");
  if (opener) openDetail(opener.dataset.open);
});

$("phases").addEventListener("change", (e) => {
  const id = e.target.dataset.done;
  if (!id) return;
  setDone(id, e.target.checked);
  render(`[data-done="${CSS.escape(id)}"]`);
});

for (const btn of document.querySelectorAll("[data-filter]")) {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
}

$("btn-expand").addEventListener("click", () => {
  if (allExpanded()) state.expanded.clear();
  else state.content.phases.forEach((p) => state.expanded.add(p.id));
  render();
});

$("btn-export").addEventListener("click", exportProgress);
$("btn-import").addEventListener("click", () => $("import-picker").click());
$("btn-reload-data").addEventListener("click", () => $("data-picker").click());

$("import-picker").addEventListener("change", (e) => {
  const [file] = e.target.files;
  e.target.value = "";
  if (file) importProgress(file);
});

$("data-picker").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  try {
    const content = await loadContent(readFromFiles(files));
    storage.set(KEY_CONTENT_CACHE, content);
    showApp(content);
  } catch (err) {
    showLoader(err);
  }
});

// Đóng tab khi còn thay đổi đang chờ ghi ra file: gửi luôn, không đợi
addEventListener("pagehide", () => {
  if (fileSync.timer) saveToFile({ keepalive: true });
});

$("btn-reset").addEventListener("click", () => {
  if (!confirm(t("confirm.reset"))) return;
  state.progress = emptyProgress();
  saveProgress();
  render();
});

// --- Dialog chi tiết ---
const detail = $("detail");
let pressedOnBackdrop = false;

// Chỉ đóng khi bấm và thả chuột đều ở vùng tối bên ngoài,
// để kéo bôi đen chữ trong textarea ra ngoài không làm đóng dialog
detail.addEventListener("pointerdown", (e) => { pressedOnBackdrop = e.target === detail; });

detail.addEventListener("click", (e) => {
  if (e.target === detail && pressedOnBackdrop) {
    detail.close();
    return;
  }
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    selectTab(tab.dataset.tab);
    return;
  }
  const codeLang = e.target.closest("[data-code-lang]");
  if (codeLang) {
    selectCodeLang(codeLang.dataset.codeLang);
    return;
  }
  const aiMode = e.target.closest("[data-ai-mode]");
  if (aiMode) {
    setAiMode(aiMode.dataset.aiMode);
    return;
  }
  const actionEl = e.target.closest("[data-action]");
  const action = actionEl?.dataset.action;
  if (action === "close") detail.close();
  if (action === "copy") copyCode(e.target.closest(".code"));
  if (action === "review") markReviewed(state.openId);
  if (action === "help") toggleHelp(e.target.closest(".problem"));
  if (action === "ask") askAi(actionEl);
});

detail.addEventListener("change", (e) => {
  const { done, solved, check } = e.target.dataset;
  if (done) setDone(done, e.target.checked);
  if (solved) {
    setSolved(solved, e.target.checked);
    e.target.closest(".problem").classList.toggle("solved", e.target.checked);
  }
  if (check) {
    updateItem(state.openId, { checks: { ...itemProgress(state.openId).checks, [check]: e.target.checked } });
  }
  refreshDetail();
});

// Ghi chú và code được lưu ngay khi gõ
detail.addEventListener("input", (e) => {
  const { field } = e.target.dataset;
  if (field) updateItem(state.openId, { [field]: e.target.value });
});

// Tab trong ô code chèn 4 dấu cách; Shift+Tab vẫn dùng để chuyển focus ra ngoài
detail.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.shiftKey || !e.target.matches("textarea.mono")) return;
  e.preventDefault();
  e.target.setRangeText("    ", e.target.selectionStart, e.target.selectionEnd, "end");
  e.target.dispatchEvent(new Event("input", { bubbles: true }));
});

detail.addEventListener("close", () => {
  const id = state.openId;
  state.openId = null;
  render(`[data-open="${CSS.escape(id)}"]`); // cập nhật tick, số bài đã giải, ghi chú ở danh sách
});

// =====================================================================
// Khởi động
// =====================================================================
const savedLang = storage.get(KEY_LANG, null);
if (I18N[savedLang]) state.lang = savedLang;
state.codeLang = storage.get(KEY_CODE_LANG, state.codeLang);
const savedAiMode = storage.get(KEY_AI_MODE, null);
if (AI_MODES.includes(savedAiMode)) state.aiMode = savedAiMode;
setTheme(storage.get(KEY_THEME, "auto"));

$("lang-switch").innerHTML = LANGUAGES.map((l) => `
  <button type="button" data-lang="${esc(l.code)}" title="${esc(l.name)}">${esc(l.label)}</button>`).join("");
applyStaticTexts();
boot();
