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
const KEY_DRIVE_SYNC = "dsa_drive_sync";        // xem phần "Đồng bộ Google Drive"
const LEGACY_KEYS = { v2: "dsa_roadmap_v2", v1: "dsa_roadmap_v1" };
const GOOGLE_API = "api/google";                // chỉ có khi chạy bằng start.sh (server.js)
const DRIVE_FILE_NAME = "dsa-roadmap-progress.json";
const DRIVE_SAVE_DELAY_MS = 1500;               // gom các lần gõ phím liền nhau thành 1 lần ghi
const REVIEW_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Màu của các nhãn. Class Tailwind phải viết đủ cả chuỗi (không ghép chuỗi) thì Tailwind mới tìm thấy khi build
const NEUTRAL_CLASS = "bg-soft text-fg-2";
const TYPE_CLASS = { theory: "bg-accent-bg text-accent", practice: "bg-ok-bg text-ok" };
const RESOURCE_CLASS = {
  article: "bg-accent-bg text-accent",
  video: "bg-danger-bg text-danger",
  course: "bg-purple-bg text-purple",
  docs: NEUTRAL_CLASS,
  book: "bg-warn-bg text-warn",
  visual: "bg-ok-bg text-ok",
  practice: "bg-ok-bg text-ok",
};
const LEVEL_CLASS = {
  easy: "bg-ok-bg text-ok",
  medium: "bg-warn-bg text-warn",
  hard: "bg-danger-bg text-danger",
  advanced: "bg-danger-bg text-danger",
  expert: "bg-danger-bg text-danger",
};
const CODE_LANG_LABEL = { python: "Python", java: "Java", cpp: "C++", javascript: "JavaScript", go: "Go" };
// Tab của khung code mẫu, giống tab file trong VS Code: tên file + biểu tượng màu của ngôn ngữ (màu của bộ icon Seti)
const CODE_FILES = {
  python: { name: "solution.py", icon: "py", iconClass: "text-[#519aba]" },
  java: { name: "Solution.java", icon: "J", iconClass: "text-[#cc3e44]" },
  cpp: { name: "solution.cpp", icon: "C++", iconClass: "text-[#a074c4]" },
  javascript: { name: "solution.js", icon: "JS", iconClass: "text-[#cbcb41]" },
  go: { name: "solution.go", icon: "GO", iconClass: "text-[#519aba]" },
};

// Icon nhỏ (theo bộ codicon của VS Code)
const ICON_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="size-4 shrink-0 text-fg-2 transition-transform duration-150 group-aria-expanded/head:rotate-90"><path d="M10.07 8.02 5.72 3.67l.61-.62L11 7.72v.61L6.33 13l-.61-.62 4.35-4.36Z"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="size-4"><path d="m8 8.71 3.65 3.65.71-.71L8.71 8l3.65-3.65-.71-.71L8 7.29 4.35 3.64l-.71.71L7.29 8l-3.65 3.65.71.71L8 8.71Z"/></svg>`;
const ICON_COPY = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="size-3.5"><path d="M4 4V2.5A1.5 1.5 0 0 1 5.5 1h7A1.5 1.5 0 0 1 14 2.5v7a1.5 1.5 0 0 1-1.5 1.5H11v1.5A1.5 1.5 0 0 1 9.5 14h-7A1.5 1.5 0 0 1 1 12.5v-7A1.5 1.5 0 0 1 2.5 4H4Zm1 0h4.5A1.5 1.5 0 0 1 11 5.5V10h1.5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5V4ZM2.5 5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-7Z"/></svg>`;

// Icon của 3 tab trong màn hình chi tiết, như icon file trong tab của VS Code
const TAB_ICON = {
  learn: { icon: "M↓", iconClass: "text-syn-keyword" },
  problems: { icon: "{}", iconClass: "text-syn-function" },
  notes: { icon: "≡", iconClass: "text-syn-comment" },
};

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
  .map((p) => `<p class="mb-2 last:mb-0">${fmt(p).replace(/\n/g, "<br>")}</p>`)
  .join("");

// Gạch đầu dòng "-" như markdown
const bulletList = (items) => `<ul class="space-y-1">${items.map((x) => `
  <li class="relative pl-4 before:absolute before:left-0.5 before:font-mono before:text-syn-keyword before:content-['-']">${fmt(localize(x))}</li>`).join("")}</ul>`;
// Tiêu đề khung viết như heading markdown: ## MÔ TẢ
const block = (titleKey, html) => `
  <div>
    <h3 class="label mb-2 before:text-syn-keyword before:content-['##_']">${esc(t(titleKey))}</h3>
    ${html}
  </div>`;
const emptyNote = (text) => `<p class="text-14 text-muted">${esc(text)}</p>`;
const ownClass = (map, key) => (Object.hasOwn(map, key) ? map[key] : NEUTRAL_CLASS);

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

// =====================================================================
// Tô màu code mẫu theo bảng màu Light+ / Dark+ của VS Code (màu nằm trong index.css: --color-syn-*).
// Chỉ tách comment, chuỗi, số, từ khoá, tên hàm/kiểu và cặp ngoặc: đủ cho code mẫu ngắn, không phải parser thật.
// =====================================================================
const wordSet = (text) => new Set(text.split(" "));
const C_COMMENT = String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`;
const C_STRING = String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'`;
const NUMBER = String.raw`\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)[lLfFdDuU]*\b`;

