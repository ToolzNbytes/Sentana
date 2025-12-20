let corpus = [];
let lastParsed = null;

/* ===================== Default values ===================== */
let WORD_CAP = 50;
let BAR_HEIGHT = 45;
let RESULT_BG = getComputedStyle(document.documentElement)
  .getPropertyValue('--panel').trim();
let DISPLAY_WIDTH = 0;

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
async function loadCorpus() {
  const res = await fetch("../gen/texts.meta.json");
  if (!res.ok) throw new Error("Cannot load metadata of the corpus");
  corpus = await res.json();
}

/* ===================== INIT ===================== */
async function init() {
  try {
    await loadCorpus();
  } catch (e) {
    alert(e.message);
    return;
  }

  populateList();
  applyWorkspaceWidth();
  list.selectedIndex = Math.floor(Math.random() * corpus.length);
  show(Number(list.value));
}

function populateList() {
  list.innerHTML = "";
  corpus.forEach((c,i)=>{
    const o = document.createElement("option");
    o.value = i;
    o.textContent = `${c.Work} — ${c.Author}`;
    list.appendChild(o);
  });
}

async function loadAnalyzedText(file) {
  const res = await fetch(`../${file}`);
  if (!res.ok) throw new Error(`Cannot load text file: ${file}`);

  const raw = await res.text();

  const markerIndex = raw.indexOf("###");
  if (markerIndex === -1) {
    throw new Error(`Missing ### marker in ${file}`);
  }

  const analyzedText = raw
    .slice(markerIndex + 3)
    .trim();

  return analyzedText;
}

