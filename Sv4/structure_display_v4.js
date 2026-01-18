// Active corpus + list are kept in the legacy globals `corpus` and `list`.
// They are reassigned when switching between remote and local corpora.
let corpusRemote = [];
let corpusLocal = [];

let corpus = corpusRemote; // active corpus (remote by default)
let lastParsed = null;

/* ===================== Default values ===================== */
let WORD_CAP = 50;
let BAR_HEIGHT = 45;
let RESULT_BG = getComputedStyle(document.documentElement)
  .getPropertyValue('--panel').trim();
let DISPLAY_WIDTH = 0;


/* ===================== Shared utilities (storage + parsing) ===================== */
const SSE = window.SSE;
const LS_KEY_PREFS = SSE?.LS_KEY_PREFS;
const LS_KEY_LOCAL_CORPUS = SSE?.LS_KEY_LOCAL_CORPUS;


function loadPrefsFromStorage(){
  if (!SSE || !LS_KEY_PREFS) return;
  const p = SSE.storageGet(LS_KEY_PREFS, null);
  if (!p || typeof p !== "object") return;

  if (Number.isFinite(p.WORD_CAP) && p.WORD_CAP >= 0) WORD_CAP = p.WORD_CAP;
  if (Number.isFinite(p.BAR_HEIGHT) && p.BAR_HEIGHT > 0) BAR_HEIGHT = p.BAR_HEIGHT;
  if (typeof p.RESULT_BG === "string" && p.RESULT_BG.trim().length) RESULT_BG = p.RESULT_BG.trim();
  if (Number.isFinite(p.DISPLAY_WIDTH) && p.DISPLAY_WIDTH >= 0) DISPLAY_WIDTH = p.DISPLAY_WIDTH;
}

function savePrefsToStorage(){
  if (!SSE || !LS_KEY_PREFS) return;
  SSE.storageSet(LS_KEY_PREFS, { WORD_CAP, BAR_HEIGHT, RESULT_BG, DISPLAY_WIDTH });
}

/* SVG hovering tips */
/* ===================== Default tag comments ===================== */
const DEFAULT_TAG_COMMENTS = {
  IC:  "independent clause",
  DC:  "dependent clause",
  DCf: "dependent clause before the subject of the referenced clause",
  PP:  "participial phrase or similar, optional",
  PPf: "participial phrase or similar, optional, before the refered subject",
  AP:  "other adjunct phrase, optional",
  CP:  "compound predicate or coordinated parallel constituent",
  FG:  "fragment"
};


/* ===================== Load corpus ===================== */
async function loadRemoteCorpus() {
  const res = await fetch("../gen/texts.meta.json");
  if (!res.ok) throw new Error("Cannot load metadata of the corpus");
  corpusRemote = await res.json();
  // default view (no filtering) on fresh load
  corpusRemoteView = corpusRemote;
  corpus = corpusRemoteView;
}


/* ===================== Corpus sources (remote/local) ===================== */
let remoteList, localList;
let corpusRemoteBtn, corpusLocalBtn, corpusFilterBtn, localDataBtn, helpBtn;
let workDetailsContent, filterPanel, corpusFilterSelect;
let activeSource = "remote";

// ===================== Remote corpus filtering state =====================
const LOW_YEAR = 1850;
const MID_YEAR = 1920;
const HIGH_YEAR = 1980;

// Filter state (remote corpus only)
let remoteFilterValue = "All";
let corpusRemoteView = corpusRemote;   // current filtered view
let filterPanelOpen = false;
let remoteMetaLoaded = false;

function getRemoteCorpusView(){
  return Array.isArray(corpusRemoteView) ? corpusRemoteView : corpusRemote;
}

// Helpers required by remote-metadata enrichment
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
  // Ensure these properties exist to avoid filter errors before full metadata enrichment.
  if (typeof entry.year_num !== "number") entry.year_num = computeYearNum(entry.Year);
  if (!entry.Tags || typeof entry.Tags !== "object" || Array.isArray(entry.Tags)) entry.Tags = {};
  if (!entry.Language) entry.Language = "en";
  if (entry.LanguageOri === undefined) entry.LanguageOri = null;
}

/* ===================== Remote corpus filter: metadata loading ===================== */

function parseMetadataBlock(raw){
  // part before the first ### line
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

  // Prefer explicit values from file metadata if present
  if (metaMap.Work && !entry.Work) entry.Work = metaMap.Work;
  if (metaMap.Author && !entry.Author) entry.Author = metaMap.Author;
  if (metaMap.Choice && !entry.Choice) entry.Choice = metaMap.Choice;

  if (metaMap.Year) entry.Year = metaMap.Year;
  entry.year_num = computeYearNum(entry.Year);

  // Tags
  if (metaMap.Tags){
    entry.Tags = parseTagsValue(metaMap.Tags);
  } else if (!entry.Tags || typeof entry.Tags !== "object" || Array.isArray(entry.Tags)){
    entry.Tags = {};
  }

  // Language
  const langRaw = metaMap.Language || metaMap.Lang || entry.Language;
  const { lang, ori } = parseLanguageValue(langRaw);
  entry.Language = lang;
  entry.LanguageOri = ori;

  entry._metaLoaded = true;
}