// control: từ khoá điều khiển (tím), keyword: từ khoá khai báo/hằng (xanh dương), types: kiểu dựng sẵn (xanh ngọc)
const SYNTAX = {
  python: {
    comment: String.raw`#[^\n]*`,
    string: String.raw`[rRbBuUfF]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')`,
    control: wordSet("if elif else for while break continue return try except finally raise with as import from pass yield await async match case assert del global nonlocal"),
    keyword: wordSet("def class lambda and or not in is None True False self cls"),
    types: wordSet("int float str bool list dict set tuple bytes object complex frozenset"),
  },
  java: {
    comment: C_COMMENT,
    string: C_STRING,
    control: wordSet("if else for while do switch case default break continue return try catch finally throw throws import package yield"),
    keyword: wordSet("public private protected static final abstract class interface enum record extends implements new this super null true false instanceof var void int long short byte char boolean double float synchronized volatile transient native"),
    types: wordSet(""),
  },
  cpp: {
    comment: C_COMMENT,
    string: C_STRING,
    pre: String.raw`#[ \t]*[a-z]+`,
    header: String.raw`(?<=#[ \t]*include[ \t]*)<[^>\n]*>`,
    control: wordSet("if else for while do switch case default break continue return try catch throw goto"),
    keyword: wordSet("int long short char bool double float void auto const constexpr static struct class union enum public private protected template typename using namespace new delete this nullptr true false unsigned signed sizeof inline virtual override operator friend typedef"),
    types: wordSet("std vector string map unordered_map set unordered_set multiset pair queue stack deque priority_queue array bitset size_t int64_t uint64_t"),
  },
  javascript: {
    comment: C_COMMENT,
    string: C_STRING + "|`(?:\\\\.|[^`\\\\])*`",
    control: wordSet("if else for while do switch case default break continue return try catch finally throw import export from as await yield"),
    keyword: wordSet("function const let var class extends new this super null undefined true false typeof instanceof async static get set of in delete void"),
    types: wordSet(""),
  },
  go: {
    comment: C_COMMENT,
    string: C_STRING + "|`[^`]*`",
    control: wordSet("if else for switch case default break continue return go defer select goto fallthrough range import package"),
    keyword: wordSet("func var const type struct interface map chan nil true false"),
    types: wordSet("int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error any"),
  },
};

// Class Tailwind viết đủ cả chuỗi để Tailwind tìm thấy khi build
const TOKEN_CLASS = {
  comment: "text-syn-comment",
  string: "text-syn-string",
  header: "text-syn-string",
  pre: "text-syn-control",
  decorator: "text-syn-function",
  number: "text-syn-number",
  control: "text-syn-control",
  keyword: "text-syn-keyword",
  type: "text-syn-type",
  constant: "text-syn-constant",
  function: "text-syn-function",
  variable: "text-syn-variable",
};
const BRACKET_CLASS = ["text-bracket-1", "text-bracket-2", "text-bracket-3"];
const CALL_AFTER = /[ \t]*\(/y;

// Gộp các luật của 1 ngôn ngữ thành 1 regex; nhóm nào khớp thì đó là loại token
function syntaxOf(lang) {
  const rules = Object.hasOwn(SYNTAX, lang) ? SYNTAX[lang] : null;
  if (rules && !rules.re) {
    rules.re = new RegExp([
      `(?<comment>${rules.comment})`,
      `(?<string>${rules.string})`,
      rules.header && `(?<header>${rules.header})`,
      rules.pre && `(?<pre>${rules.pre})`,
      String.raw`(?<decorator>@[A-Za-z_][\w.]*)`,
      `(?<number>${NUMBER})`,
      String.raw`(?<word>[A-Za-z_$][\w$]*)`,
      String.raw`(?<open>[([{])`,
      String.raw`(?<close>[)\]}])`,
    ].filter(Boolean).join("|"), "g");
  }
  return rules;
}

function wordKind(rules, word, code, end) {
  if (rules.control.has(word)) return "control";
  if (rules.keyword.has(word)) return "keyword";
  if (rules.types.has(word)) return "type";
  if (/^[A-Z][A-Z\d_]+$/.test(word)) return "constant"; // MOD, INF
  if (/^[A-Z]/.test(word)) return "type";               // tên class
  CALL_AFTER.lastIndex = end;
  return CALL_AFTER.test(code) ? "function" : "variable";
}

// Trả về HTML đã escape. textContent của kết quả đúng bằng code gốc, nên nút Copy lấy textContent là đủ.
function highlight(code, lang) {
  const rules = syntaxOf(lang);
  if (!rules) return esc(code);
  let html = "";
  let last = 0;
  let depth = 0; // độ sâu ngoặc, để tô 3 màu xoay vòng như VS Code
  for (const m of code.matchAll(rules.re)) {
    const [text] = m;
    const kind = Object.keys(m.groups).find((k) => m.groups[k] !== undefined);
    let cls;
    if (kind === "word") cls = TOKEN_CLASS[wordKind(rules, text, code, m.index + text.length)];
    else if (kind === "open") cls = BRACKET_CLASS[depth++ % 3];
    else if (kind === "close") cls = BRACKET_CLASS[(depth = Math.max(depth - 1, 0)) % 3];
    else cls = TOKEN_CLASS[kind];
    html += `${esc(code.slice(last, m.index))}<span class="${cls}">${esc(text)}</span>`;
    last = m.index + text.length;
  }
  return html + esc(code.slice(last));
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

const locale = () => LANGUAGES.find((l) => l.code === state.lang)?.locale;
const formatDate = (iso) => new Date(iso).toLocaleDateString(locale());
const formatTime = (iso) => new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

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
    showApp(await loadContent(readFromServer));
    startDrive();
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
  state.progress = loadProgress(content.phases);
  if (!state.expanded.size && content.phases.length) state.expanded.add(content.phases[0].id);

  $("btn-reload-data").hidden = location.protocol !== "file:";
  // WebView của app Android không tải file về được; ở đó bản sao lưu là file trên Drive
  $("btn-export").hidden = isNativeApp();
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
// Tiến độ (lưu trong localStorage, và đồng bộ qua Google Drive khi đã kết nối)
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
  drive.version++;
  // Đánh dấu còn thay đổi chưa ghi lên Drive, để lần sau mở app bản Drive cũ không đè mất
  storage.set(KEY_DRIVE_SYNC, { ...storage.get(KEY_DRIVE_SYNC, null), pending: true });
  queueDriveSave();
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
    btn.setAttribute("aria-pressed", String(btn.dataset.filter === state.filter));
  }
  $("btn-expand").textContent = allExpanded() ? t("toolbar.collapse") : t("toolbar.expand");

  // innerHTML thay toàn bộ phần tử, nên trả focus về đúng chỗ cho người dùng bàn phím
  if (focusSelector) $("phases").querySelector(focusSelector)?.focus();
}