function parseAnalyzedText(analyzedText, reportError){
  const lines = analyzedText.split(/\r?\n/);
  let i = 0;
  const results = [];

  const isEmpty = (l) => !l || !l.trim();
  const isComment = (l) => l.trim().startsWith("#");

  const isSentenceLine = (l) => {
    if (!l || !l.trim()) return false;
    const tt = l.trim();
    return !tt.startsWith("(") && !tt.startsWith("~") && !tt.startsWith(")") && !tt.startsWith("[") && !tt.startsWith("]");
  };

  const parseNumberedComment = (l) => {
    const m = l.trim().match(/^#(\d+)\s*(.*)$/);
    return m ? { id: Number(m[1]), text: m[2] || "" } : null;
  };

  const countWords = (t) => t.replace(/—/g, " ").trim().split(/\s+/).filter(Boolean).length;

  function error(msg, ln){
    reportError(`${msg}\nLine ${ln+1}: ${lines[ln] ?? ""}`);
    throw new Error("stop");
  }

  function parseHeaderAndText(body){
    const headMatch = body.match(/^([A-Z]{2}\d+(?:[<>]\d+)?)?/);
    const head = (headMatch && headMatch[1]) ? headMatch[1] : "";
    const rest = body.slice(head.length);

    const tagMatch = head.match(/^([A-Z]{2})(\d+)([<>])?(\d+)?$/);
    return {
      tag: tagMatch ? tagMatch[1] : "",
      id: tagMatch ? Number(tagMatch[2]) : null,
      forward: tagMatch ? (tagMatch[3] === ">") : false,
      ref: (tagMatch && tagMatch[4]) ? Number(tagMatch[4]) : null,
      text: rest.length ? rest : null,
      comment: null
    };
  }

  function parseAnalysisBlock(){
    const root = {
      tag:"", id:null, ref:null, forward:false,
      text:null, wCount:0, cCount:0, level:0,
      nodes:[], wTreeCount:0, cTreeCount:0, wPos:0, cPos:0,
      textTree:"", textSoFar:"", textAfter:"",
      comment: null
    };

    const stack = [{ node: root, level: 0, kind: "root" }];
    let parenBalance = 0;
    let bracketBalance = 0;

    while (i < lines.length){
      const raw = lines[i];
      if (isEmpty(raw)) { i++; continue; }

      if (parenBalance === 0 && bracketBalance === 0) {
        if (!raw.startsWith("(")) break;
      }

      let t = raw;
      let tilde = 0;
      while (t.startsWith("~")) { tilde++; t = t.slice(1); }
      const level = tilde + 1;

      const op = t[0];
      const top = stack[stack.length - 1];

      if (op === "("){
        if (level !== top.level + 1) error("Indentation error", i);

        parenBalance++;
        const body = t.slice(1);
        const parsed = parseHeaderAndText(body);

        const node = {
          tag: parsed.tag, id: parsed.id, ref: parsed.ref, forward: parsed.forward,
          text: parsed.text,
          wCount: parsed.text ? countWords(parsed.text) : 0,
          cCount: parsed.text ? parsed.text.length : 0,
          level,
          nodes:[],
          wTreeCount:0,cTreeCount:0,wPos:0,cPos:0,
          textTree:"", textSoFar:"", textAfter:"",
          _start:0, _end:0,
          comment: null
        };

        top.node.nodes.push(node);
        stack.push({ node, level, kind: "paren" });
      }
      else if (op === ")"){
        if (stack.length <= 1) error("Check parentheses pairs", i);
        const current = stack[stack.length - 1];
        if (current.kind !== "paren") error("Check parentheses pairs", i);
        if (level !== current.level) error("Indentation error", i);

        parenBalance--;
        if (parenBalance < 0) error("Check parentheses pairs", i);
        stack.pop();
      }
      else if (op === "["){
        if (level !== top.level) error("Indentation error", i);

        bracketBalance++;
        const body = t.slice(1);
        const parsed = parseHeaderAndText(body);

        const node = {
          tag: parsed.tag, id: parsed.id, ref: parsed.ref, forward: parsed.forward,
          text: parsed.text,
          wCount: parsed.text ? countWords(parsed.text) : 0,
          cCount: parsed.text ? parsed.text.length : 0,
          level,
          nodes:[],
          wTreeCount:0,cTreeCount:0,wPos:0,cPos:0,
          textTree:"", textSoFar:"", textAfter:"",
          _start:0, _end:0,
          comment: null
        };

        top.node.nodes.push(node);
        stack.push({ node, level, kind: "bracket" });
      }
      else if (op === "]"){
        if (stack.length <= 1) error("Check parentheses pairs", i);
        const current = stack[stack.length - 1];
        if (current.kind !== "bracket") error("Check parentheses pairs", i);
        if (level !== current.level) error("Indentation error", i);

        bracketBalance--;
        if (bracketBalance < 0) error("Check parentheses pairs", i);
        stack.pop();
      }
      else {
        if (stack.length <= 1) error("Check parentheses pairs", i);
        const current = stack[stack.length - 1];
        if (level !== current.level) error("Indentation error", i);

        const txt = t;
        const leaf = {
          tag:"", id:null, ref:null, forward:false,
          text: txt,
          wCount: countWords(txt),
          cCount: txt.length,
          level,
          nodes:[],
          wTreeCount:0,cTreeCount:0,wPos:0,cPos:0,
          textTree:"", textSoFar:"", textAfter:"",
          _start:0, _end:0,
          comment: null
        };
        current.node.nodes.push(leaf);
      }

      i++;

      if (parenBalance === 0 && bracketBalance === 0){
        let j = i;
        while (j < lines.length && isEmpty(lines[j])) j++;
        if (j >= lines.length || !lines[j].startsWith("(")) break;
      }
    }

    if (parenBalance !== 0 || bracketBalance !== 0) error("Check parentheses pairs", Math.max(0, i-1));
    return root;
  }

  function walkCounts(node){
    let w = node.wCount || 0;
    let c = node.cCount || 0;
    for (const ch of node.nodes){
      walkCounts(ch);
      w += ch.wTreeCount;
      c += ch.cTreeCount;
    }
    node.wTreeCount = w;
    node.cTreeCount = c;
  }

  function rebuild(node){
    let out = node.text || "";
    for (const ch of node.nodes) out += rebuild(ch);
    return out;
  }

  function buildTextIndex(root){
    // Build traversal sequence of text pieces (node.text and leaf.text), with subtree [start,end)
    const pieces = [];
    const lens = [0];

    function dfs(n){
      n._start = pieces.length;

      if (n.text){
        pieces.push(n.text);
        lens.push(lens[lens.length-1] + n.text.length);
      }
      for (const ch of (n.nodes || [])) dfs(ch);

      n._end = pieces.length;
    }

    dfs(root);

    const full = pieces.join("");

    function fillStrings(n){
      const startPos = lens[n._start] || 0;
      const endPos = lens[n._end] || 0;
      n.textSoFar = full.slice(0, startPos);
      n.textTree  = full.slice(startPos, endPos);
      n.textAfter = full.slice(endPos);
      for (const ch of (n.nodes || [])) fillStrings(ch);
    }
    fillStrings(root);

    return full;
  }

  let rootWorthyComment = null;
  const nodeComments = new Map();
  try {
    while (i < lines.length){
      if (isEmpty(lines[i])) { i++; continue; }

      if (!isSentenceLine(lines[i])) error("Sentence expected", i);
      const sentence = lines[i];
      i++;

      while (i < lines.length && (lines[i].trim().startsWith("#")||isEmpty(lines[i]))) {
        if (isEmpty(lines[i])) { i++; continue; }
        const line = lines[i];
        const numbered = parseNumberedComment(line);

        if (numbered) {
          // numbered comments are NOT worthy for root
          // last one wins
          nodeComments.set(numbered.id, numbered.text);
        } else {
          // unnumbered → worthy, but keep only the first
          if (rootWorthyComment === null) {
            rootWorthyComment = line.slice(1).trim(); // remove leading #
          }
        }
        i++;
      }


      if (i >= lines.length || !lines[i].startsWith("(")) error("Analysis block expected", i);

      const tree = parseAnalysisBlock();
      // additional data to add to the tree
      tree.comment = rootWorthyComment;
      walkCounts(tree);
      (function attach(node) { // adding the numbered comments to the node
        if (node.id != null && nodeComments.has(node.id)) {
          node.comment = nodeComments.get(node.id);
        }
        for (const ch of (node.nodes || [])) attach(ch);
      })(tree);

      const rebuilt = rebuild(tree).replace(/^\s+/, "");
      if (rebuilt !== sentence.replace(/^\s+/, "")){
        error("Mismatch sentence error: " + rebuilt, Math.max(0, i-1));
      }

      // Build textSoFar/textTree/textAfter once (root includes reconstructed sentence)
      const fullSentence = buildTextIndex(tree);
      tree._reconstructed = fullSentence;

      results.push({ sentence, tree });

      while (i < lines.length && (isComment(lines[i])||isEmpty(lines[i]))) i++;
    }

    return results;
  } catch {
    return null;
  }
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
  const CHAR_WIDTH_RATIO = 0.56;
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


function setHighlightedSentence(node){
  const sArea = document.getElementById("sentenceArea");
  const so = node.textSoFar || "";
  const tr = node.textTree || "";
  const af = node.textAfter || "";
  const len = so.length + tr.length + af.length;

  fitStringInSentenceArea(len);
  sArea.innerHTML = `${escapeHtml(so)}<span class="hl">${escapeHtml(tr)}</span>${escapeHtml(af)}`;
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
  if (node.comment) {
    lines.push(node.comment);
  } else if (node.tag) {
    const key = node.forward ? node.tag + "f" : node.tag;
    const def = DEFAULT_TAG_COMMENTS[key];
    if (def) lines.push(`(${def})`);
  }
  return lines.join("\n");
}

function setHoveringDisplay(tree, node){
  setHighlightedSentence(node);
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

function createAnalysisSVG(tree, cap){
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

  // outer rectangle in %
  svg.appendChild(svgEl("rect",{
    x:"0",
    y:"0",
    width: `${mainWpct}%`,
    height: `${mainH}`,
    rx:"10",
    ry:"10",
    fill:"#808080"
  }));

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
      r.addEventListener("mouseenter", ()=>setHoveringDisplay(tree,node)); // tree from outer function
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
      r.addEventListener("mouseenter", ()=>setHoveringDisplay(tree,node)); // tree from outer function
      svg.appendChild(r);
    }
  }

  function walk(node, cursorWords){
    for (const ch of (node.nodes || [])){
      const isNode = (ch.tag && ch.tag.length > 0);
      if (isNode){
        addRect(ch, cursorWords);
        cursorWords += (ch.wCount || 0);
        cursorWords = walk(ch, cursorWords);
      } else {
        cursorWords += (ch.wCount || 0);
      }
    }
    return cursorWords;
  }

  walk(tree, 0);

  return svg;
}

function renderSVGs(parsed){
  const panel = document.getElementById("resultPanel");
  panel.innerHTML = "";
  panel.style.background = RESULT_BG;

  if (!parsed) return;

  const cap = effectiveWordCap(parsed);

  for (const entry of parsed){
    const wrap = document.createElement("div");
    wrap.className = "svgWrap";

    const svg = createAnalysisSVG(entry.tree, cap);
    // clear highlight when leaving this svg area
    wrap.addEventListener("mouseleave", clearHoveringDisplay);

    wrap.appendChild(svg);
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
  if (n === 0){
    collapseBtn.textContent = "<<";
    if (isCollapsed) uncollapseWorkspace(true);
  }
}
function collapseWorkspace(){
  if (isCollapsed) return;
  isCollapsed = true;
  collapseBtn.textContent = ">>";

  workspaceWrap.classList.add("collapsingOut");
  // after transition, hide
  setTimeout(()=>{
    workspaceWrap.classList.add("hidden");
    workspaceWrap.classList.remove("collapsingOut");
  }, 230);
}
function uncollapseWorkspace(forced){
  if (!isCollapsed && !forced) return;
  isCollapsed = false;
  collapseBtn.textContent = "<<";

  workspaceWrap.classList.remove("hidden");
  // animate in
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
const list = document.querySelector(".work-list");
const work = document.querySelector(".work");
const author = document.querySelector(".author");
const choice = document.querySelector(".choice");
const commentBox = document.querySelector(".comment"); // REVIEW! why not the id?

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

  work.textContent = `${c.Work} (${c.Year})`;
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
      return;
    }
  }
  lastParsed = parseAnalyzedText(c.AnalyzedText, (msg) => {
    commentBox.textContent = msg;
    commentBox.classList.add("error");
  });

  renderSVGs(lastParsed);

  // now enable store if parsing ok
  if (!hasError()) setStoreEnabled(true);

  updateCollapseEnabled();
}

