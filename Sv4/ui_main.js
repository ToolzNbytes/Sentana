
// Main UI orchestration for Sentence Structure Explorer (Sv4).
// Depends on sse_common.js, tag_registry.js, svg_render.js, deconstruct.js.

// Active corpus + list are kept in SSE_STATE and updated on source switches.
let corpusRemote = [];
let corpusLocal = [];

let corpus = corpusRemote;
let lastParsed = null;

const SSE = window.SSE;
const SSE_UTIL = window.SSE_UTIL || {};
const SSE_CONFIG = window.SSE_CONFIG || {};

const LS_KEY_PREFS = SSE?.LS_KEY_PREFS;
const LS_KEY_LOCAL_CORPUS = SSE?.LS_KEY_LOCAL_CORPUS;

const SSE_STATE = window.SSE_STATE || (window.SSE_STATE = {});

function loadPrefsFromStorage(){
  if (!SSE || !LS_KEY_PREFS) return;
  const p = SSE.storageGet(LS_KEY_PREFS, null);
  if (!p || typeof p !== "object") return;

  if (Number.isFinite(p.WORD_CAP) && p.WORD_CAP >= 0) SSE_CONFIG.WORD_CAP = p.WORD_CAP;
  if (Number.isFinite(p.BAR_HEIGHT) && p.BAR_HEIGHT > 0) SSE_CONFIG.BAR_HEIGHT = p.BAR_HEIGHT;
  if (typeof p.RESULT_BG === "string" && p.RESULT_BG.trim().length) SSE_CONFIG.RESULT_BG = p.RESULT_BG.trim();
  if (Number.isFinite(p.DISPLAY_WIDTH) && p.DISPLAY_WIDTH >= 0) SSE_CONFIG.DISPLAY_WIDTH = p.DISPLAY_WIDTH;
}

function savePrefsToStorage(){
  if (!SSE || !LS_KEY_PREFS) return;
  SSE.storageSet(LS_KEY_PREFS, {
    WORD_CAP: SSE_CONFIG.WORD_CAP,
    BAR_HEIGHT: SSE_CONFIG.BAR_HEIGHT,
    RESULT_BG: SSE_CONFIG.RESULT_BG,
    DISPLAY_WIDTH: SSE_CONFIG.DISPLAY_WIDTH
  });
}

/* ===================== Load corpus ===================== */
async function loadRemoteCorpus() {
  const res = await fetch("../gen/texts.meta.json");
  if (!res.ok) throw new Error("Cannot load metadata of the corpus");
  corpusRemote = await res.json();
  corpusRemoteView = corpusRemote;
  corpus = corpusRemoteView;
}

/* ===================== Corpus sources (remote/local) ===================== */
let remoteList, localList;
let corpusRemoteBtn, corpusLocalBtn, corpusFilterBtn, localDataBtn, helpBtn;
let workDetailsContent, filterPanel, corpusFilterSelect;
let activeSource = "remote";

// ===================== Remote corpus filtering: year ranges =====================
const LOW_YEAR = 1850;
const MID_YEAR = 1920;
const HIGH_YEAR = 1980;

// Filter state (remote corpus only)
let remoteFilterValue = "All";
let corpusRemoteView = corpusRemote;
let filterPanelOpen = false;
let remoteMetaLoaded = false;

function getRemoteCorpusView(){
  return Array.isArray(corpusRemoteView) ? corpusRemoteView : corpusRemote;
}