// Mỗi giai đoạn là 1 thư mục trong cây Explorer của VS Code: mũi tên, số thứ tự, các mục thụt vào có đường kẻ dọc
function renderPhase(phase, index) {
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
      : `<div class="border-t border-line py-2.5 pr-3 pl-9.5 font-mono text-12 text-muted">${esc(t(`filter.empty.${state.filter}`))}</div>`;
  }

  return `
    <div class="mb-2 overflow-hidden rounded-md border border-line bg-card">
      <button type="button" class="group/head flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left select-none hover:bg-soft focus-visible:-outline-offset-2"
        data-phase="${esc(phase.id)}" aria-expanded="${isOpen}">
        ${ICON_CHEVRON}
        <span class="font-mono text-12 text-muted" aria-hidden="true">${String(index).padStart(2, "0")}</span>
        <div class="min-w-0 flex-1">
          <div class="text-15 font-semibold">${esc(localize(phase.name))}</div>
          <div class="mt-0.5 mb-1.5 font-mono text-12 text-fg-2">${meta}</div>
          <div class="h-1 overflow-hidden rounded-full bg-line-strong">
            <div class="h-full rounded-full bg-ok-fill transition-[width] duration-200" style="width:${pct}%"></div>
          </div>
        </div>
        <span class="min-w-11 text-right font-mono text-13 ${pct === 100 ? "text-ok" : "text-fg-2"}">${pct}%</span>
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

  // Tên mục bị gạch khi ô tick được chọn (group-has-checked), không cần thêm class "done".
  // before: đường kẻ dọc nối các mục trong cùng thư mục (indent guide của VS Code)
  return `
    <div class="group/item relative flex items-start gap-2.5 border-t border-line py-1.5 pr-3 pl-9.5 hover:bg-soft
      before:absolute before:inset-y-0 before:left-4.75 before:w-px before:bg-line-strong before:content-['']">
      <input type="checkbox" class="mt-1.25" data-done="${esc(item.id)}" ${p.done ? "checked" : ""} aria-label="${esc(t("item.markDone"))}">
      <button type="button" class="group/open flex min-w-0 flex-1 cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-sm py-0.5 text-left text-14"
        data-open="${esc(item.id)}">
        <span class="group-hover/open:text-accent group-has-checked/item:text-muted group-has-checked/item:line-through group-has-checked/item:*:text-muted">${fmt(localize(item.title))}</span>
        <span class="tag ${TYPE_CLASS[type]}">${esc(t(`type.${type}`))}</span>
        ${needsReview(item) ? `<span class="tag bg-warn-bg text-warn">${esc(t("tag.review"))}</span>` : ""}
        ${meta.length ? `<span class="basis-full font-mono text-12 text-muted">${esc(meta.join(" · "))}</span>` : ""}
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

  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  $("stat-pct").textContent = `${pct}%`;
  $("stat-bar").style.width = `${pct}%`;
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

  // Tab giống tab file của VS Code: tab đang chọn có viền trên màu accent và nền liền với nội dung bên dưới.
  // Ô trống cuối hàng tab nối tiếp đường kẻ dưới của các tab chưa chọn.
  return `
    <header class="flex items-start gap-3 px-5 pt-4 pb-3 max-sm:px-4">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5 font-mono text-12 text-fg-2">
          <span>${esc(localize(phase.name))}</span>
          <span class="text-muted" aria-hidden="true">›</span>
          <span class="tag ${TYPE_CLASS[type]}">${esc(t(`type.${type}`))}</span>
        </div>
        <h2 id="detail-title" class="mt-1 text-19 leading-[1.35] font-semibold">${fmt(localize(item.title))}</h2>
      </div>
      <button type="button" class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-fg-2 hover:bg-soft hover:text-fg"
        data-action="close" aria-label="${esc(t("detail.close"))}">${ICON_CLOSE}</button>
    </header>
    <div class="flex overflow-x-auto border-t border-line bg-page" role="tablist">
      ${tabs.map((tab, i) => `
        <button type="button" role="tab" data-tab="${tab.id}" aria-selected="${i === 0}"
          class="flex cursor-pointer items-center gap-2 border-t-2 border-r border-b border-t-transparent border-r-line border-b-line px-4 py-2 text-13 whitespace-nowrap text-fg-2
            hover:text-fg aria-selected:border-t-accent-strong aria-selected:border-b-transparent aria-selected:bg-card aria-selected:text-fg">
          <span class="font-mono text-11 font-bold ${TAB_ICON[tab.id].iconClass}" aria-hidden="true">${TAB_ICON[tab.id].icon}</span>${tab.label}
        </button>`).join("")}
      <div class="flex-1 border-b border-line" aria-hidden="true"></div>
    </div>
    <div id="detail-scroll" class="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-7 max-sm:px-4">
      ${tabs.map((tab, i) => `
        <section class="space-y-6" role="tabpanel" data-panel="${tab.id}" ${i === 0 ? "" : "hidden"}>${tab.body}</section>`).join("")}
    </div>
    <footer class="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-line bg-page px-5 py-2.5 max-sm:px-4">
      <label class="flex cursor-pointer items-center gap-2 text-14">
        <input type="checkbox" data-done="${esc(item.id)}" ${isDone(item) ? "checked" : ""}> ${esc(t("foot.done"))}
      </label>
      <span class="min-w-0 flex-1 font-mono text-12 text-fg-2" id="foot-info"></span>
      <button type="button" class="btn btn-primary" id="btn-review" data-action="review"></button>
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
    examples.length && block("block.examples", `<div class="space-y-2">${examples.map(renderExample).join("")}</div>`),
    templates.length && block("block.template", renderTemplates(templates)),
    item.complexity && block("block.complexity", `<p>${fmt(localize(item.complexity))}</p>`),
    pitfalls.length && block("block.pitfalls", bulletList(pitfalls)),
    resources.length && block("block.resources", `<ul>${resources.map(renderResource).join("")}</ul>`),
  ].filter(Boolean);
  return blocks.join("") || emptyNote(t("learn.empty"));
}

function renderExample(ex) {
  // Khung ví dụ như cửa sổ terminal: nhãn vào/ra màu từ khoá, giá trị màu chữ của editor
  const row = (labelKey, value) => (value ? `
    <div class="flex items-baseline gap-2 font-mono text-13 [&+&]:mt-0.5">
      <span class="w-13 shrink-0 text-syn-keyword">${esc(t(labelKey))}</span>
      <code class="bg-transparent p-0 whitespace-pre-wrap text-code-fg [font-size:inherit] [word-break:break-word]">${esc(localize(value))}</code>
    </div>` : "");
  return `
    <div class="rounded-md border border-line bg-code px-3.5 py-2.5">
      ${ex.title ? `<div class="mb-1 text-14 font-semibold">${fmt(localize(ex.title))}</div>` : ""}
      ${row("example.input", ex.input)}
      ${row("example.output", ex.output)}
      ${ex.explain ? `<p class="mt-1.5 text-13 text-fg-2">${fmt(localize(ex.explain))}</p>` : ""}
    </div>`;
}

const codeFile = (lang) => (Object.hasOwn(CODE_FILES, lang)
  ? CODE_FILES[lang]
  : { name: `solution.${lang || "txt"}`, icon: "{}", iconClass: "text-fg-2" });

// Nhiều ngôn ngữ code trong 1 khung, trình bày như editor của VS Code:
// mỗi ngôn ngữ là 1 tab file (solution.py, Solution.java...), cột số dòng bên trái, code tô màu.
function renderTemplates(templates) {
  const active = templates.some((tpl) => tpl.lang === state.codeLang) ? state.codeLang : templates[0].lang;
  const tabs = templates.map((tpl) => {
    const file = codeFile(tpl.lang);
    return `
    <button type="button" data-code-lang="${esc(tpl.lang)}" aria-pressed="${tpl.lang === active}"
      aria-label="${esc(CODE_LANG_LABEL[tpl.lang] || tpl.lang || "code")}"
      class="flex cursor-pointer items-center gap-1.5 border-t-2 border-r border-t-transparent border-r-line bg-code-tab px-3 py-1.5 font-mono text-12 whitespace-nowrap text-fg-2
        hover:text-fg aria-pressed:border-t-accent-strong aria-pressed:bg-code aria-pressed:text-fg">
      <span class="text-11 font-bold ${file.iconClass}" aria-hidden="true">${esc(file.icon)}</span>${esc(file.name)}
    </button>`;
  }).join("");

  // Cột số dòng là 1 <pre> riêng cùng cỡ chữ và line-height với code nên các dòng thẳng hàng;
  // nó không nằm trong <pre> của code nên Copy không lấy số dòng, và không trôi khi cuộn ngang.
  const panes = templates.map((tpl) => {
    const code = codeText(localize(tpl.code));
    const lineNumbers = code.split("\n").map((_, i) => i + 1).join("\n");
    return `
    <div class="flex bg-code font-mono text-13 leading-[1.6]" data-code="${esc(tpl.lang)}" ${tpl.lang === active ? "" : "hidden"}>
      <pre class="shrink-0 py-3 pr-4 pl-4 text-right text-gutter select-none" aria-hidden="true">${lineNumbers}</pre>
      <pre class="min-w-0 flex-1 overflow-x-auto py-3 pr-4 text-code-fg"><code
        class="rounded-none bg-transparent p-0 text-code-fg [font-size:inherit]">${highlight(code, tpl.lang)}</code></pre>
    </div>`;
  }).join("");

  return `
    <div class="overflow-hidden rounded-md border border-line-strong" data-templates>
      <div class="flex items-stretch bg-code-bar">
        <div class="flex min-w-0 overflow-x-auto">${tabs}</div>
        <button type="button" class="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 px-3 font-mono text-12 text-fg-2 hover:text-fg"
          data-action="copy">${ICON_COPY}<span data-copy-label>${esc(t("copy"))}</span></button>
      </div>
      ${panes}
    </div>`;
}

const LINK_ROW = "flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line py-1.75";

function renderResource(resource) {
  const type = Object.hasOwn(RESOURCE_CLASS, resource.type) ? resource.type : "article";
  return `
    <li class="${LINK_ROW}">
      <span class="pill min-w-19 shrink-0 text-center ${RESOURCE_CLASS[type]}">${esc(t(`res.${type}`))}</span>
      <a class="min-w-0 flex-1" href="${esc(safeUrl(resource.url))}" target="_blank" rel="noopener noreferrer">${esc(localize(resource.title))}</a>
    </li>`;
}

function renderProblemsTab(item) {
  const groups = groupBy(item.problems || [], (p) => sourceOf(p.url));
  const lists = (item.resources || []).filter((r) => r.type === "practice");

  const groupHtml = [...groups].map(([source, problems]) => `
    <div data-group>
      <h4 class="mb-0.5 font-mono text-13 font-semibold">${esc(source)} <span class="ml-1 text-12 font-normal text-syn-number" data-group-count></span></h4>
      <ul>${problems.map(renderProblem).join("")}</ul>
    </div>`).join("");

  const blocks = [
    groups.size && block("block.problems", `<div class="space-y-4">${groupHtml}</div>`),
    lists.length && block("block.moreLists", `<ul>${lists.map(renderResource).join("")}</ul>`),
  ].filter(Boolean);
  return blocks.join("") || emptyNote(t("problems.empty"));
}

// Tên bài bị gạch khi ô tick được chọn (group-has-checked), không cần thêm class "solved"
function renderProblem(problem) {
  const solved = isSolved(problem.url);
  const title = localize(problem.title);
  const level = problem.level
    ? `<span class="pill ${ownClass(LEVEL_CLASS, problem.level.toLowerCase())}">${esc(problem.level)}</span>`
    : "";
  return `
    <li class="group/problem ${LINK_ROW}" data-url="${esc(problem.url)}">
      <input type="checkbox" data-solved="${esc(problem.url)}" ${solved ? "checked" : ""}
        aria-label="${esc(t("problem.solvedLabel", title))}">
      <a class="min-w-0 flex-1 group-has-checked/problem:text-muted group-has-checked/problem:line-through"
        href="${esc(safeUrl(problem.url))}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>
      ${level}
      <button type="button" class="btn btn-sm text-fg-2 aria-expanded:border-accent aria-expanded:text-accent"
        data-action="help" aria-expanded="false">${esc(t("help.toggle"))}</button>
      ${problem.note ? `<span class="basis-full pl-6.5 text-12 text-muted">${fmt(localize(problem.note))}</span>` : ""}
      ${renderHelp(problem)}
    </li>`;
}

// Khung "Cách giải" dưới mỗi bài: link lời giải + hỏi AI với câu hỏi soạn sẵn
function renderHelp(problem) {
  const label = "label";
  const links = solutionLinks(problem).map((link) => `
    <a href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.label)}</a>`).join("");
  const modes = AI_MODES.map((mode) => `
    <button type="button" data-ai-mode="${mode}" aria-pressed="${mode === state.aiMode}">${esc(t(`help.mode.${mode}`))}</button>`).join("");
  const tools = Object.entries(AI_TOOLS).map(([id, tool]) => `
    <button type="button" class="btn btn-sm" data-action="ask" data-tool="${id}">${esc(t("help.open", tool.name))}</button>`).join("");

  return `
    <div class="my-1 ml-6.5 grid basis-full grid-cols-[max-content_1fr] items-center gap-x-3.5 gap-y-2 rounded-md border border-line bg-page px-3 py-2.5 text-13
      max-sm:ml-0 max-sm:grid-cols-1 max-sm:gap-1.5" data-help hidden>
      <p class="col-span-full mb-2 text-12 text-fg-2">${esc(t("help.tip"))}</p>
      <span class="${label}">${esc(t("help.read"))}</span>
      <div class="flex flex-wrap gap-x-4 gap-y-0.5">${links}</div>
      <span class="${label}">${esc(t("help.ask"))}</span>
      <div class="flex flex-wrap items-center gap-1.5">
        <div class="switch mr-1" role="group" aria-label="${esc(t("help.modeLabel"))}">${modes}</div>
        ${tools}
        <button type="button" class="btn btn-sm" data-action="ask">${esc(t("help.copy"))}</button>
      </div>
      <p class="col-span-full text-12 text-ok empty:hidden" data-help-status aria-live="polite"></p>
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
  const btn = li.querySelector('[data-action="help"]');
  const open = btn.getAttribute("aria-expanded") !== "true";
  btn.setAttribute("aria-expanded", String(open));
  li.querySelector("[data-help]").hidden = !open;
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
  const li = btn.closest("[data-url]");
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
  li.querySelector("[data-help-status]").textContent = messages.join(" ");
}