list.addEventListener("change", (e)=>show(Number(e.target.value)));

/* ===================== Store feature (+>) ===================== */
storeBtn.addEventListener("click", ()=>{
  if (storeBtn.disabled) return;
  if (hasError()) return;

  const idx = Number(list.value);
  const c = corpus[idx];

  const w = (DISPLAY_WIDTH && DISPLAY_WIDTH > 0) ? DISPLAY_WIDTH : 800;

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
  line2.textContent = `(${c.Choice})`;

  info.appendChild(xBtn);
  info.appendChild(line1);
  info.appendChild(line2);

  const main = document.createElement("div");
  main.className = "mainR";
  main.style.background = RESULT_BG;

  // copy SVG stack: clone nodes (no event handlers are copied)
  const resultPanel = document.getElementById("resultPanel");
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

/* ===================== Plus modal ===================== */
const plusModal = document.getElementById("plusModal");
const plusContent = document.getElementById("plusContent");
const toggleView = document.getElementById("toggleView");
const closePlus = document.getElementById("closePlus");
let showingExcerpt = false;

function buildExcerpt(parsed){
  let out = "";
  for (const entry of parsed || []){
    const s = entry.sentence || "";
    if (s.startsWith(" ")){
      out += "\n\n" + s.trim();
    } else {
      out += (out ? " " : "") + s.trim();
    }
  }
  return out;
}

document.querySelector(".plus-btn").addEventListener("click", ()=>{
  const entry = corpus[Number(list.value)];
  plusContent.textContent = entry.AnalyzedText;
  plusContent.className = "modal-content mono";
  toggleView.textContent = "Switch to original excerpt";
  showingExcerpt = false;
  plusModal.style.display = "flex";
});

toggleView.addEventListener("click", ()=>{
  showingExcerpt = !showingExcerpt;
  if (showingExcerpt){
    plusContent.textContent = buildExcerpt(lastParsed);
    plusContent.className = "modal-content serif";
    toggleView.textContent = "Switch to structural analysis";
  } else {
    plusContent.textContent = corpus[Number(list.value)].AnalyzedText;
    plusContent.className = "modal-content mono";
    toggleView.textContent = "Switch to original excerpt";
  }
});

closePlus.addEventListener("click", ()=>plusModal.style.display = "none");
plusModal.addEventListener("click", (e)=>{ if (e.target === plusModal) plusModal.style.display = "none"; });

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

  // reprocess current selection
  show(Number(list.value));
});

document.addEventListener("DOMContentLoaded", init);
