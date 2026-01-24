// Deconstruction feature + sentence/dyn menus (Sv4).
// Depends on sse_common.js, svg_render.js, tag_registry.js.

(function(){
  const SSE = window.SSE;
  const SSE_UTIL = window.SSE_UTIL || {};

  let dynTreeList = [];
  let dynResultHost = null;

  function normalizeTagsForLocal(tags){
    if (tags && typeof tags === "object" && !Array.isArray(tags)){
      return Object.keys(tags).filter((k) => tags[k]).join(",");
    }
    if (typeof tags === "string"){
      return tags.split(",").map((t) => t.trim()).filter(Boolean).join(",");
    }
    return tags ? String(tags) : "";
  }

  function isSentenceLineForExtract(line){
    const t = String(line ?? "").trim();
    if (!t) return false;
    if (t.startsWith("#")) return false;
    return !t.startsWith("(") && !t.startsWith("~") && !t.startsWith(")") && !t.startsWith("[") && !t.startsWith("]");
  }

  function extractAnalyzedSentenceBlock(analyzedText, sentenceIndex){
    const lines = String(analyzedText || "").replace(/\r\n/g, "\n").split("\n");
    let current = -1;
    let capturing = false;
    const out = [];
    let parenBalance = 0;
    let bracketBalance = 0;

    function updateBalances(line){
      const trimmed = String(line ?? "").trimStart();
      if (!trimmed) return;
      let t = trimmed;
      while (t.startsWith("~")) t = t.slice(1);
      if (!t) return;
      const op = t[0];
      if (op === "(") parenBalance++;
      else if (op === ")") parenBalance--;
      else if (op === "[") bracketBalance++;
      else if (op === "]") bracketBalance--;
      if (parenBalance < 0) parenBalance = 0;
      if (bracketBalance < 0) bracketBalance = 0;
    }

    for (let i = 0; i < lines.length; i++){
      const line = lines[i];
      const isSentenceStart = isSentenceLineForExtract(line) && parenBalance === 0 && bracketBalance === 0;
      if (isSentenceStart){
        current++;
        if (capturing) break;
        if (current === sentenceIndex){
          capturing = true;
          out.push(line);
          continue;
        }
      }
      if (capturing) out.push(line);
      updateBalances(line);
    }

    if (!capturing) return "";
    return out.join("\n");
  }

  function buildDeconstructionTitle(src, sentenceNum){
    const marker = SSE_UTIL.getChoiceMarkerFromValue(src?.Choice);
    const base = String(src?.Work || "").trim() || "Untitled";
    const suffix = marker ? ` -${marker}` : "";
    return `${base}${suffix}/S${sentenceNum}`;
  }

  function buildDeconstructionComment(src, sentenceNum){
    const marker = SSE_UTIL.getChoiceMarkerFromValue(src?.Choice);
    const base = String(src?.Work || "").trim() || "Untitled work";
    const author = String(src?.Author || "").trim();
    const suffix = marker ? ` -${marker}` : "";
    const from = author ? `${base}${suffix} by ${author}` : `${base}${suffix}`;
    return `Desconstruction of sentence ${sentenceNum} from ${from}`;
  }

  function deconstructSentenceFromState(state){
    if (!state?.canDeconstruct) return;
    const sentenceIndex = Number(state?.sentenceIndex);
    if (!Number.isFinite(sentenceIndex)) return;

    const list = window.SSE_STATE?.list;
    const corpus = window.SSE_STATE?.corpus;
    if (!list || !corpus) return;

    const idx = Number(list.value);
    const src = corpus[idx];
    if (!src) return;

    const analyzedBlock = extractAnalyzedSentenceBlock(src.AnalyzedText || "", sentenceIndex);
    if (!analyzedBlock){
      alert("Deconstruction failed: sentence analysis not found.");
      return;
    }

    const sentenceNum = sentenceIndex + 1;
    const lang = src.LanguageOri
      ? `${src.Language || ""}/${src.LanguageOri}`
      : (src.Language || "");

    const entry = {
      Work: buildDeconstructionTitle(src, sentenceNum),
      Author: src.Author || "",
      Year: src.Year || "",
      Choice: `Sentence ${sentenceNum} of a previous excerpt`,
      Language: lang,
      Tags: normalizeTagsForLocal(src.Tags),
      Comment: buildDeconstructionComment(src, sentenceNum),
      AnalyzedText: analyzedBlock,
      isDeconstruction: true
    };

    const storage = window.SSE_STORAGE;
    if (!storage?.readLocalCorpus || !storage?.writeLocalCorpus) return;
    const local = storage.readLocalCorpus();
    local.push(entry);
    storage.writeLocalCorpus(local);
    if (window.SSE_STATE) window.SSE_STATE.corpusLocal = local;
    if (window.SSE_UI?.setLocalCorpus) window.SSE_UI.setLocalCorpus(local);

    if (window.SSE_UI?.setActiveSource) {
      window.SSE_UI.setActiveSource("local", { idx: local.length - 1, random: false });
    }
  }

  function cloneTreeNodeForDyn(node){
    if (!node || typeof node !== "object") return null;
    const copy = {
      tag: node.tag || "",
      id: (node.id === 0 || node.id) ? node.id : null,
      ref: (node.ref === 0 || node.ref) ? node.ref : null,
      forward: Boolean(node.forward),
      text: node.text ?? null,
      wCount: Number.isFinite(node.wCount) ? node.wCount : 0,
      cCount: Number.isFinite(node.cCount) ? node.cCount : 0,
      level: Number.isFinite(node.level) ? node.level : 0,
      nodes: [],
      comment: node.comment || null,
      disabled: Boolean(node.disabled)
    };
    if (Array.isArray(node.nodes)) {
      copy.nodes = node.nodes.map(cloneTreeNodeForDyn).filter(Boolean);
    }
    return copy;
  }

  function buildDynRootFromChild(child){
    return {
      tag:"", id:null, ref:null, forward:false,
      text:null, wCount:0, cCount:0, level:0,
      nodes: child ? [child] : [],
      wTreeCount:0, cTreeCount:0, wPos:0, cPos:0,
      maxLevel:0,
      textTree:"", textSoFar:"", textAfter:"",
      comment: null,
      disabled:false
    };
  }

  function buoyantPunctuation(root){
    function isPunctNode(node){
      return Boolean(node && node.tag === "p.");
    }
    function trailingPunctInfo(text){
      const t = String(text || "");
      if (!t) return { punct: null, text: t };
      let i = t.length - 1;
      while (i >= 0 && (/[\s\u200B\u200C\u200D\uFEFF]/.test(t[i]))) i--;
      if (i < 0) return { punct: null, text: t };
      const ch = t[i];
      if (!",.;:!?".includes(ch)) return { punct: null, text: t };
      let j = i - 1;
      while (j >= 0 && (/[\s\u200B\u200C\u200D\uFEFF]/.test(t[j]))) j--;
      const trimmed = t.slice(0, j + 1);
      return { punct: ch, text: trimmed };
    }

    function processNode(node, parent, parentIndex){
      if (!node) return parentIndex;

      let i = 0;
      while (Array.isArray(node.nodes) && i < node.nodes.length){
        const child = node.nodes[i];
        const nextIdx = processNode(child, node, i);
        i = Math.max(i + 1, nextIdx);
      }

      if (Array.isArray(node.nodes) && node.nodes.length){
        const last = node.nodes[node.nodes.length - 1];
        if (isPunctNode(last) && parent && Array.isArray(parent.nodes)){
          const cutIdx = parent.nodes.indexOf(node);
          if (cutIdx >= 0){
            node.nodes.pop();
            last.level = parent.level || 0;
            parent.nodes.splice(cutIdx + 1, 0, last);
            parentIndex = cutIdx + 2;
          }
        }
        if (node.text && !isPunctNode(node)){
          const info = trailingPunctInfo(node.text);
          if (info.punct){
            node.text = info.text;
            const first = node.nodes[0];
            if (!isPunctNode(first)){
              const punctChild = {
                tag:"p.", id:null, ref:null, forward:false,
                text: `${info.punct} `,
                wCount:0, cCount:0, level: node.level || 0,
                nodes:[],
                wTreeCount:0, cTreeCount:0, wPos:0, cPos:0,
                textTree:"", textSoFar:"", textAfter:"",
                _start:0, _end:0,
                disabled:false,
                comment: null
              };
              node.nodes.unshift(punctChild);
            }
          }
        }
        return parentIndex;
      }

      if (!node.text || isPunctNode(node)) return parentIndex;
      const info2 = trailingPunctInfo(node.text);
      if (!info2.punct) return parentIndex;

      node.text = info2.text;
      if (!parent || !Array.isArray(parent.nodes)) return parentIndex;
      const idx = parent.nodes.indexOf(node);
      if (idx < 0) return parentIndex;
      if (parent.nodes[idx + 1] && isPunctNode(parent.nodes[idx + 1])) return parentIndex;

      const newNode = {
        tag:"p.", id:null, ref:null, forward:false,
        text: `${info2.punct} `,
        wCount:0, cCount:0, level: parent.level || 0,
        nodes:[],
        wTreeCount:0, cTreeCount:0, wPos:0, cPos:0,
        textTree:"", textSoFar:"", textAfter:"",
        _start:0, _end:0,
        disabled:false,
        comment: null
      };
      parent.nodes.splice(idx + 1, 0, newNode);
      return idx + 2;
    }

    processNode(root, null, 0);
  }

  function sanitizePunctuation(root){
    function isPunctNode(node){
      return Boolean(node && node.tag === "p.");
    }
    function getPunctChar(node){
      const t = String(node?.text || "").trim();
      return t ? t[0] : "";
    }
    function isQuote(ch){
      return ["\"", "'", "\u201c", "\u201d", "\u2018", "\u2019"].includes(ch);
    }
    function isStraightQuote(ch){
      return ch === "\"" || ch === "'";
    }
    function isMatchingQuotePair(a, b){
      return (a === "\u201c" && b === "\u201d") || (a === "\u201d" && b === "\u201c")
        || (a === "\u2018" && b === "\u2019") || (a === "\u2019" && b === "\u2018");
    }
    function isSeparator(ch){
      return ch === "," || ch === ";" || ch === ":";
    }

    function pass1(node){
      if (!node) return;
      if (isPunctNode(node)) node.disabled = false;
      for (const ch of (node.nodes || [])) pass1(ch);
    }

    function pass2(nodes, lastPunct){
      let last = lastPunct || null;
      for (const node of (nodes || [])){
        if (!node || node.disabled) continue;
        if (isPunctNode(node)){
          const currChar = getPunctChar(node);
          if (last){
            const prevChar = getPunctChar(last);
            if (isQuote(prevChar) && isQuote(currChar)){
              if (isMatchingQuotePair(prevChar, currChar) ||
                  (isStraightQuote(prevChar) && isStraightQuote(currChar) && prevChar === currChar)){
                last.disabled = true;
                node.disabled = true;
                last = null;
                continue;
              }
            }
            if ((isQuote(prevChar) && isSeparator(currChar)) ||
                (isSeparator(prevChar) && isQuote(currChar))){
              last = node;
              continue;
            }
            if (prevChar === currChar){
              last.disabled = true;
              last = node;
              continue;
            }
            if ((prevChar === "," && currChar === ";") || (prevChar === ";" && currChar === ",")){
              if (prevChar === ",") last.disabled = true;
              else node.disabled = true;
              last = (prevChar === ";") ? last : node;
              continue;
            }
            if ((prevChar === "," && currChar === ":") || (prevChar === ":" && currChar === ",")){
              if (prevChar === ",") last.disabled = true;
              else node.disabled = true;
              last = (prevChar === ":") ? last : node;
              continue;
            }
            last.disabled = true;
            last = node;
          } else {
            last = node;
          }
          continue;
        }

        last = null;
        if (node.nodes && node.nodes.length){
          last = pass2(node.nodes, last);
        }
      }
      return last;
    }

    pass1(root);
    if (root && root.nodes) pass2(root.nodes, null);
  }

  function buildDynTreeListFromParsed(parsed){
    const baseTree = parsed?.[0]?.tree;
    const roots = [];
    const topNodes = baseTree?.nodes || [];
    for (const node of topNodes){
      const childCopy = cloneTreeNodeForDyn(node);
      const root = buildDynRootFromChild(childCopy);
      buoyantPunctuation(root);
      if (SSE?.reprocessTree) SSE.reprocessTree(root);
      roots.push(root);
    }
    return roots;
  }

  function renderDynResult(parsed){
    dynResultHost = document.getElementById("dynResult");
    if (!dynResultHost) return;
    dynTreeList = buildDynTreeListFromParsed(parsed);
    if (window.SSE_STATE) window.SSE_STATE.dynTreeList = dynTreeList;
    if (!dynTreeList.length) return;

    dynResultHost.innerHTML = "";

    const entries = dynTreeList.map((tree, idx) => ({
      tree,
      sentence: tree._reconstructed || "",
      dynMeta: { partIndex: idx + 1, partTotal: dynTreeList.length }
    }));
    const cap = window.SSE_SVG.effectiveWordCap(entries);

    for (let i = 0; i < entries.length; i++){
      const entry = entries[i];
      const wrap = document.createElement("div");
      wrap.className = "svgWrap";
      if (i < entries.length - 1) wrap.classList.add("groupWithNext");

      const svg = window.SSE_SVG.createAnalysisSVG(entry.tree, cap, entry, 0);
      wrap.addEventListener("mouseleave", window.SSE_SVG.clearHoveringDisplay);
      wrap.appendChild(svg);
      dynResultHost.appendChild(wrap);
    }
  }

  function updateDynResult(){
    if (!dynTreeList.length) return;
    if (!dynResultHost) dynResultHost = document.getElementById("dynResult");
    if (!dynResultHost) return;
    dynResultHost.innerHTML = "";
    const entries = dynTreeList.map((tree, idx) => ({
      tree,
      sentence: tree._reconstructed || "",
      dynMeta: { partIndex: idx + 1, partTotal: dynTreeList.length }
    }));
    const cap = window.SSE_SVG.effectiveWordCap(entries);

    for (let i = 0; i < entries.length; i++){
      const entry = entries[i];
      const wrap = document.createElement("div");
      wrap.className = "svgWrap";
      if (i < entries.length - 1) wrap.classList.add("groupWithNext");

      const svg = window.SSE_SVG.createAnalysisSVG(entry.tree, cap, entry, 0);
      wrap.addEventListener("mouseleave", window.SSE_SVG.clearHoveringDisplay);
      wrap.appendChild(svg);
      dynResultHost.appendChild(wrap);
    }
  }

  function updateDeconstructStatus(){
    const deconstructStatus = window.SSE_STATE?.deconstructStatus;
    if (!deconstructStatus) return;
    deconstructStatus.textContent = "";
    if (!dynTreeList.length) return;

    let disabledDc = 0;

    function walk(node){
      if (!node || node.disabled) return;
      for (const ch of (node.nodes || [])){
        if (!ch) continue;
        if (ch.disabled){
          if (ch.tag === "DC") disabledDc++;
          continue;
        }
        walk(ch);
      }
    }

    for (const root of dynTreeList){
      for (const ch of (root.nodes || [])) walk(ch);
    }

    if (disabledDc > 0){
      deconstructStatus.textContent =
        `Warning: ${disabledDc} dependent clauses disabled; deconstructed sentence may not be well formed.`;
    }
  }

  function ensureLeadingSpaceForJoin(text, isFirst){
    if (isFirst) return text;
    if (!text) return text;
    if (text.startsWith(" ") || text.startsWith("???") || text.startsWith("?")) return text;
    return ` ${text}`;
  }

  function normalizeDeconstructSentenceText(text){
    let out = String(text || "");
    out = out.replace(/,\s*,/g, ",");
    out = out.replace(/,\s*;/g, ";");
    out = out.replace(/;\s*,/g, ";");
    out = out.replace(/,\s*:/g, ":");
    out = out.replace(/:\s*,/g, ":");
    out = out.replace(/([,;:])(?:\s*[,;:])+/g, (m) => {
      if (m.includes(":")) return ":";
      if (m.includes(";")) return ";";
      return ",";
    });
    out = out.replace(/\s{2,}/g, " ");
    out = out.replace(/\s+([,.;:!?])/g, "$1");
    out = out.replace(/([,.;:!?])([^\s])/g, "$1 $2");
    return out;
  }

  function buildDeconstructSentence(){
    if (!dynTreeList.length) return "";
    const parts = [];
    let hasTextBefore = false;
    for (const tree of dynTreeList){
      let raw = String(tree?._reconstructed || "");
      if (!raw) continue;
      if (!hasTextBefore){
        raw = raw.replace(/^\s*[,.;:!?]+\s*/, "");
      }
      if (!raw.trim().length) continue;
      hasTextBefore = true;
      parts.push(ensureLeadingSpaceForJoin(raw, parts.length === 0));
    }
    return normalizeDeconstructSentenceText(parts.join(""));
  }

  function updateDeconstructSentenceDisplay(){
    if (!window.SSE_STATE?.showingDeconstructSentence) return;
    const sArea = document.getElementById("sentenceArea");
    if (!sArea) return;
    const text = buildDeconstructSentence();
    window.SSE_SVG.fitStringInSentenceArea(text.length);
    sArea.textContent = text;
  }

  function walkDynNodes(root, cb){
    if (!root) return;
    cb(root);
    for (const ch of (root.nodes || [])) walkDynNodes(ch, cb);
  }

  function resetSingleDynTree(root){
    if (!root) return;
    walkDynNodes(root, (node) => { node.disabled = false; });
    sanitizePunctuation(root);
    if (SSE?.reprocessTree) SSE.reprocessTree(root);
  }

  function collapseSingleDynNode(root, node){
    if (!root || !node) return;
    if (node.tag === "p.") return;
    node.disabled = true;
    sanitizePunctuation(root);
    if (SSE?.reprocessTree) SSE.reprocessTree(root);
  }

  function collapseAllSingleDynTree(root){
    if (!root) return;
    const main = (root.nodes || [])[0];
    if (!main) return;
    for (const ch of (main.nodes || [])){
      if (ch.tag === "p.") continue;
      ch.disabled = (ch.level || 0) >= 2;
    }
    sanitizePunctuation(root);
    if (SSE?.reprocessTree) SSE.reprocessTree(root);
  }

  function updateDynAfterChange(){
    updateDynResult();
    updateDeconstructStatus();
    updateDeconstructSentenceDisplay();
  }

  function keepOnlyDCs(root){
    function walk(node){
      if (!node) return;
      if ((node.level || 0) <= 1) {
        node.disabled = false;
        for (const ch of (node.nodes || [])) walk(ch);
        return;
      }
      if (node.tag === "DC") {
        node.disabled = false;
        for (const ch of (node.nodes || [])) walk(ch);
        return;
      }
      if (!node.tag) {
        node.disabled = false;
        for (const ch of (node.nodes || [])) walk(ch);
        return;
      }
      if (node.tag === "p.") {
        node.disabled = false;
        return;
      }
      if (node.tag) {
        node.disabled = true;
        return;
      }
      for (const ch of (node.nodes || [])) walk(ch);
    }
    walk(root);
    sanitizePunctuation(root);
    if (SSE?.reprocessTree) SSE.reprocessTree(root);
  }

  function resetDynTrees(){
    for (const root of dynTreeList){
      resetSingleDynTree(root);
    }
    updateDynAfterChange();
  }

  function collapseDynTrees(){
    for (const root of dynTreeList){
      const top = root.nodes || [];
      for (const node of top){
        walkDynNodes(node, (child) => {
          if (child.tag === "p.") return;
          child.disabled = (child.level || 0) >= 2;
        });
      }
      sanitizePunctuation(root);
      if (SSE?.reprocessTree) SSE.reprocessTree(root);
    }
    updateDynAfterChange();
  }

  /* ===================== Sentence context menu ===================== */
  let sentenceMenu = null;
  let sentenceMenuTitle = null;
  let sentenceMenuDeconstruct = null;
  let sentenceMenuState = null;

  let dynMenu = null;
  let dynMenuTitle = null;
  let dynMenuState = null;

  function ensureSentenceMenu(){
    if (sentenceMenu) return sentenceMenu;

    sentenceMenu = document.createElement("div");
    sentenceMenu.className = "sentenceMenu hidden";
    sentenceMenu.id = "sentenceMenu";
    sentenceMenu.innerHTML = `
      <div class="sentenceMenuTitle">
        <span id="sentenceMenuTitle">Sentence</span>
        <button class="sentenceMenuClose" type="button" aria-label="Close">\u00d7</button>
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
          deconstructSentenceFromState(state);
          break;
        case "openStructure":
          window.SSE_UI?.openStructurePanelAtSentence?.(state.sentenceText || "");
          break;
        case "openSource":
          window.SSE_UI?.openSourcePanelAtSentence?.(state.sentenceText || "");
          break;
        case "copySentence":
          await SSE_UTIL.copyToClipboard(normalizeSentenceForCopy(state.sentenceText || ""));
          break;
        case "copyPhrase":
          await SSE_UTIL.copyToClipboard(normalizePhraseForCopy(state.nodeText || state.sentenceText || ""));
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

  function ensureDynMenu(){
    if (dynMenu) return dynMenu;

    dynMenu = document.createElement("div");
    dynMenu.className = "sentenceMenu hidden";
    dynMenu.id = "dynMenu";
    dynMenu.innerHTML = `
      <div class="sentenceMenuTitle">
        <span id="dynMenuTitle">Part</span>
        <button class="sentenceMenuClose" type="button" aria-label="Close">\u00d7</button>
      </div>
      <button class="sentenceMenuItem" data-action="copyText">Copy text</button>
      <button class="sentenceMenuItem" data-action="collapse">Collapse</button>
      <button class="sentenceMenuItem" data-action="collapseAll">Collapse all</button>
      <button class="sentenceMenuItem" data-action="resetAll">Reset all</button>
    `;
    document.body.appendChild(dynMenu);

    dynMenuTitle = dynMenu.querySelector("#dynMenuTitle");
    const closeBtn = dynMenu.querySelector(".sentenceMenuClose");
    if (closeBtn){
      closeBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        closeDynMenu();
      });
    }

    dynMenu.addEventListener("click", async (e)=>{
      const item = e.target.closest(".sentenceMenuItem");
      if (!item) return;
      const action = item.dataset.action;
      const state = dynMenuState;
      closeDynMenu();
      if (!state?.treeRoot) return;

      switch (action){
        case "copyText":
          await SSE_UTIL.copyToClipboard(state.treeRoot._reconstructed || state.treeRoot.textTree || "");
          break;
        case "collapse":
          collapseSingleDynNode(state.treeRoot, state.targetNode);
          updateDynAfterChange();
          break;
        case "collapseAll":
          collapseAllSingleDynTree(state.treeRoot);
          updateDynAfterChange();
          break;
        case "resetAll":
          resetSingleDynTree(state.treeRoot);
          updateDynAfterChange();
          break;
        default:
          break;
      }
    });

    dynMenu.addEventListener("mousedown", (e)=>e.stopPropagation());

    document.addEventListener("mousedown", (e)=>{
      if (!dynMenu || dynMenu.classList.contains("hidden")) return;
      if (!dynMenu.contains(e.target)) closeDynMenu();
    });
    document.addEventListener("keydown", (e)=>{
      if (e.key === "Escape") closeDynMenu();
    });
    window.addEventListener("scroll", closeDynMenu, true);

    return dynMenu;
  }

  function openDynMenuAt(x, y, state){
    const menu = ensureDynMenu();
    dynMenuState = state || null;
    if (dynMenuTitle){
      const idx = Number(state?.partIndex);
      const total = Number(state?.partTotal);
      if (Number.isFinite(idx) && Number.isFinite(total)){
        dynMenuTitle.textContent = `Part ${idx}/${total}`;
      } else {
        dynMenuTitle.textContent = "Part";
      }
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

  function closeDynMenu(){
    if (!dynMenu) return;
    dynMenu.classList.add("hidden");
    dynMenuState = null;
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

  function normalizeSentenceForCopy(s){
    return String(s || "").trimStart();
  }
  function normalizePhraseForCopy(s){
    return String(s || "").trim();
  }

  window.SSE_DECON = {
    renderDynResult,
    updateDynResult,
    updateDeconstructStatus,
    updateDynAfterChange,
    buildDeconstructSentence,
    resetDynTrees,
    collapseDynTrees,
    keepOnlyDCs,
    deconstructSentenceFromState,
    openDynMenuAt,
    openSentenceMenuAt,
    closeSentenceMenu,
    closeDynMenu
  };
})();