function renderNotesTab(item) {
  const p = itemProgress(item.id);
  const checklist = state.content.codeReviewChecklist || [];
  const checks = checklist.map((c) => `
    <label class="flex cursor-pointer items-start gap-2.5 py-1 text-14">
      <input type="checkbox" class="mt-1" data-check="${esc(c.id)}" ${p.checks?.[c.id] ? "checked" : ""}>
      <span>${fmt(localize(c.text))}</span>
    </label>`).join("");

  return [
    block("block.notes", `<textarea class="field" data-field="notes" rows="5"
      placeholder="${esc(t("notes.placeholder"))}">${esc(p.notes || "")}</textarea>`),
    block("block.code", `<textarea class="field font-mono text-13 leading-[1.6] text-code-fg tab-4" data-field="code" rows="12" wrap="off" spellcheck="false"
      placeholder="${esc(t("code.placeholder"))}">${esc(p.code || "")}</textarea>`),
    checklist.length > 0 && block("block.checklist", `<div>${checks}</div>`),
    block("block.history", '<div id="review-history"></div>'),
  ].filter(Boolean).join("");
}

function renderHistory(p) {
  const rows = [];
  if (p.doneAt) rows.push(t("history.done", formatDate(p.doneAt)));
  (p.reviews || []).forEach((iso, i) => rows.push(t("history.review", i + 1, formatDate(iso))));
  return rows.length
    ? `<ul>${rows.map((row) => `
      <li class="flex items-center gap-2.5 py-0.5 font-mono text-13 before:size-1.5 before:shrink-0 before:rounded-full before:bg-ok-fill before:content-['']">${esc(row)}</li>`).join("")}</ul>`
    : emptyNote(t("history.empty", REVIEW_AFTER_DAYS));
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
  for (const group of body.querySelectorAll("[data-group]")) {
    const boxes = [...group.querySelectorAll("[data-solved]")];
    group.querySelector("[data-group-count]").textContent = `${boxes.filter((b) => b.checked).length}/${boxes.length}`;
  }
  $("review-history").innerHTML = renderHistory(p);
  $("foot-info").innerHTML = last
    ? esc(t("foot.lastStudied", timeAgo(last))) +
      (needsReview(item) ? ` · <strong class="text-warn">${esc(t("foot.due"))}</strong>` : "")
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
  $("detail-scroll").scrollTop = 0;
}