function computeYearNum(yearStr){
  const s = String(yearStr ?? "");
  const m = s.match(/\b(\d{4})\b/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

function parseTagsValue(tagsStr){
  const out = {};
  const parts = String(tagsStr ?? "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  for (const tag of parts){
    out[tag] = true;
  }
  return out;
}

function parseLanguageValue(langStr){
  const t = String(langStr ?? "").trim().toLowerCase();
  if (!t) return { lang: "en", ori: null };
  const m = t.match(/^([a-z]{2})(?:\s*\/\s*([a-z]{2}))?/);
  if (!m) return { lang: "en", ori: null };
  return { lang: m[1], ori: m[2] || null };
}

function normalizeRemoteEntryShallow(entry){
  if (!entry || typeof entry !== "object") return;
  if (typeof entry.year_num !== "number") entry.year_num = computeYearNum(entry.Year);
  if (!entry.Tags || typeof entry.Tags !== "object" || Array.isArray(entry.Tags)) entry.Tags = {};
  if (!entry.Language) entry.Language = "en";
  if (entry.LanguageOri === undefined) entry.LanguageOri = null;
}

function parseMetadataBlock(raw){
  const parts = String(raw || "").split(/^###[^\r\n]*(?:\r?\n|$)/m);
  return (parts[0] || "").trim();
}

function parseMetadataLines(metaText){
  const out = {};
  const lines = String(metaText || "").split(/\r?\n/);
  for (const line of lines){
    const t = line.trim();
    if (!t) continue;
    const idx = t.indexOf(":");
    if (idx <= 0) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function enrichEntryFromMetadata(entry, metaMap){
  if (!entry || typeof entry !== "object") return;

  if (metaMap.Work && !entry.Work) entry.Work = metaMap.Work;
  if (metaMap.Author && !entry.Author) entry.Author = metaMap.Author;
  if (metaMap.Choice && !entry.Choice) entry.Choice = metaMap.Choice;

  if (metaMap.Year) entry.Year = metaMap.Year;
  entry.year_num = computeYearNum(entry.Year);

  if (metaMap.Tags){
    entry.Tags = parseTagsValue(metaMap.Tags);
  } else if (!entry.Tags || typeof entry.Tags !== "object" || Array.isArray(entry.Tags)){
    entry.Tags = {};
  }

  const langRaw = metaMap.Language || metaMap.Lang || entry.Language;
  const { lang, ori } = parseLanguageValue(langRaw);
  entry.Language = lang;
  entry.LanguageOri = ori;

  entry._metaLoaded = true;
}

async function enrichRemoteEntryFromFile(entry){
  if (!entry || entry._metaLoaded) return;
  normalizeRemoteEntryShallow(entry);

  if (!entry.file){
    entry._metaLoaded = true;
    return;
  }

  try{
    const res = await fetch(`../${entry.file}`);
    if (!res.ok) throw new Error(`Cannot load text file: ${entry.file}`);
    const raw = await res.text();
    const metaText = parseMetadataBlock(raw);
    const metaMap = parseMetadataLines(metaText);
    enrichEntryFromMetadata(entry, metaMap);
  } catch(e){
    entry._metaLoaded = true;
  }
}

async function ensureRemoteMetadataLoaded(){
  if (remoteMetaLoaded) return;

  for (const e of corpusRemote) normalizeRemoteEntryShallow(e);

  const limit = 8;
  let cursor = 0;

  async function worker(){
    while (true){
      const i = cursor++;
      if (i >= corpusRemote.length) return;
      const e = corpusRemote[i];
      if (!e || e._metaLoaded) continue;
      await enrichRemoteEntryFromFile(e);
    }
  }

  const workers = [];
  for (let k = 0; k < limit; k++) workers.push(worker());
  await Promise.all(workers);

  remoteMetaLoaded = true;
}

function buildRemoteFilterOptions(){
  return [
    { value: "All", label: "All works" },
    { value: "Classic", label: "Classic works" },
    { value: "LY", label: `Before ${LOW_YEAR}` },
    { value: "M1Y", label: `Years ${LOW_YEAR} - ${MID_YEAR}` },
    { value: "M2Y", label: `Years ${MID_YEAR} - ${HIGH_YEAR}` },
    { value: "HY", label: `After ${HIGH_YEAR}` },
    { value: "LgEn", label: "English" },
    { value: "LgEs", label: "Spanish" },
    { value: "LgFr", label: "French" },
    { value: "LgGe", label: "German" },
    { value: "LgRe", label: "Russian" },
    { value: "Trans", label: "Translations" },
    { value: "ClasPop", label: "Compare Classics and \u2018popular\u2019 works" },
    { value: "Valid", label: "Checked and mostly valid" },
    { value: "ToReview", label: "Need to be reviewed" },
    { value: "Errors", label: "Some corrections to do (errors)" },
    { value: "Ref", label: "As reference for filter features" }
  ];
}

function populateRemoteFilterSelect(){
  if (!corpusFilterSelect) return;
  corpusFilterSelect.innerHTML = "";
  for (const opt of buildRemoteFilterOptions()){
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    corpusFilterSelect.appendChild(o);
  }
  corpusFilterSelect.value = remoteFilterValue || "All";
}

function openFilterPanel(){
  if (activeSource !== "remote") return;
  if (!filterPanel || !workDetailsContent) return;

  filterPanelOpen = true;
  workDetailsContent.classList.add("hidden");
  filterPanel.classList.remove("hidden");
  if (corpusFilterBtn) corpusFilterBtn.classList.add("isActive");

  populateRemoteFilterSelect();

  (async ()=>{
    try{
      corpusFilterSelect.disabled = true;
      const prev = corpusFilterSelect.value || remoteFilterValue;
      corpusFilterSelect.innerHTML = `<option value="${SSE_UTIL.escapeHtml(prev)}">Loading metadata\u2026</option>`;
      await ensureRemoteMetadataLoaded();
      populateRemoteFilterSelect();
      corpusFilterSelect.disabled = false;
      applyRemoteFilter(remoteFilterValue, { preserveSelection: true });
    }catch(e){
      populateRemoteFilterSelect();
      corpusFilterSelect.disabled = false;
    }
  })();
}

function closeFilterPanel(force){
  if (!filterPanel || !workDetailsContent) return;
  if (!filterPanelOpen && !force) return;

  filterPanelOpen = false;
  filterPanel.classList.add("hidden");
  workDetailsContent.classList.remove("hidden");
  if (corpusFilterBtn) corpusFilterBtn.classList.remove("isActive");
}

function toggleFilterPanel(){
  if (activeSource !== "remote") return;
  if (filterPanelOpen) closeFilterPanel(false);
  else openFilterPanel();
}
function filterPredicateForValue(value){
  for (const e of corpusRemote) {
    if (e && typeof e.year_num !== "number") e.year_num = computeYearNum(e.Year);
    if (!e.Tags || typeof e.Tags !== "object" || Array.isArray(e.Tags)) e.Tags = {};
    if (!e.Language) e.Language = "en";
  }

  switch (value){
    case "All": return () => true;
    case "Classic": return (e) => Boolean(e?.Tags?.Classic);
    case "LY": return (e) => (e?.year_num || 0) < LOW_YEAR;
    case "M1Y": return (e) => (e?.year_num || 0) >= LOW_YEAR && (e?.year_num || 0) < MID_YEAR;
    case "M2Y": return (e) => (e?.year_num || 0) >= MID_YEAR && (e?.year_num || 0) < HIGH_YEAR;
    case "HY": return (e) => (e?.year_num || 0) >= HIGH_YEAR;
    case "LgEn": return (e) => (e?.Language || "en") === "en";
    case "LgEs": return (e) => (e?.Language || "en") === "es";
    case "LgFr": return (e) => (e?.Language || "en") === "fr";
    case "LgGe": return (e) => (e?.Language || "en") === "de";
    case "LgRe": return (e) => (e?.Language || "en") === "ru";
    case "Valid": return (e) => Boolean(e?.Tags?.Valid);
    case "ToReview": return (e) => Boolean(e?.Tags?.ToReview);
    case "Errors": return (e) => Boolean(e?.Tags?.Errors);
    case "Ref": return (e) => Boolean(e?.Tags?.Ref);
    case "ClasPop":
      return (e) => (Boolean(e?.Tags?.Classic) && Boolean(e?.Tags?.Ref)) || Boolean(e?.Tags?.Pop);
    default:
      return () => true;
  }
}

function remoteFilterSpecialSet(value){
  if (value !== "Trans") return null;

  const set = new Set();

  for (const e of corpusRemote){
    if (!e) continue;
    if (e.LanguageOri){
      set.add(e);
      for (const cand of corpusRemote){
        if (!cand) continue;
        if (cand.LanguageOri) continue;
        if ((cand.Work || "") === (e.Work || "") && (cand.Author || "") === (e.Author || "")){
          set.add(cand);
        }
      }
    }
  }
  return set;
}

function applyRemoteFilter(value, opts = {}){
  const { preserveSelection = false } = opts;

  remoteFilterValue = value || "All";

  let view;
  const special = remoteFilterSpecialSet(remoteFilterValue);
  if (special){
    view = corpusRemote.filter(e => special.has(e));
  } else {
    const pred = filterPredicateForValue(remoteFilterValue);
    view = corpusRemote.filter(pred);
  }

  corpusRemoteView = (remoteFilterValue === "All") ? corpusRemote : view;

  if (activeSource === "remote"){
    const prevEntry = preserveSelection ? corpus[Number(list?.value)] : null;

    corpus = getRemoteCorpusView();
    list = remoteList;
    SSE_STATE.corpus = corpus;
    SSE_STATE.list = list;

    populateList(remoteList, corpus);

    if (corpus.length === 0){
      setStoreEnabled(false);
      setResultPanelLoadingMsg("No entries match the current filter.");
      if (work) work.textContent = "";
      if (author) author.textContent = "";
      if (choice) choice.textContent = "";
      if (commentBox) commentBox.textContent = "";
      window.SSE_SVG.clearHoveringDisplay();
      setDeconstructMode(false);
      updateCollapseEnabled();
      return;
    }

    if (prevEntry){
      const idx = corpus.indexOf(prevEntry);
      if (idx >= 0) remoteList.selectedIndex = idx;
      else remoteList.selectedIndex = 0;
    } else if (remoteList.selectedIndex < 0){
      remoteList.selectedIndex = 0;
    }

    show(Number(remoteList.value));
  }
}

function wireDom(){
  remoteList = document.getElementById("workListRemote");
  localList = document.getElementById("workListLocal");
  corpusRemoteBtn = document.getElementById("corpusRemoteBtn");
  corpusLocalBtn = document.getElementById("corpusLocalBtn");
  corpusFilterBtn = document.getElementById("corpusFilterBtn");
  localDataBtn = document.getElementById("localDataBtn");
  helpBtn = document.getElementById("helpBtn");

  workDetailsContent = document.getElementById("workDetailsContent");
  filterPanel = document.getElementById("filterPanel");
  corpusFilterSelect = document.getElementById("corpusFilterSelect");
}
function updateFilterBtnDecoration(){
  const v = (corpusFilterSelect.value || "All");
  corpusFilterBtn.classList.toggle("hasFilter", v !== "All");
}
function setActiveSource(source, opts = {}){
  const {
    skipPopulate = false,
    skipShow = false,
    idx = null,
    random = true
  } = opts;

  activeSource = source;
  const isRemote = (source === "remote");

  corpus = isRemote ? getRemoteCorpusView() : corpusLocal;
  list = isRemote ? remoteList : localList;
  SSE_STATE.corpus = corpus;
  SSE_STATE.list = list;

  if (remoteList && localList){
    remoteList.classList.toggle("hidden", !isRemote);
    localList.classList.toggle("hidden", isRemote);
  }

  if (corpusRemoteBtn && corpusLocalBtn){
    corpusRemoteBtn.disabled = isRemote;
    corpusLocalBtn.disabled = !isRemote;
  }
  if (corpusFilterBtn){
    corpusFilterBtn.disabled = !isRemote;
    if (!isRemote) closeFilterPanel(true);
  }
  if (!skipPopulate){
    populateList(list, corpus);
  }
  updateFilterBtnDecoration();

  if (skipShow) return;

  if (!Array.isArray(corpus) || corpus.length === 0){
    setStoreEnabled(false);
    setResultPanelLoadingMsg("No entries in corpus.");
    if (work) work.textContent = "";
    if (author) author.textContent = "";
    if (choice) choice.textContent = "";
    if (commentBox) commentBox.textContent = "";
    window.SSE_SVG.clearHoveringDisplay();
    setDeconstructMode(false);
    updateCollapseEnabled();
    return;
  }

  if (idx !== null && Number.isFinite(idx) && corpus[idx]){
    list.value = String(idx);
  } else if (list.selectedIndex >= 0){
    // keep current selection
  } else if (random){
    list.selectedIndex = Math.floor(Math.random() * corpus.length);
  } else {
    list.selectedIndex = 0;
  }

  show(Number(list.value));
}

async function ensureLocalCorpusLoaded(){
  const saved = SSE.storageGet(LS_KEY_LOCAL_CORPUS, null);
  if (!Array.isArray(saved) || saved.length === 0) return false;
  corpusLocal = saved;
  SSE_STATE.corpusLocal = corpusLocal;
  return true;
}

async function activateLocalCorpus(){
  const ok = await ensureLocalCorpusLoaded();
  if (!ok){
    alert("Empty local corpus, opening local data page.");
    window.location.href = "local_corpus.html";
    return;
  }
  populateList(localList, corpusLocal);
  setActiveSource("local", { skipPopulate: true });
}

function activateRemoteCorpus(){
  applyRemoteFilter(remoteFilterValue, { preserveSelection: true });
  setActiveSource("remote", { skipPopulate: true });
}

/* ===================== INIT ===================== */
async function init() {
  loadPrefsFromStorage();
  wireDom();

  try {
    await loadRemoteCorpus();
    corpusRemote.forEach(normalizeRemoteEntryShallow);
    corpusRemoteView = corpusRemote;
  } catch (e) {
    alert(e.message);
    return;
  }

  setActiveSource("remote", { skipPopulate: true, skipShow: true });
  populateList(remoteList, getRemoteCorpusView());
  applyWorkspaceWidth();

  if (getRemoteCorpusView().length) {
    remoteList.selectedIndex = Math.floor(Math.random() * getRemoteCorpusView().length);
    show(Number(remoteList.value));
  }
}

function populateList(listEl, corpusData) {
  if (!listEl) return;
  listEl.innerHTML = "";

  function buildListTitle(entry){
    const base = entry?.Work || "";
    const prefix = entry?.isDeconstruction ? "\u00a7 " : "";
    let title = base;
    const marker = SSE_UTIL.getChoiceMarkerFromValue(entry?.Choice);
    if (marker) title = `${title} -${marker}`;
    let lang = "";
    if (entry?.LanguageOri){
      lang = String(entry.Language || "").trim();
    } else {
      const rawLang = String(entry?.Language || "").trim().toLowerCase();
      const m = rawLang.match(/^([a-z]{2})\s*\/\s*[a-z]{2}$/);
      if (m) lang = m[1];
    }
    if (lang) title = `${title}~${lang}`;
    return `${prefix}${title}`;
  }

  const workCounts = new Map();

  (corpusData || []).forEach((c, i) => {
    const base = buildListTitle(c);
    const n = (workCounts.get(base) || 0) + 1;
    workCounts.set(base, n);
    const o = document.createElement("option");
    o.value = i;
    const title = n === 1 ? base : `${base} (${n})`;
    o.textContent = `${title} \u2014 ${c.Author}`;
    listEl.appendChild(o);
  });
}

async function loadAnalyzedText(file) {
  const res = await fetch(`../${file}`);
  if (!res.ok) throw new Error(`Cannot load text file: ${file}`);

  const raw = await res.text();
  const parts = raw.split(/^###[^\r\n]*(?:\r?\n|$)/m);

  if (parts.length < 2) {
    throw new Error(`Missing ### marker in ${file}`);
  }
  return parts[1].trim();
}
/* ===================== Store / Collapse management ===================== */
const workspaces = document.getElementById("workspaces");
const workspace = document.getElementById("workspace");
const workspaceWrap = document.getElementById("workspaceWrap");
const collapseBtn = document.getElementById("collapseBtn");
const storeBtn = document.getElementById("storeBtn");

let isCollapsed = false;

function copyCount(){
  return workspaces.querySelectorAll(".copyR").length;
}
function updateCollapseEnabled(){
  const n = copyCount();
  collapseBtn.disabled = (n === 0);

  if (n === 0 && isCollapsed){
    uncollapseWorkspace(true);
    return;
  }
  setCollapseIcon();
}
function collapseWorkspace(){
  if (isCollapsed) return;
  isCollapsed = true;
  setCollapseIcon();

  workspaceWrap.classList.add("collapsingOut");
  setTimeout(()=>{
    workspaceWrap.classList.add("hidden");
    workspaceWrap.classList.remove("collapsingOut");
  }, 230);
}
function uncollapseWorkspace(forced){
  if (!isCollapsed && !forced) return;
  isCollapsed = false;
  setCollapseIcon();

  workspaceWrap.classList.remove("hidden");
  workspaceWrap.classList.add("collapsingOut");
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      workspaceWrap.classList.remove("collapsingOut");
      workspaceWrap.style.opacity = "1";
      workspaceWrap.style.transform = "translateX(0)";
    });
  });
}
collapseBtn.addEventListener("click", ()=>{
  if (collapseBtn.disabled) return;
  if (!isCollapsed) collapseWorkspace();
  else uncollapseWorkspace(false);
});

/* ===================== UI wiring ===================== */
wireDom();
let list = remoteList;

const work = document.querySelector(".work");
const author = document.querySelector(".author");
const choice = document.querySelector(".choice");
const commentBox = document.getElementById("commentArea");
const deconstructStatus = document.getElementById("deconstructStatus");
const deconstructPanel = document.getElementById("deconstructPanel");
let showingDeconstructSentence = false;

SSE_STATE.commentBox = commentBox;
SSE_STATE.deconstructStatus = deconstructStatus;
SSE_STATE.showingDeconstructSentence = showingDeconstructSentence;

function setCollapseIcon(){
  const useEl = collapseBtn.querySelector("use");
  if (!useEl) return;

  const target = isCollapsed
    ? "../icons/panel_restore.svg#icon"
    : "../icons/panel_hide.svg#icon";

  useEl.setAttribute("href", target);
  useEl.setAttribute("xlink:href", target);
}

function hasError(){
  return commentBox.classList.contains("error");
}

function setDeconstructMode(enabled){
  const on = Boolean(enabled);
  workspace.classList.toggle("deconstruct-mode", on);
  document.body.classList.toggle("deconstruct-mode", on);
}

function applyWorkspaceWidth(){
  if (SSE_CONFIG.DISPLAY_WIDTH && SSE_CONFIG.DISPLAY_WIDTH > 0){
    workspace.style.width = SSE_CONFIG.DISPLAY_WIDTH + "px";
    workspace.style.flex = "0 0 auto";
    workspaceWrap.style.flex = "0 0 auto";

  } else {
    workspace.style.width = "100%";
    workspace.style.flex = "1 1 0";
    workspaceWrap.style.flex = "1 1 0";
  }
}

function setStoreEnabled(enabled){
  storeBtn.disabled = !enabled;
}

function setResultPanelLoadingMsg(msg = "Loading..."){
  const panel = document.getElementById("resultPanel");
  if (!panel) return;
  panel.innerHTML = `<div class="loading">${SSE_UTIL.escapeHtml(msg)}</div>`;
}

async function show(idx) {
  setStoreEnabled(false);

  if (!corpus.length || !corpus[idx]) {
    console.error("show() called before corpus ready", {
      idx,
      corpusLength: corpus.length
    });
    return;
  }

  const c = corpus[idx];
  const isDeconstructEntry = activeSource === "local" && Boolean(c?.isDeconstruction);
  setDeconstructMode(isDeconstructEntry);

  if (activeSource === "remote" && c && !c._metaLoaded) {
    await enrichRemoteEntryFromFile(c);
  }

  setResultPanelLoadingMsg();
  work.textContent = (c.Year || c.Year === 0) ? `${c.Work} (${c.Year})` : `${c.Work}`;
  author.textContent = `by ${c.Author}`;
  choice.textContent = c.Choice ? `(${c.Choice})` : "";

  commentBox.classList.remove("error");
  commentBox.textContent = c.Comment || "";

  window.SSE_SVG.clearHoveringDisplay();
  if (!c.AnalyzedText) {
    try {
      if (!c.file) throw new Error("Missing 'file' property for selected record.");
      c.AnalyzedText = await loadAnalyzedText(c.file);
    } catch (e) {
      console.error(e);
      commentBox.textContent = e.message;
      commentBox.classList.add("error");
      setResultPanelLoadingMsg("No analysis (load error). ");
      return;
    }
  }
  lastParsed = SSE.parseAnalyzedText(c.AnalyzedText, (msg) => {
    commentBox.textContent = msg;
    commentBox.classList.add("error");
  });

  window.SSE_SVG.renderSVGs(lastParsed);
  if (isDeconstructEntry) window.SSE_DECON.renderDynResult(lastParsed);

  if (!hasError()) setStoreEnabled(true);

  updateCollapseEnabled();
}

if (remoteList){
  remoteList.addEventListener("change", (e)=>{
    if (activeSource !== "remote") {
      setActiveSource("remote", { skipPopulate: true, skipShow: true });
    }
    list = remoteList;
    corpus = getRemoteCorpusView();
    SSE_STATE.corpus = corpus;
    SSE_STATE.list = list;
    show(Number(e.target.value));
  });
}
if (localList){
  localList.addEventListener("change", (e)=>{
    if (activeSource !== "local") {
      setActiveSource("local", { skipPopulate: true, skipShow: true });
    }
    list = localList;
    corpus = corpusLocal;
    SSE_STATE.corpus = corpus;
    SSE_STATE.list = list;
    show(Number(e.target.value));
  });
}

/* ===================== Corpus switching buttons ===================== */
if (corpusRemoteBtn){
  corpusRemoteBtn.addEventListener("click", ()=>{
    activateRemoteCorpus();
  });
}
if (corpusLocalBtn){
  corpusLocalBtn.addEventListener("click", ()=>{
    activateLocalCorpus();
  });
}
if (corpusFilterBtn){
  corpusFilterBtn.addEventListener("click", ()=>{
    if (corpusFilterBtn.disabled) return;
    toggleFilterPanel();
  });
}
if (corpusFilterSelect){
  corpusFilterSelect.addEventListener("change", (e)=>{
    remoteFilterValue = e.target.value || "All";
    applyRemoteFilter(remoteFilterValue, { preserveSelection: true });
    updateFilterBtnDecoration();
  });
}
if (localDataBtn){
  localDataBtn.addEventListener("click", ()=>{
    window.location.href = "local_corpus.html";
  });
}
if (helpBtn){
  helpBtn.addEventListener("click", ()=>{
    window.location.href = "help_v4.html";
  });
}

const deconstructResetBtn = document.getElementById("deconstructResetBtn");
const deconstructCollapseBtn = document.getElementById("deconstructCollapseBtn");
const deconstructKeepDCBtn = document.getElementById("deconstructKeepDCBtn");
const deconstructCopyBtn = document.getElementById("deconstructCopyBtn");
if (deconstructResetBtn){
  deconstructResetBtn.addEventListener("click", ()=>{
    window.SSE_DECON.resetDynTrees();
  });
}
if (deconstructCollapseBtn){
  deconstructCollapseBtn.addEventListener("click", ()=>{
    window.SSE_DECON.collapseDynTrees();
  });
}
if (deconstructKeepDCBtn){
  deconstructKeepDCBtn.addEventListener("click", ()=>{
    for (const root of window.SSE_STATE?.dynTreeList || []){
      window.SSE_DECON.keepOnlyDCs(root);
    }
    window.SSE_DECON.updateDynAfterChange();
  });
}
if (deconstructCopyBtn){
  deconstructCopyBtn.addEventListener("click", async ()=>{
    const text = window.SSE_DECON.buildDeconstructSentence();
    await SSE_UTIL.copyToClipboard(text);
  });
}

if (deconstructPanel){
  deconstructPanel.addEventListener("mouseenter", ()=>{
    showingDeconstructSentence = true;
    SSE_STATE.showingDeconstructSentence = true;
    window.SSE_DECON.updateDynAfterChange();
  });
  deconstructPanel.addEventListener("mouseleave", ()=>{
    showingDeconstructSentence = false;
    SSE_STATE.showingDeconstructSentence = false;
    window.SSE_SVG.clearHoveringDisplay();
  });
}
/* ===================== Store feature (+>) ===================== */

function computeCopyRWidth(){
  if (SSE_CONFIG.DISPLAY_WIDTH && SSE_CONFIG.DISPLAY_WIDTH > 0) {
    return SSE_CONFIG.DISPLAY_WIDTH;
  }
  const firstCopy = workspaces.querySelector(".copyR");
  if (firstCopy) {
    return firstCopy.getBoundingClientRect().width;
  }
  const resultPanel = document.getElementById("resultPanel");
  const rpWidth = resultPanel.getBoundingClientRect().width;
  return Math.max(520, (rpWidth - 12) / 2);
}

storeBtn.addEventListener("click", ()=>{
  if (storeBtn.disabled) return;
  if (hasError()) return;

  const idx = Number(list.value);
  const c = corpus[idx];

  const w = computeCopyRWidth();
  const resultPanel = document.getElementById("resultPanel");

  const copy = document.createElement("section");
  copy.className = "copyR";
  copy.style.width = w + "px";

  const info = document.createElement("div");
  info.className = "infoR";

  const xBtn = document.createElement("button");
  xBtn.className = "xDel";
  xBtn.textContent = "\u00d7";

  const line1 = document.createElement("div");
  line1.className = "line1";
  line1.innerHTML = `<em>${SSE_UTIL.escapeHtml(c.Work)}</em> \u2014 by ${SSE_UTIL.escapeHtml(c.Author)}`;

  const line2 = document.createElement("div");
  line2.className = "line2";
  line2.textContent = c.Choice ? `(${c.Choice})` : "";

  info.appendChild(xBtn);
  info.appendChild(line1);
  info.appendChild(line2);

  const main = document.createElement("div");
  main.className = "mainR";
  main.style.background = SSE_CONFIG.RESULT_BG;

  const cloned = resultPanel.cloneNode(true);
  cloned.removeAttribute("id");
  while (cloned.firstChild){
    main.appendChild(cloned.firstChild);
  }

  copy.appendChild(info);
  copy.appendChild(main);

  const existing = workspaces.querySelector(".copyR");
  if (existing){
    workspaces.insertBefore(copy, existing);
  } else {
    workspaces.appendChild(copy);
  }

  xBtn.addEventListener("click", ()=>{
    copy.remove();
    updateCollapseEnabled();
  });

  updateCollapseEnabled();
});

/* ===================== Excerpt source panel ===================== */
const excerptSourcePnl = document.getElementById("excerptSourcePnl");
const excerptSourceContent = document.getElementById("excerptSourceContent");
const toggleView = document.getElementById("toggleView");
const excerptSourceClose = document.getElementById("excerptSourceClose");
const cloneLocalBtn = document.getElementById("cloneLocalBtn");
const copyClipboardBtn = document.getElementById("copyClipboardBtn");
const excerptSourceBtn = document.getElementById("excerptSourceBtn");

let showingExcerpt = false;

function isRemoteCorpusActive(){ return activeSource === "remote"; }

function shouldShowCloneBtn(){
  return isRemoteCorpusActive() && !showingExcerpt;
}

function updateCloneBtnVisibility(){
  cloneLocalBtn.classList.toggle("hidden", !shouldShowCloneBtn());
}

function buildExcerpt(parsed){
  const paras = [];
  let current = [];

  for (const entry of parsed || []) {
    const s = entry.sentence || "";

    if (s.startsWith(" ")) {
      if (current.length) {
        paras.push(current.join(" "));
        current = [];
      }
      current.push(s.trim());
    } else {
      current.push(s.trim());
    }
  }

  if (current.length) {
    paras.push(current.join(" "));
  }

  return paras;
}

function setExcerptView(showOriginal){
  showingExcerpt = Boolean(showOriginal);

  if (showingExcerpt){
    const paras = buildExcerpt(lastParsed);
    excerptSourceContent.innerHTML = "";
    excerptSourceContent.className = "modal-content serif";
    for (const p of paras) {
      const el = document.createElement("p");
      el.textContent = p;
      excerptSourceContent.appendChild(el);
    }
    toggleView.textContent = "Switch to structural analysis";
  } else {
    excerptSourceContent.textContent = corpus[Number(list.value)].AnalyzedText;
    excerptSourceContent.className = "modal-content mono";
    toggleView.textContent = "Switch to original excerpt";
  }
  updateCloneBtnVisibility();
}

function normalizeSentenceForSearch(s){
  return String(s || "").trimStart();
}

function selectSentenceInExcerpt(sentenceText){
  const needle = normalizeSentenceForSearch(sentenceText);
  if (!needle) return false;

  const paras = excerptSourceContent.querySelectorAll("p");
  for (const p of paras){
    const text = p.textContent || "";
    const idx = text.indexOf(needle);
    if (idx >= 0){
      const node = p.firstChild;
      if (node && node.nodeType === Node.TEXT_NODE){
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + needle.length);
        const sel = window.getSelection();
        if (sel){
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      p.scrollIntoView({ block: "center", behavior: "smooth" });
      return true;
    }
  }
  return false;
}

function selectSentenceInAnalysis(sentenceText){
  const needle = normalizeSentenceForSearch(sentenceText);
  if (!needle) return false;

  const text = excerptSourceContent.textContent || "";
  const idx = text.indexOf(needle);
  if (idx < 0) return false;

  const node = excerptSourceContent.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;

  const range = document.createRange();
  range.setStart(node, idx);
  range.setEnd(node, idx + needle.length);
  const sel = window.getSelection();
  if (sel){
    sel.removeAllRanges();
    sel.addRange(range);
  }
  const rects = range.getClientRects();
  if (rects.length){
    const containerRect = excerptSourceContent.getBoundingClientRect();
    const delta = rects[0].top - containerRect.top;
    excerptSourceContent.scrollTop += delta - (excerptSourceContent.clientHeight * 0.33);
  }
  return true;
}

function openSourcePanelAtSentence(sentenceText){
  excerptSourcePnl.style.display = "flex";
  setExcerptView(true);
  selectSentenceInExcerpt(sentenceText);
}

function openStructurePanelAtSentence(sentenceText){
  excerptSourcePnl.style.display = "flex";
  setExcerptView(false);
  selectSentenceInAnalysis(sentenceText);
}

excerptSourceBtn.addEventListener("click", ()=>{
  setExcerptView(false);
  excerptSourcePnl.style.display = "flex";
});

toggleView.addEventListener("click", ()=>{
  setExcerptView(!showingExcerpt);
});

function getExcerptSourceText(){
  const el = document.getElementById("excerptSourceContent");
  if (!el) return "";
  const text = (typeof el.value === "string") ? el.value : el.innerText;
  return (text || "").replace(/\r\n/g, "\n");
}

copyClipboardBtn.addEventListener("click", async () => {
  try{
    await SSE_UTIL.copyToClipboard(getExcerptSourceText());
  }catch(e){
    alert("Copy failed.");
  }
});

excerptSourceClose.addEventListener("click", ()=>excerptSourcePnl.style.display = "none");
excerptSourcePnl.addEventListener("click", (e)=>{ if (e.target === excerptSourcePnl) excerptSourcePnl.style.display = "none"; });

/* ==== clone to local storage ==== */

function readLocalCorpus(){
  try{
    const raw = localStorage.getItem(LS_KEY_LOCAL_CORPUS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    return [];
  }
}

function writeLocalCorpus(arr){
  if (SSE && LS_KEY_LOCAL_CORPUS) {
    SSE.storageSet(LS_KEY_LOCAL_CORPUS, arr);
    return;
  }
  try {
    localStorage.setItem(LS_KEY_LOCAL_CORPUS, JSON.stringify(arr));
  } catch(e){
    console.warn("LocalStorage write failed", e);
  }
}

window.SSE_STORAGE = {
  readLocalCorpus,
  writeLocalCorpus
};

function cloneCurrentRemoteEntryToLocal(){
  const idx = Number(list.value);
  const src = corpus[idx];
  if (!src) return;

  const lang = src.LanguageOri
    ? `${src.Language || ""}/${src.LanguageOri}`
    : (src.Language || "");
  const tags = (src.Tags && typeof src.Tags === "object" && !Array.isArray(src.Tags))
    ? Object.keys(src.Tags).filter((k) => src.Tags[k])
    : (typeof src.Tags === "string"
      ? src.Tags.split(",").map((t) => t.trim()).filter(Boolean)
      : (src.Tags ? [String(src.Tags)] : []));

  const entry = {
    Work: src.Work || "",
    Author: src.Author || "",
    Year: src.Year || "",
    Choice: src.Choice || "",
    Language: lang,
    Tags: tags.join(","),
    Comment: src.Comment || "",
    AnalyzedText: src.AnalyzedText || ""
  };

  const local = readLocalCorpus();
  local.push(entry);
  writeLocalCorpus(local);

  alert("Saved to local corpus.");
}

cloneLocalBtn.addEventListener("click", ()=>{
  cloneCurrentRemoteEntryToLocal();
});

/* ===================== Parameter modal ===================== */
const settingsBtn = document.getElementById("settingsBtn");
const paramModal = document.getElementById("paramModal");
const closeParam = document.getElementById("closeParam");
const pCancel = document.getElementById("pCancel");
const pApply = document.getElementById("pApply");

const pWordCap = document.getElementById("pWordCap");
const pBarHeight = document.getElementById("pBarHeight");
const pBgColor = document.getElementById("pBgColor");
const pDisplayWidth = document.getElementById("pDisplayWidth");

function openParamModal(){
  pWordCap.value = SSE_CONFIG.WORD_CAP;
  pBarHeight.value = SSE_CONFIG.BAR_HEIGHT;
  pBgColor.value = SSE_CONFIG.RESULT_BG;
  pDisplayWidth.value = SSE_CONFIG.DISPLAY_WIDTH;
  paramModal.style.display = "flex";
}
function closeParamModal(){
  paramModal.style.display = "none";
}

settingsBtn.addEventListener("click", openParamModal);
closeParam.addEventListener("click", closeParamModal);
pCancel.addEventListener("click", closeParamModal);
paramModal.addEventListener("click", (e)=>{ if (e.target === paramModal) closeParamModal(); });

pApply.addEventListener("click", ()=>{
  const wc = Number(pWordCap.value);
  const bh = Number(pBarHeight.value);
  const bg = String(pBgColor.value || "").trim();
  const dw = Number(pDisplayWidth.value);

  SSE_CONFIG.WORD_CAP = Number.isFinite(wc) && wc >= 0 ? wc : 50;
  SSE_CONFIG.BAR_HEIGHT = Number.isFinite(bh) && bh > 0 ? bh : 45;
  SSE_CONFIG.RESULT_BG = bg.length ? bg : getComputedStyle(document.documentElement).getPropertyValue("--panel").trim();
  SSE_CONFIG.DISPLAY_WIDTH = Number.isFinite(dw) && dw >= 0 ? dw : 0;

  applyWorkspaceWidth();
  closeParamModal();
  savePrefsToStorage();
  show(Number(list.value));
});

function setLocalCorpus(next){
  if (Array.isArray(next)) {
    corpusLocal = next;
    SSE_STATE.corpusLocal = next;
  }
}

window.SSE_UI = {
  openSourcePanelAtSentence,
  openStructurePanelAtSentence,
  setActiveSource,
  setLocalCorpus
};

document.addEventListener("DOMContentLoaded", init);