async function enrichRemoteEntryFromFile(entry){
  if (!entry || entry._metaLoaded) return;

  // Make sure shallow defaults exist even if fetch fails
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
    // Keep defaults; mark as loaded to avoid repeated failures.
    entry._metaLoaded = true;
  }
}

async function ensureRemoteMetadataLoaded(){
  if (remoteMetaLoaded) return;

  // Shallow init for all entries (year_num + default tags/lang)
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

/* ===================== Remote corpus filter: UI + logic ===================== */

function buildRemoteFilterOptions(){
  // value → label
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
    { value: "ClasPop", label: "Compare Classics and ‘popular’ works" },
    { value: "Valid", label: "Checked and mostly valid" },
    { value: "ToReview", label: "Need to be reviewed" },
    { value: "Errors", label: "Some corrections to do (errors)" },
    { value: "Ref", label: "As reference for filter features" },
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

  // Always show the list immediately
  populateRemoteFilterSelect();

  // Load metadata (one time) so filters work as intended
  (async ()=>{
    try{
      corpusFilterSelect.disabled = true;
      const prev = corpusFilterSelect.value || remoteFilterValue;
      corpusFilterSelect.innerHTML = `<option value="${escapeHtml(prev)}">Loading metadata…</option>`;
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
  // Ensure year_num exists even without file metadata
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
  // Special filters that need cross-entry logic:
  // - Trans (include translations + also origin where possible)
  if (value !== "Trans") return null;

  const set = new Set();

  for (const e of corpusRemote){
    if (!e) continue;
    if (e.LanguageOri){
      set.add(e);
      // include original if found (same Work + Author, no LanguageOri)
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

  // Build view
  let view;
  const special = remoteFilterSpecialSet(remoteFilterValue);
  if (special){
    view = corpusRemote.filter(e => special.has(e));
  } else {
    const pred = filterPredicateForValue(remoteFilterValue);
    view = corpusRemote.filter(pred);
  }

  corpusRemoteView = (remoteFilterValue === "All") ? corpusRemote : view;

  // If remote list is active, repopulate immediately
  if (activeSource === "remote"){
    const prevEntry = preserveSelection ? corpus[Number(list?.value)] : null;

    corpus = getRemoteCorpusView();
    list = remoteList;

    populateList(remoteList, corpus);

    if (corpus.length === 0){
      setStoreEnabled(false);
      setResultPanelLoadingMsg("No entries match the current filter.");
      if (work) work.textContent = "";
      if (author) author.textContent = "";
      if (choice) choice.textContent = "";
      if (commentBox) commentBox.textContent = "";
      clearHighlightedSentence();
      updateCollapseEnabled();
      return;
    }

    // try to preserve selection by identity
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

  // toggle visible list
  if (remoteList && localList){
    remoteList.classList.toggle("hidden", !isRemote);
    localList.classList.toggle("hidden", isRemote);
  }

  // toggle button enabled state
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
    clearHighlightedSentence();
    updateCollapseEnabled();
    return;
  }

  if (idx !== null && Number.isFinite(idx) && corpus[idx]){
    list.value = String(idx);
  } else if (list.selectedIndex >= 0){
    // keep current selection of this list
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
  // re-apply current remote filter when coming back
  applyRemoteFilter(remoteFilterValue, { preserveSelection: true });
  setActiveSource("remote", { skipPopulate: true });
}

/* ===================== INIT ===================== */
async function init() {
  // restore user preferences first (if any)
  loadPrefsFromStorage();

  // DOM references (lists + buttons)
  wireDom();

  try {
    await loadRemoteCorpus();
    // defaults + initial view
    corpusRemote.forEach(normalizeRemoteEntryShallow);
    corpusRemoteView = corpusRemote;
  } catch (e) {
    alert(e.message);
    return;
  }

  // Remote is the default active source
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

  // count occurrences per work title
  const workCounts = new Map();

  (corpusData || []).forEach((c, i) => {
    const base = c.Work;

    const n = (workCounts.get(base) || 0) + 1;
    workCounts.set(base, n);

    const o = document.createElement("option");
    o.value = i;

    // first occurrence: plain title
    // subsequent ones: "Title (n)"
    const title = n === 1 ? base : `${base} (${n})`;

    o.textContent = `${title} — ${c.Author}`;
    listEl.appendChild(o);
  });
}


async function loadAnalyzedText(file) {
  const res = await fetch(`../${file}`);
  if (!res.ok) throw new Error(`Cannot load text file: ${file}`);

  const raw = await res.text();

  // separator = line starting with ### (line is consummed)
  const parts = raw.split(/^###[^\r\n]*(?:\r?\n|$)/m);

  if (parts.length < 2) {
    throw new Error(`Missing ### marker in ${file}`);
  }
  // parts[0] = metadata, parts[1] = analyzed text, parts[2] = original (optionnal, ignored)
  return parts[1].trim();
}


/* ===================== SVG rendering (percent widths; no viewBox scaling) ===================== */
const IC_SHADES = ["#89CFF1","#6EB1D6","#5293BB","#3776A1","#1B5886","#003A6B"];
const DC_BROWN  = ["#f2d6a6","#f0c493","#e59f7d","#d47557","#b75f4b","#9f4e3b","#7c3e29","#5a2a1e"];
const DC_RED    = ["#e38989","#c55a5a","#ae3a3a"];
const FG_PURPLE = ["#C7A3E6","#A884D2","#8A66BC"];
const PP_GREEN  = ["#C7E9C0","#A1D99B","#74C476","#41AB5D"];
const PP_GREEN_FWD = ["#6EE389","#34B75A","#0D8A37"];
const AP_COLOR  = [ "#f8ed62", "#e9d700", "#dab600", "#a98600"]; // yellow for the moment

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function buildPatterns(defs){
  const p1 = svgEl("pattern", {id:"contrast_line1", patternUnits:"userSpaceOnUse", width:"6", height:"6"});
  p1.appendChild(svgEl("line",{x1:"0",y1:"0",x2:"6",y2:"0",stroke:"#BBBBBB","stroke-width":"1.8"}));
  p1.appendChild(svgEl("line",{x1:"0",y1:"3",x2:"6",y2:"3",stroke:"#444444","stroke-width":"1"}));
  defs.appendChild(p1);

  const mkRot = (id, deg) => {
    const p = svgEl("pattern", {id, patternUnits:"userSpaceOnUse", width:"6", height:"6", patternTransform:`rotate(${deg})`});
    p.appendChild(svgEl("line",{x1:"0",y1:"0",x2:"6",y2:"0",stroke:"#BBBBBB","stroke-width":"1.8"}));
    p.appendChild(svgEl("line",{x1:"0",y1:"3",x2:"6",y2:"3",stroke:"#444444","stroke-width":"1"}));
    defs.appendChild(p);
  };
  mkRot("contrast_line2", 90);
  mkRot("contrast_line3", 45);
  mkRot("contrast_line4", 135);
}

function pickFill(node, state){
  const t = node.tag || "";
  if (t === "IC") {
    const col = IC_SHADES[state.ic % IC_SHADES.length];
    state.ic++;
    return { type:"solid", value: col };
  }
  if (t === "DC") {
    if (node.forward) {
      const col = DC_RED[state.dcF % DC_RED.length];
      state.dcF++;
      return { type:"solid", value: col };
    } else {
      const col = DC_BROWN[state.dc % DC_BROWN.length];
      state.dc++;
      return { type:"solid", value: col };
    }
  }
  if (t === "FG") {
    const col = FG_PURPLE[state.fg % FG_PURPLE.length];
    state.fg++;
    return { type:"solid", value: col };
  }
  if (t === "AP") {
    const col = AP_COLOR[state.ap % AP_COLOR.length];
    state.ap++;
    return { type:"solid", value: col };
  }
  if (t === "PP") {
    if (node.forward) {
      const col = PP_GREEN_FWD[state.ppF % PP_GREEN_FWD.length];
      state.ppF++;
      return { type:"solid", value: col };
    } else {
      const col = PP_GREEN[state.pp % PP_GREEN.length];
      state.pp++;
      return { type:"solid", value: col };
    }
  }
  if (t === "CP") {
    const patterns = ["contrast_line1","contrast_line2","contrast_line3","contrast_line4"];
    const p = patterns[state.cp % patterns.length];
    state.cp++;
    return { type:"pattern", value: p };
  }
  return { type:"solid", value: "rgba(231,215,182,.35)" };
}

function effectiveWordCap(parsed){
  if (!parsed || parsed.length === 0) return WORD_CAP || 50;
  if (WORD_CAP !== 0) return WORD_CAP;
  let m = 0;
  for (const e of parsed){
    const span = e.tree?.wTreeCount || 0;
    if (span > m) m = span;
  }
  return Math.max(1, m);
}

function fitStringInSentenceArea(len) {
  const area = document.getElementById("sentenceArea");
  if (!area) return;

  const cs = getComputedStyle(area);

  // ---- STEP 1: available size (content box) ----
  const paddingX =
    parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const paddingY =
    parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

  const availWidth = area.clientWidth - paddingX;
  const availHeight = area.clientHeight - paddingY;

  // ---- constants ----
  const MAX_FONT = 26;
  const MIN_FONT = 12;
  const CHAR_WIDTH_RATIO = 0.5; //0.56
  //const LINE_HEIGHT_RATIO = 1.4;
  const LINE_HEIGHT_RATIO = cs.lineHeight.endsWith("px")
    ? parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)
    : parseFloat(cs.lineHeight);

  // ---- helper: does text fit at this font size? ----
  function fits(fontSizePx) {
    const charWidth = fontSizePx * CHAR_WIDTH_RATIO;
    const lineHeight = fontSizePx * LINE_HEIGHT_RATIO;

    const charsPerLine = Math.floor(availWidth / charWidth);
    if (charsPerLine <= 0) return false;

    const neededLines = Math.ceil(len / charsPerLine);
    const neededHeight = neededLines * lineHeight;

    return neededHeight <= availHeight;
  }

  // ---- STEP 2: find biggest fitting font size ----
  let chosenFont = MIN_FONT;

  for (let fs = MAX_FONT; fs >= MIN_FONT; fs-=0.5) {
    if (fits(fs)) {
      chosenFont = fs;
      break;
    }
  }

  area.style.fontSize = chosenFont + "px";

  // ---- STEP 3: grow height if even MIN_FONT doesn't fit ----
if (chosenFont === MIN_FONT && !fits(MIN_FONT)) {
  const charWidth = MIN_FONT * CHAR_WIDTH_RATIO;
  const lineHeight = MIN_FONT * LINE_HEIGHT_RATIO;

  const charsPerLine = availWidth / charWidth;

  // fractional lines → fractional height
  const neededContentHeight = (len / charsPerLine) * lineHeight;

  // total element height = content + padding
  const newTotalHeight = neededContentHeight + paddingY;

  area.style.height = Math.ceil(newTotalHeight) + "px";
}
}


function getOwnTextRangeByWord(node, wordIndex){
  const text = node.textTree || "";
  if (!node.nodes || node.nodes.length === 0 || !text.length) return null;
  if (!Number.isFinite(wordIndex)) return null;

  const spans = [];
  const baseStart = (node.cPos || 1) - 1;
  const nodeText = node.text || "";

  if (nodeText.length && (node.wCount || 0) > 0) {
    const wStart = node.wPos || 1;
    spans.push({
      start: baseStart,
      end: baseStart + nodeText.length,
      wStart,
      wEnd: wStart + (node.wCount || 0) - 1
    });
  }

  for (const ch of (node.nodes || [])){
    if (!ch.tag && ch.text && ch.text.length){
      const chStart = (ch.cPos || 1) - 1;
      const wStart = ch.wPos || 1;
      const wEnd = wStart + (ch.wTreeCount || 0) - 1;
      spans.push({
        start: chStart,
        end: chStart + ch.text.length,
        wStart,
        wEnd
      });
    }
  }

  if (!spans.length) return null;
  spans.sort((a, b) => a.start - b.start);

  const target = spans.find(s => wordIndex >= s.wStart && wordIndex <= s.wEnd);
  if (!target) return null;

  const localStart = Math.max(0, target.start - baseStart);
  const localEnd = Math.min(text.length, target.end - baseStart);
  if (localEnd <= localStart) return null;

  return { start: localStart, end: localEnd };
}

function shouldApplyHl2(node){
  let parts = 0;
  if (node.text && node.text.length) parts++;
  for (const ch of (node.nodes || [])){
    if (!ch.tag && ch.text && ch.text.length) parts++;
  }
  return parts >= 2;
}

function buildTreeHighlightHtml(node, wordIndex){
  const text = node.textTree || "";
  if (!text.length) return "";

  const ranges = [];
  for (const ch of (node.nodes || [])){
    if (ch.tag && ch.textTree && ch.textTree.length){
      const baseStart = (node.cPos || 1) - 1;
      const chStart = (ch.cPos || 1) - 1;
      const localStart = Math.max(0, chStart - baseStart);
      const localEnd = Math.min(text.length, localStart + ch.textTree.length);
      if (localEnd > localStart){
        ranges.push({ start: localStart, end: localEnd, cls: "hlChild" });
      }
    }
  }

  if (shouldApplyHl2(node)){
    const ownRange = getOwnTextRangeByWord(node, wordIndex);
    if (ownRange) {
      ranges.push({ start: ownRange.start, end: ownRange.end, cls: "hlCursor" });
    }
  }

  if (!ranges.length) return escapeHtml(text);
  ranges.sort((a, b) => a.start - b.start);

  let out = "";
  let cursor = 0;
  for (const r of ranges){
    const start = Math.max(cursor, r.start);
    const end = Math.max(start, r.end);
    if (start > cursor) out += escapeHtml(text.slice(cursor, start));
    if (end > start) out += `<span class="${r.cls}">${escapeHtml(text.slice(start, end))}</span>`;
    cursor = Math.max(cursor, end);
  }
  out += escapeHtml(text.slice(cursor));
  return out;
}

function setHighlightedSentence(tree, node, noHl=false, wordIndex=null){
  const sArea = document.getElementById("sentenceArea");
  const so = node.textSoFar || "";
  const tr = node.textTree || "";
  const af = node.textAfter || "";
  const len = so.length + tr.length + af.length;

  fitStringInSentenceArea(len);
  const hlClass = noHl ? "" : "hl";
  const hasTaggedChild = (node.nodes || []).some(ch => ch.tag && ch.tag.length);
  const inner = (!noHl && hasTaggedChild)
    ? buildTreeHighlightHtml(node, wordIndex)
    : escapeHtml(tr);

  sArea.innerHTML = `${escapeHtml(so)}<span class="${hlClass}">${inner}</span>${escapeHtml(af)}`;
}
function clearHighlightedSentence(){
  const sArea = document.getElementById("sentenceArea");
  sArea.textContent = "";
}

function buildHoverComment(tree, node) {
  const lines = [];
  // 1) root comment (first worthy one)
  if (tree.comment) {
    lines.push(tree.comment);
  }
  // 2) node-specific comment OR default
  if (node.comment && node !== tree) {
    lines.push(node.comment);
  } else if (node.tag) {
    const key = node.forward ? node.tag + "f" : node.tag;
    const def = DEFAULT_TAG_COMMENTS[key];
    if (def) lines.push(`(${def})`);
  }
  return lines.join("\n");
}

function setHoveringDisplay(tree, node, wordIndex){
  setHighlightedSentence(tree, node, tree===node, wordIndex);
  commentBox.textContent = buildHoverComment(tree, node);
}

function clearHoveringDisplay(){
  clearHighlightedSentence();
  // restore comment from corpus metadata
  const idx = Number(list.value);
  const c = corpus[idx];
  commentBox.textContent = c?.Comment || "";
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ===================== Sentence context menu ===================== */
let sentenceMenu = null;
let sentenceMenuTitle = null;
let sentenceMenuDeconstruct = null;
let sentenceMenuState = null;

function ensureSentenceMenu(){
  if (sentenceMenu) return sentenceMenu;

  sentenceMenu = document.createElement("div");
  sentenceMenu.className = "sentenceMenu hidden";
  sentenceMenu.id = "sentenceMenu";
  sentenceMenu.innerHTML = `
    <div class="sentenceMenuTitle">
      <span id="sentenceMenuTitle">Sentence</span>
      <button class="sentenceMenuClose" type="button" aria-label="Close">×</button>
    </div>
    <button class="sentenceMenuItem" data-action="deconstruct">Deconstructor</button>
    <button class="sentenceMenuItem" data-action="openStructure">Open structure</button>
    <button class="sentenceMenuItem" data-action="openSource">Open source</button>
    <button class="sentenceMenuItem" data-action="copySentence">Copy sentence</button>
    <button class="sentenceMenuItem" data-action="copyPhrase">Copy phrase</button>
  `;
  document.body.appendChild(sentenceMenu);

  sentenceMenuTitle = sentenceMenu.querySelector("#sentenceMenuTitle");
  sentenceMenuDeconstruct = sentenceMenu.querySelector("[data-action='deconstruct']");
  const closeBtn = sentenceMenu.querySelector(".sentenceMenuClose");
  if (closeBtn){
    closeBtn.addEventListener("click", (e)=>{
      e.stopPropagation();
      closeSentenceMenu();
    });
  }

  sentenceMenu.addEventListener("click", async (e)=>{
    const item = e.target.closest(".sentenceMenuItem");
    if (!item) return;
    const action = item.dataset.action;
    const state = sentenceMenuState;
    closeSentenceMenu();
    if (!state) return;

    switch (action){
      case "deconstruct":
        alert("Deconstructor: upcoming feature.");
        break;
      case "openStructure":
        openStructurePanelAtSentence(state.sentenceText || "");
        break;
      case "openSource":
        openSourcePanelAtSentence(state.sentenceText || "");
        break;
      case "copySentence":
        await copyToClipboard(normalizeSentenceForCopy(state.sentenceText || ""));
        break;
      case "copyPhrase":
        await copyToClipboard(normalizePhraseForCopy(state.nodeText || state.sentenceText || ""));
        break;
      default:
        break;
    }
  });

  sentenceMenu.addEventListener("mousedown", (e)=>e.stopPropagation());

  document.addEventListener("mousedown", (e)=>{
    if (!sentenceMenu || sentenceMenu.classList.contains("hidden")) return;
    if (!sentenceMenu.contains(e.target)) closeSentenceMenu();
  });
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Escape") closeSentenceMenu();
  });
  window.addEventListener("scroll", closeSentenceMenu, true);

  return sentenceMenu;
}

function openSentenceMenuAt(x, y, state){
  const menu = ensureSentenceMenu();
  sentenceMenuState = state || null;
  if (sentenceMenuTitle){
    const idx = Number(state?.sentenceIndex) + 1;
    sentenceMenuTitle.textContent = Number.isFinite(idx) ? `Sentence ${idx}` : "Sentence";
  }
  if (sentenceMenuDeconstruct){
    const enabled = Boolean(state?.canDeconstruct);
    sentenceMenuDeconstruct.disabled = !enabled;
    sentenceMenuDeconstruct.classList.toggle("isDisabled", !enabled);
  }

  menu.classList.remove("hidden");
  menu.style.left = "0px";
  menu.style.top = "0px";

  requestAnimationFrame(()=>{
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    const maxX = window.scrollX + window.innerWidth - rect.width - pad;
    const maxY = window.scrollY + window.innerHeight - rect.height - pad;
    const nextX = Math.max(window.scrollX + pad, Math.min(x, maxX));
    const nextY = Math.max(window.scrollY + pad, Math.min(y, maxY));
    menu.style.left = `${nextX}px`;
    menu.style.top = `${nextY}px`;
  });
}

function closeSentenceMenu(){
  if (!sentenceMenu) return;
  sentenceMenu.classList.add("hidden");
  sentenceMenuState = null;
}

function normalizeSentenceForSearch(s){
  return String(s || "").trimStart();
}
function normalizeSentenceForCopy(s){
  return String(s || "").trimStart();
}
function normalizePhraseForCopy(s){
  return String(s || "").trim();
}

function countTaggedNodes(node){
  if (!node || typeof node !== "object") return 0;
  let count = node.tag ? 1 : 0;
  for (const ch of (node.nodes || [])){
    count += countTaggedNodes(ch);
  }
  return count;
}

function createAnalysisSVG(tree, cap, entry, sentenceIndex){
  const span = tree.wTreeCount || 0;
  const f = span > cap ? (span / cap) : 1;

  const mainH = BAR_HEIGHT * f;
  const mainWdiv = span / f; // == min(span, cap)
  const mainWpct = (mainWdiv / cap) * 100;

  const svg = svgEl("svg", {
    width: "100%",
    height: mainH,
    xmlns: "http://www.w3.org/2000/svg"
  });

  const defs = svgEl("defs");
  buildPatterns(defs);
  svg.appendChild(defs);

  function openMenuForNode(e, node){
    if (e.button !== 0) return;
    const sentenceText = entry?.sentence || "";
    const nodeText = node?.textTree || node?.text || "";
    openSentenceMenuAt(e.pageX, e.pageY, {
      sentenceIndex,
      sentenceText,
      nodeText,
      canDeconstruct: countTaggedNodes(entry?.tree) > 1
    });
  }

  // outer rectangle in %
   const outerRect= svgEl("rect",{
    x:"0",
    y:"0",
    width: `${mainWpct}%`,
    height: `${mainH}`,
    rx:"10",
    ry:"10",
    fill:"#808080"
  })
  outerRect.addEventListener("mouseenter", ()=>setHoveringDisplay(tree, tree)); // tree from outer function
  outerRect.addEventListener("click", (e)=>openMenuForNode(e, tree));
  outerRect.addEventListener("dblclick", async ()=>{
    // For Debug: copy full parsed tree to clipboard (JSON)
    try{
      const json = JSON.stringify(tree, null, 2);
      await copyToClipboard(json);
      alert("Tree copied to clipboard.");
    }catch(e){
      alert("Copy failed.");
    }
  });
  svg.appendChild(outerRect);

  const state = { ic:0, dc:0, dcF:0, fg:0, ap:0, pp:0, ppF:0, cp:0 };

  function rectGeometry(node, cursorWords){
    const xPct = ((cursorWords / f) / cap) * 100;
    const wPct = (((node.wTreeCount || 0) / f) / cap) * 100;

    const lvl = node.level || 1;
    const topM = 5 * lvl;
    const botM = 3 * lvl;
    const y = topM;
    const h = Math.max(0, mainH - topM - botM);
    return { xPct, y, wPct, h };
  }

  function spacerGeometry(startWordIdx, wCount, level){
    const xPct = ((startWordIdx / f) / cap) * 100;
    const wPct = (((wCount || 0) / f) / cap) * 100;
    const lvl = level || 1;
    const topM = 5 * lvl;
    const botM = 3 * lvl;
    const y = topM;
    const h = Math.max(0, mainH - topM - botM);
    return { xPct, y, wPct, h };
  }

  function addSpacerRect(node, startWordIdx, wCount, level, wordIndex){
    if (!wCount || wCount <= 0) return;
    const { xPct, y, wPct, h } = spacerGeometry(startWordIdx, wCount, level);
    const r = svgEl("rect",{
      x: `${xPct}%`,
      y: `${y}`,
      width: `${wPct}%`,
      height: `${h}`,
      rx:"10",
      ry:"10",
      fill: "transparent",
      class: "svgSpacer"
    });
    r.addEventListener("mouseenter", ()=>setHoveringDisplay(tree, node, wordIndex));
    r.addEventListener("click", (e)=>openMenuForNode(e, node));
    svg.appendChild(r);
  }

  function addSpacersForNode(node){
    const hasTaggedChild = (node.nodes || []).some(ch => ch.tag && ch.tag.length);
    if (!hasTaggedChild) return;

    const spacerLevel = (node.level || 1) + 1;
    const nodeStartIdx = (node.wPos || 1) - 1;

    if ((node.wCount || 0) > 0) {
      addSpacerRect(node, nodeStartIdx, node.wCount, spacerLevel, node.wPos || 1);
    }

    for (const ch of (node.nodes || [])){
      if (!ch.tag && (ch.wTreeCount || 0) > 0){
        const startIdx = (ch.wPos || 1) - 1;
        addSpacerRect(node, startIdx, ch.wTreeCount, spacerLevel, ch.wPos || 1);
      }
    }
  }

  function addRect(node, cursorWords){
    const {xPct,y,wPct,h} = rectGeometry(node, cursorWords);
    const fillSpec = pickFill(node, state);

    if (fillSpec.type === "solid"){
      const r = svgEl("rect",{
        x: `${xPct}%`,
        y: `${y}`,
        width: `${wPct}%`,
        height: `${h}`,
        rx:"10",
        ry:"10",
        fill: fillSpec.value
      });
      r.addEventListener("mouseenter", ()=>setHoveringDisplay(tree, node)); // tree from outer function
      r.addEventListener("click", (e)=>openMenuForNode(e, node));
      svg.appendChild(r);
    } else {
      const r = svgEl("rect",{
        x: `${xPct}%`,
        y: `${y}`,
        width: `${wPct}%`,
        height: `${h}`,
        rx:"10",
        ry:"10",
        fill: `url(#${fillSpec.value})`,
        opacity:"0.5",
        style:"mix-blend-mode:luminosity"
      });
      r.addEventListener("mouseenter", ()=>setHoveringDisplay(tree, node)); // tree from outer function
      r.addEventListener("click", (e)=>openMenuForNode(e, node));
      svg.appendChild(r);
    }
  }

  function walk(node, cursorWords){
    // Add spacer rects for this node, aligned with the next level.
    addSpacersForNode(node);

    for (const ch of (node.nodes || [])){
      const isNode = (ch.tag && ch.tag.length > 0);
      if (isNode){
        addRect(ch, cursorWords);
        const childStart = cursorWords;
        const childAfterHeader = childStart + (ch.wCount || 0);
        walk(ch, childAfterHeader);
        cursorWords = childStart + (ch.wTreeCount || 0);
      } else {
        cursorWords += (ch.wCount || 0);
      }
    }
    return cursorWords;
  }

  walk(tree, 0);

  return svg;
}

function enoughOrMinimumBarHeightForTree(tree, cap){
  // minimum viable inner rectangle height (px)
  const MIN_INNER_H = 5;

  if (!tree) return MIN_INNER_H;

  const span = tree.wTreeCount || 0;
  if (span <= 0) return MIN_INNER_H;

  // same scaling factor as createAnalysisSVG
  const f = span > cap ? (span / cap) : 1;

  const maxLevel = tree.maxLevel || 0;
  // hard-coded margins exactly as in rectGeometry()
  const requiredMainH =
    (5 * maxLevel) + (3 * maxLevel) + MIN_INNER_H;
  const requiredBarHeight = Math.ceil(requiredMainH / f);

  // 0 means "current BAR_HEIGHT is sufficient"
  return (BAR_HEIGHT >= requiredBarHeight) ? 0 : requiredBarHeight;
}

function renderSVGs(parsed){
  const panel = document.getElementById("resultPanel");
  closeSentenceMenu();
  panel.innerHTML = "";
  panel.style.background = RESULT_BG;

  if (!parsed) return;

  const cap = effectiveWordCap(parsed);

  for (let i = 0; i < parsed.length; i++){
    const entry = parsed[i];
    const wrap = document.createElement("div");
    wrap.className = "svgWrap";

    const suggested = enoughOrMinimumBarHeightForTree(entry.tree, cap);

    if (suggested === 0) {
      const svg = createAnalysisSVG(entry.tree, cap, entry, i);
      wrap.addEventListener("mouseleave", clearHoveringDisplay);
      wrap.appendChild(svg);
    } else {
      const msg = document.createElement("div");
      msg.className = "svgError";
      msg.textContent =
        `Sentence structure rendering failed: increase bar height (suggested ≥ ${suggested}) or reduce word cap.`;
      wrap.appendChild(msg);
    }

    panel.appendChild(wrap);
  }
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
// Lists + corpus switch buttons
wireDom();

// Active list (remote by default)
let list = remoteList;

const work = document.querySelector(".work");
const author = document.querySelector(".author");
const choice = document.querySelector(".choice");
const commentBox = document.getElementById("commentArea");
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

function applyWorkspaceWidth(){
  // per your hint: if display width is 0 => auto; else fixed px
  if (DISPLAY_WIDTH && DISPLAY_WIDTH > 0){
    workspace.style.width = DISPLAY_WIDTH + "px";
    workspace.style.flex = "0 0 auto";
    workspaceWrap.style.flex = "0 0 auto";

  } else {
    workspace.style.width = "100%";
    workspace.style.flex = "1 1 0";
    workspaceWrap.style.flex = "1 1 0"; }
}

function setStoreEnabled(enabled){
  storeBtn.disabled = !enabled;
}

function setResultPanelLoadingMsg(msg = "Loading..."){
  const panel = document.getElementById("resultPanel");
  if (!panel) return;
  panel.innerHTML = `<div class="loading">${escapeHtml(msg)}</div>`;
}

async function show(idx) {
  // disable store immediately on selection, re-enable after SVG built (if no error)
  setStoreEnabled(false);

  // safety guard in case the corpus isn't loaded
  if (!corpus.length || !corpus[idx]) {
    console.error("show() called before corpus ready", {
      idx,
      corpusLength: corpus.length
    });
    return;
  }

  const c = corpus[idx];

  setResultPanelLoadingMsg();
  work.textContent = (c.Year || c.Year === 0) ? `${c.Work} (${c.Year})` : `${c.Work}`;
  author.textContent = `by ${c.Author}`;
  choice.textContent = c.Choice ? `(${c.Choice})` : "";

  commentBox.classList.remove("error");
  commentBox.textContent = c.Comment || "";

  clearHighlightedSentence();
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

  renderSVGs(lastParsed);

  // now enable store if parsing ok
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
    // keep panel open by design
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

/* ===================== Store feature (+>) ===================== */

function computeCopyRWidth(){
  // fixed width from parameters
  if (DISPLAY_WIDTH && DISPLAY_WIDTH > 0) {
    return DISPLAY_WIDTH;
  }

  // auto mode: if a copyR already exists, reuse its width
  const firstCopy = workspaces.querySelector(".copyR");
  if (firstCopy) {
    return firstCopy.getBoundingClientRect().width;
  }

  // otherwise, first copyR: initial width calculation
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
  const resultPanel = document.getElementById("resultPanel"); // kept for cloning

  const copy = document.createElement("section");
  copy.className = "copyR";
  copy.style.width = w + "px";

  const info = document.createElement("div");
  info.className = "infoR";

  const xBtn = document.createElement("button");
  xBtn.className = "xDel";
  xBtn.textContent = "×";

  const line1 = document.createElement("div");
  line1.className = "line1";
  line1.innerHTML = `<em>${escapeHtml(c.Work)}</em> — by ${escapeHtml(c.Author)}`;

  const line2 = document.createElement("div");
  line2.className = "line2";
  line2.textContent = c.Choice ? `(${c.Choice})` : "";

  info.appendChild(xBtn);
  info.appendChild(line1);
  info.appendChild(line2);

  const main = document.createElement("div");
  main.className = "mainR";
  main.style.background = RESULT_BG;

  // copy SVG stack: clone nodes (no event handlers are copied)
  const cloned = resultPanel.cloneNode(true);
  // remove id to avoid duplicates
  cloned.removeAttribute("id");
  // keep only its children, but preserve wrapper structure
  while (cloned.firstChild){
    main.appendChild(cloned.firstChild);
  }

  copy.appendChild(info);
  copy.appendChild(main);

  // Insert immediately after workspaceWrap, before existing copyRs
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

  // now collapse becomes active (more on this later)
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

// Keep this in sync with your local-corpus storage key.

function isRemoteCorpusActive(){ return activeSource === "remote"; }

function shouldShowCloneBtn(){
  // Show ONLY when:
  // 1) we are on remote corpus, and
  // 2) the modal is showing structural analysis (i.e. toggle says "Switch to original excerpt")
  return isRemoteCorpusActive() && !showingExcerpt;
}

function updateCloneBtnVisibility(){
  // You can use classList if you have .hidden, or style.display.
  cloneLocalBtn.classList.toggle("hidden", !shouldShowCloneBtn());
}

function buildExcerpt(parsed){
  const paras = [];
  let current = [];

  for (const entry of parsed || []) {
    const s = entry.sentence || "";

    if (s.startsWith(" ")) {
      // start new paragraph
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
  // If it is a textarea in your version, use value; otherwise use innerText.
  const text = (typeof el.value === "string") ? el.value : el.innerText;
  return (text || "").replace(/\r\n/g, "\n");
}

// Clipboard helper with fallback for non-secure contexts.
async function copyToClipboard(text){
  if (!text) return;

  if (navigator.clipboard && window.isSecureContext){
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

copyClipboardBtn.addEventListener("click", async () => {
  try{
    await copyToClipboard(getExcerptSourceText());
    /*alert("Copied to clipboard.");*/
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
    // If corrupted, reset to empty
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

function cloneCurrentRemoteEntryToLocal(){
  const idx = Number(list.value);
  const src = corpus[idx];
  if (!src) return;

  // Clone exactly what's needed by your local-corpus format
  const entry = {
    Work: src.Work || "",
    Author: src.Author || "",
    Year: src.Year || "",
    Choice: src.Choice || "",
    Comment: src.Comment || "",
    // Store the full loaded file text (your AnalyzedText should already be the full file content)
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
  pWordCap.value = WORD_CAP;
  pBarHeight.value = BAR_HEIGHT;
  pBgColor.value = RESULT_BG;
  pDisplayWidth.value = DISPLAY_WIDTH;
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

  WORD_CAP = Number.isFinite(wc) && wc >= 0 ? wc : 50;
  BAR_HEIGHT = Number.isFinite(bh) && bh > 0 ? bh : 45;
  RESULT_BG = bg.length ? bg : getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
  DISPLAY_WIDTH = Number.isFinite(dw) && dw >= 0 ? dw : 0;

  applyWorkspaceWidth();
  closeParamModal();

  // persist user prefs
  savePrefsToStorage();

  // reprocess current selection
  show(Number(list.value));
});

document.addEventListener("DOMContentLoaded", init);