// Chọn Python / Java; ghi nhớ để các mục khác mở ra cũng hiện ngôn ngữ đó
function selectCodeLang(lang) {
  state.codeLang = lang;
  storage.set(KEY_CODE_LANG, lang);
  for (const box of $("detail-body").querySelectorAll("[data-templates]")) {
    if (!box.querySelector(`[data-code="${CSS.escape(lang)}"]`)) continue;
    for (const btn of box.querySelectorAll("[data-code-lang]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.codeLang === lang));
    }
    for (const pane of box.querySelectorAll("[data-code]")) pane.hidden = pane.dataset.code !== lang;
  }
}

async function copyCode(box) {
  const label = box.querySelector("[data-copy-label]");
  try {
    await navigator.clipboard.writeText(box.querySelector("[data-code]:not([hidden]) code").textContent);
    label.textContent = t("copy.done");
  } catch {
    label.textContent = t("copy.failed");
  }
  setTimeout(() => { label.textContent = t("copy"); }, 1500);
}

function markReviewed(id) {
  updateItem(id, { reviews: [...(itemProgress(id).reviews || []), nowIso()] });
  refreshDetail();
}

// =====================================================================
// Đồng bộ Google Drive: tiến độ nằm trong file dsa-roadmap-progress.json ở My Drive,
// cùng định dạng với file "Xuất tiến độ" nên tải về rồi "Nhập tiến độ" được.
//   Máy tính (start.sh): server.js giữ đăng nhập Google, cấp access token qua api/google/*
//   App Android: plugin GoogleDrive (mobile/android/app/src/main/java/.../GoogleDrivePlugin.java)
//   Mở cách khác (Live Server, mở thẳng file): chỉ lưu trong trình duyệt
// localStorage luôn giữ 1 bản trên máy, nên mất mạng hay chưa kết nối vẫn dùng bình thường.
//
// KEY_DRIVE_SYNC = { fileId, version, pending }: bản trên máy so với file trên Drive
//   chưa có fileId   chưa từng đồng bộ         -> gộp với file, bên Drive thắng khi trùng
//   pending: false   giống bản Drive `version` -> Drive có bản mới hơn thì lấy luôn bản Drive
//   pending: true    còn thay đổi chưa ghi      -> gộp với file, bên máy thắng khi trùng, rồi ghi
// =====================================================================
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
// Thẻ gắn vào file để tìm lại được dù bạn đổi tên hay chuyển nó sang thư mục khác
const DRIVE_TAG = { key: "dsaRoadmap", value: "progress" };
const TOKEN_MARGIN_MS = 60 * 1000;

const drive = {
  auth: null,       // cách lấy token: serverAuth (máy tính) / androidAuth; null = không có Drive
  status: "off",    // off | setup | login | syncing | synced | offline | error
  error: null,      // lỗi khi status = error
  syncedAt: null,   // lần đồng bộ xong gần nhất
  token: null,      // { value, expiresAt }
  version: 0,       // tăng mỗi lần tiến độ trên máy đổi
  timer: null,
  running: false,
  again: false,     // có yêu cầu đồng bộ mới trong lúc đang chạy
};

class NeedLogin extends Error {}
class Offline extends Error {}

const isNativeApp = () => Boolean(window.Capacitor?.isNativePlatform?.());

// fetch() chỉ lỗi (TypeError) khi không gửi được request: mất mạng, server.js đã tắt...
const request = (url, options) => fetch(url, options).catch(() => { throw new Offline(); });

// Máy tính: server.js trả token và tự làm mới bằng refresh token đã lưu
const serverAuth = {
  async getToken() {
    const res = await request(`${GOOGLE_API}/token`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new NeedLogin();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return { value: body.accessToken, expiresAt: body.expiresAt };
  },
  async clearToken() {},
  async login() {
    location.href = `${GOOGLE_API}/login`; // xong bên Google thì server.js đưa về lại trang này
  },
};

// Android: Google Play services cấp token; lần đầu hiện màn hình chọn tài khoản và cấp quyền
function androidAuth(plugin) {
  const getToken = async (interactive = false) => {
    try {
      const { accessToken } = await plugin.getAccessToken({ interactive });
      // Play services không báo hạn của token: giữ ngắn, hết hạn sớm hơn thì Drive trả 401 và xin lại
      return { value: accessToken, expiresAt: Date.now() + 10 * 60 * 1000 };
    } catch (err) {
      if (err.code === "NEED_CONSENT" || err.code === "CANCELLED") throw new NeedLogin();
      throw err;
    }
  };
  return {
    getToken,
    clearToken: (token) => plugin.clearToken({ token }).catch(() => {}),
    async login() {
      drive.token = await getToken(true);
      await syncDrive();
    },
  };
}

// null nếu cách mở app hiện tại không đồng bộ được
async function detectDriveAuth() {
  const plugin = isNativeApp() && window.Capacitor.Plugins?.GoogleDrive;
  if (plugin) return { auth: androidAuth(plugin), configured: true };
  if (location.protocol === "file:") return null;
  try {
    const res = await fetch(`${GOOGLE_API}/status`, { cache: "no-store" });
    if (!res.ok) return null;
    const { configured } = await res.json();
    return { auth: serverAuth, configured };
  } catch {
    return null; // server khác (Live Server, http.server...) không có API này
  }
}

async function startDrive() {
  const found = await detectDriveAuth();
  if (!found) return;
  if (!found.configured) {
    setDriveStatus("setup");
    return;
  }
  drive.auth = found.auth;
  syncDrive();
}

async function accessToken() {
  if (!drive.token || drive.token.expiresAt - TOKEN_MARGIN_MS < Date.now()) {
    drive.token = await drive.auth.getToken();
  }
  return drive.token.value;
}

// Gọi Drive API kèm token. allow404: trả null thay vì báo lỗi khi file không còn
async function driveFetch(url, options = {}, { allow404 = false, retry = true } = {}) {
  const token = await accessToken();
  const res = await request(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401 && retry) {
    // Token hết hạn hoặc bị thu hồi: bỏ đi, xin token mới rồi thử lại 1 lần
    drive.token = null;
    await drive.auth.clearToken(token);
    return driveFetch(url, options, { allow404, retry: false });
  }
  if (res.status === 404 && allow404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return res;
}

const driveFileUrl = (id, params) => `${DRIVE_FILES}/${encodeURIComponent(id)}?${new URLSearchParams(params)}`;

// File đã biết id: null nếu đã bị xoá hoặc nằm trong thùng rác
async function getDriveFile(id) {
  const res = await driveFetch(driveFileUrl(id, { fields: "id,version,trashed" }), {}, { allow404: true });
  const file = res && (await res.json());
  return file && !file.trashed ? file : null;
}

// Quyền drive.file chỉ thấy file do app tạo, nên tìm theo thẻ là đủ
async function findDriveFile() {
  const params = new URLSearchParams({
    q: `appProperties has { key='${DRIVE_TAG.key}' and value='${DRIVE_TAG.value}' } and trashed = false`,
    spaces: "drive",
    orderBy: "modifiedTime desc",
    fields: "files(id,version)",
    pageSize: "1",
  });
  const res = await driveFetch(`${DRIVE_FILES}?${params}`);
  return (await res.json()).files[0] || null;
}

async function downloadDriveFile(id) {
  const res = await driveFetch(driveFileUrl(id, { alt: "media" }));
  const data = await res.json().catch(() => null);
  // File bị sửa tay sai định dạng: báo lỗi, không ghi đè
  if (!isObject(data?.items) || !isObject(data?.solved)) throw appError("sync.badFile", DRIVE_FILE_NAME);
  return { items: data.items, solved: data.solved };
}

const progressJson = (progress) => `${JSON.stringify({ savedAt: nowIso(), ...progress }, null, 2)}\n`;

// Ghi đè file có sẵn, hoặc tạo file mới khi chưa có id. Trả về { id, version }
async function writeDriveFile(id, progress) {
  if (id) {
    const res = await driveFetch(`${DRIVE_UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id,version`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: progressJson(progress),
    });
    return res.json();
  }
  // Tạo file: gửi thông tin file (tên, thẻ) và nội dung trong cùng 1 request
  const boundary = `dsa-${Math.random().toString(36).slice(2)}`;
  const metadata = { name: DRIVE_FILE_NAME, mimeType: "application/json", appProperties: { [DRIVE_TAG.key]: DRIVE_TAG.value } };
  const body = [
    `--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", JSON.stringify(metadata),
    `--${boundary}`, "Content-Type: application/json", "", progressJson(progress),
    `--${boundary}--`, "",
  ].join("\r\n");
  const res = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,version`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

// Gộp 2 bản tiến độ: giữ mọi mục của cả hai, `winner` thắng khi cùng 1 trường của cùng 1 mục
function mergeProgress(base, winner) {
  const items = { ...base.items };
  for (const [id, p] of Object.entries(winner.items)) items[id] = { ...items[id], ...p };
  return { items, solved: { ...base.solved, ...winner.solved } };
}

const sameProgress = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Bản lấy từ Drive: thay bản trên máy mà không tính là thay đổi mới
function applyDriveProgress(progress) {
  if (sameProgress(progress, state.progress)) return;
  state.progress = progress;
  storage.set(KEY_PROGRESS, progress);
  render();
  if (state.openId) refreshDetail();
}

// Mỗi lúc chỉ 1 lượt đồng bộ; yêu cầu đến trong lúc đang chạy thì chạy thêm 1 lượt ngay sau đó
async function syncDrive() {
  clearTimeout(drive.timer);
  drive.timer = null;
  if (!drive.auth) return;
  if (drive.running) {
    drive.again = true;
    return;
  }
  drive.running = true;
  setDriveStatus("syncing");
  try {
    const saved = storage.get(KEY_DRIVE_SYNC, null);
    let file = (saved?.fileId && (await getDriveFile(saved.fileId))) || (await findDriveFile());
    const known = file && file.id === saved?.fileId; // máy này đã từng đồng bộ với đúng file này
    let mustWrite;

    if (file && (!known || file.version !== saved.version)) {
      // Drive có bản khác bản máy đang dựa vào: máy khác vừa ghi, hoặc lần đầu đồng bộ
      const remote = await downloadDriveFile(file.id);
      // Đọc lại cờ pending sau khi tải xong: có thể vừa có thay đổi trong lúc chờ
      const pending = storage.get(KEY_DRIVE_SYNC, null)?.pending;
      const merged = !known ? mergeProgress(state.progress, remote)
        : pending ? mergeProgress(remote, state.progress)
        : remote;
      applyDriveProgress(merged);
      mustWrite = !sameProgress(merged, remote);
    } else {
      mustWrite = !file || Boolean(storage.get(KEY_DRIVE_SYNC, null)?.pending);
    }

    const version = drive.version;
    if (mustWrite) file = await writeDriveFile(file?.id, state.progress);
    // Có thay đổi trong lúc đang ghi thì vẫn còn pending; lượt sau (đã hẹn giờ) sẽ ghi tiếp
    storage.set(KEY_DRIVE_SYNC, { fileId: file.id, version: file.version, pending: drive.version !== version });
    drive.syncedAt = nowIso();
    setDriveStatus("synced");
  } catch (err) {
    if (err instanceof NeedLogin) {
      drive.token = null;
      setDriveStatus("login");
    } else if (err instanceof Offline) {
      setDriveStatus("offline");
    } else {
      setDriveStatus("error", err);
    }
  } finally {
    drive.running = false;
    if (drive.again) {
      drive.again = false;
      syncDrive();
    }
  }
}

function queueDriveSave() {
  if (!drive.auth || drive.status === "login") return; // chờ người dùng bấm "Kết nối Google Drive"
  clearTimeout(drive.timer);
  drive.timer = setTimeout(syncDrive, DRIVE_SAVE_DELAY_MS);
}

function autoSyncDrive() {
  if (drive.auth && drive.status !== "login") syncDrive();
}

async function connectDrive() {
  if (drive.status !== "login") {
    syncDrive();
    return;
  }
  try {
    await drive.auth.login();
  } catch (err) {
    if (!(err instanceof NeedLogin)) setDriveStatus("error", err);
  }
}

function setDriveStatus(status, error = null) {
  drive.status = status;
  drive.error = error;
  if (state.content) renderSyncStatus();
}

function renderSyncStatus() {
  const { status } = drive;
  const el = $("sync-status");
  el.toggleAttribute("data-warn", ["setup", "offline", "error"].includes(status));
  el.dataset.status = status; // màu chấm trạng thái, xem #sync-status trong index.html
  el.textContent =
    status === "synced" ? t("sync.synced", formatTime(drive.syncedAt))
    : status === "error" ? t("sync.error", errorText(drive.error))
    : t(`sync.${status}`);

  const btn = $("btn-drive");
  btn.hidden = !["login", "offline", "error"].includes(status);
  btn.textContent = t(status === "login" ? "sync.connect" : "sync.retry");
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

$("btn-drive").addEventListener("click", connectDrive);

// Quay lại app (vd. vừa học trên máy kia): lấy bản mới từ Drive. Rời app: ghi luôn thay đổi đang chờ
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" || drive.timer) autoSyncDrive();
});
addEventListener("online", autoSyncDrive);

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
  if (action === "copy") copyCode(e.target.closest("[data-templates]"));
  if (action === "review") markReviewed(state.openId);
  if (action === "help") toggleHelp(e.target.closest("[data-url]"));
  if (action === "ask") askAi(actionEl);
});

detail.addEventListener("change", (e) => {
  const { done, solved, check } = e.target.dataset;
  if (done) setDone(done, e.target.checked);
  if (solved) setSolved(solved, e.target.checked);
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
  if (e.key !== "Tab" || e.shiftKey || !e.target.matches('textarea[data-field="code"]')) return;
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
