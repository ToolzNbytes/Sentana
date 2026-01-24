// SVG rendering helpers for Sentence Structure Explorer (Sv4).
// Depends on sse_common.js, tag_registry.js, and SSE_APP.

(function(){
  const APP = window.SSE_APP || {};
  const SSE_UTIL = APP.util || {};
  const SSE_TAGS = APP.tags || {};
  const SSE_CONFIG = APP.config || {};

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

  function createFillState(){
    const state = {};
    const defs = SSE_TAGS.defs || {};
    for (const key of Object.keys(defs)) state[key] = 0;
    return state;
  }

  function pickFill(node, state){
    const tag = node?.tag || "";
    if (!tag) return { type:"solid", value: (SSE_CONFIG.colors?.fillFallback || "rgba(231,215,182,.35)") };

    const key = SSE_TAGS.resolveTagKey(tag, Boolean(node.forward));
    const def = (SSE_TAGS.defs || {})[key];
    if (!def) return { type:"solid", value: (SSE_CONFIG.colors?.fillFallback || "rgba(231,215,182,.35)") };

    if (def.patterns && def.patterns.length){
      const idx = state[key] % def.patterns.length;
      state[key]++;
      return { type:"pattern", value: def.patterns[idx] };
    }
    if (def.palette && def.palette.length){
      const idx = state[key] % def.palette.length;
      state[key]++;
      return { type:"solid", value: def.palette[idx] };
    }
    return { type:"solid", value: (SSE_CONFIG.colors?.fillFallback || "rgba(231,215,182,.35)") };
  }

  function effectiveWordCap(parsed){
    if (!parsed || parsed.length === 0) return SSE_CONFIG.WORD_CAP || 50;
    if (SSE_CONFIG.WORD_CAP !== 0) return SSE_CONFIG.WORD_CAP;
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
    const paddingX =
      parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const paddingY =
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

    const availWidth = area.clientWidth - paddingX;
    const availHeight = area.clientHeight - paddingY;

    const MAX_FONT = 26;
    const MIN_FONT = 12;
    const CHAR_WIDTH_RATIO = 0.5;
    const LINE_HEIGHT_RATIO = cs.lineHeight.endsWith("px")
      ? parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)
      : parseFloat(cs.lineHeight);

    function fits(fontSizePx) {
      const charWidth = fontSizePx * CHAR_WIDTH_RATIO;
      const lineHeight = fontSizePx * LINE_HEIGHT_RATIO;
      const charsPerLine = Math.floor(availWidth / charWidth);
      if (charsPerLine <= 0) return false;
      const neededLines = Math.ceil(len / charsPerLine);
      const neededHeight = neededLines * lineHeight;
      return neededHeight <= availHeight;
    }

    let chosenFont = MIN_FONT;
    for (let fs = MAX_FONT; fs >= MIN_FONT; fs-=0.5) {
      if (fits(fs)) {
        chosenFont = fs;
        break;
      }
    }
    area.style.fontSize = chosenFont + "px";

    if (chosenFont === MIN_FONT && !fits(MIN_FONT)) {
      const charWidth = MIN_FONT * CHAR_WIDTH_RATIO;
      const lineHeight = MIN_FONT * LINE_HEIGHT_RATIO;
      const charsPerLine = availWidth / charWidth;
      const neededContentHeight = (len / charsPerLine) * lineHeight;
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
      if (ch.tag && ch.tag !== "p." && ch.textTree && ch.textTree.length){
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

    if (!ranges.length) return SSE_UTIL.escapeHtml(text);
    ranges.sort((a, b) => a.start - b.start);

    let out = "";
    let cursor = 0;
    for (const r of ranges){
      const start = Math.max(cursor, r.start);
      const end = Math.max(start, r.end);
      if (start > cursor) out += SSE_UTIL.escapeHtml(text.slice(cursor, start));
      if (end > start) out += `<span class="${r.cls}">${SSE_UTIL.escapeHtml(text.slice(start, end))}</span>`;
      cursor = Math.max(cursor, end);
    }
    out += SSE_UTIL.escapeHtml(text.slice(cursor));
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
      : SSE_UTIL.escapeHtml(tr);

    sArea.innerHTML = `${SSE_UTIL.escapeHtml(so)}<span class="${hlClass}">${inner}</span>${SSE_UTIL.escapeHtml(af)}`;
  }

  function clearHighlightedSentence(){
    const sArea = document.getElementById("sentenceArea");
    sArea.textContent = "";
  }

  function buildHoverComment(tree, node) {
    const lines = [];
    if (tree.comment) {
      lines.push(tree.comment);
    }
    if (node.comment && node !== tree) {
      lines.push(node.comment);
    } else if (node.tag) {
      const key = SSE_TAGS.resolveTagKey(node.tag, Boolean(node.forward));
      const def = SSE_TAGS.getLabel(key);
      if (def) lines.push(`(${def})`);
    }
    return lines.join("\n");
  }

  function setHoveringDisplay(tree, node, wordIndex){
    setHighlightedSentence(tree, node, tree===node, wordIndex);
    const commentBox = APP.state?.commentBox;
    if (commentBox) commentBox.textContent = buildHoverComment(tree, node);
  }

  function clearHoveringDisplay(){
    clearHighlightedSentence();
    const state = APP.state || {};
    const list = state.list;
    const corpus = state.corpus;
    const commentBox = state.commentBox;
    if (!list || !corpus || !commentBox) return;
    const idx = Number(list.value);
    const c = corpus[idx];
    commentBox.textContent = c?.Comment || "";
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

    const mainH = (SSE_CONFIG.BAR_HEIGHT || 45) * f;
    const mainWdiv = span / f;
    const mainWpct = (mainWdiv / cap) * 100;

    const svg = svgEl("svg", {
      width: "100%",
      height: mainH,
      xmlns: "http://www.w3.org/2000/svg"
    });

    const defs = svgEl("defs");
    buildPatterns(defs);
    svg.appendChild(defs);

    function isRenderable(node){
      return !(node && node.disabled);
    }
    function isPunctuationOnlyText(text){
      const t = String(text || "").trim();
      return t.length === 1 && ",.;:!?".includes(t);
    }
    function wordCountForNode(node){
      if (!node) return 0;
      if (isPunctuationOnlyText(node.text)) return 0;
      return node.wCount || 0;
    }
    function treeWordCountForNode(node){
      if (!node) return 0;
      if (isPunctuationOnlyText(node.text) && (!node.nodes || node.nodes.length === 0)) return 0;
      return node.wTreeCount || 0;
    }

    function openMenuForNode(e, node){
      if (e.button !== 0) return;
      const decon = APP.decon || {};
      if (entry?.dynMeta && decon.openDynMenuAt){
        decon.openDynMenuAt(e.pageX, e.pageY, {
          partIndex: entry.dynMeta.partIndex,
          partTotal: entry.dynMeta.partTotal,
          treeRoot: entry.tree,
          targetNode: node
        });
        return;
      }
      if (decon.openSentenceMenuAt){
        const sentenceText = entry?.sentence || "";
        const nodeText = node?.textTree || node?.text || "";
        decon.openSentenceMenuAt(e.pageX, e.pageY, {
          sentenceIndex,
          sentenceText,
          nodeText,
          canDeconstruct: countTaggedNodes(entry?.tree) > 1
        });
      }
    }

    const rootFill = tree?.dialogueRoot
      ? (SSE_CONFIG.colors?.rootDialogue || "rgba(230,230,230,0.8)")
      : (SSE_CONFIG.colors?.rootDefault || "#808080");
    const outerRect = svgEl("rect",{
      x:"0",
      y:"0",
      width: `${mainWpct}%`,
      height: `${mainH}`,
      rx:"10",
      ry:"10",
      fill: rootFill
    });
    outerRect.addEventListener("mouseenter", ()=>setHoveringDisplay(tree, tree));
    outerRect.addEventListener("click", (e)=>openMenuForNode(e, tree));
    outerRect.addEventListener("dblclick", async ()=>{
      try{
        const json = JSON.stringify(tree, null, 2);
        await SSE_UTIL.copyToClipboard(json);
        alert("Tree copied to clipboard.");
      }catch(e){
        alert("Copy failed.");
      }
    });
    svg.appendChild(outerRect);

    const state = createFillState();

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
      if (!isRenderable(node)) return;
      const nodes = (node.nodes || []).filter(isRenderable);
      const hasTaggedChild = nodes.some(ch => ch.tag && ch.tag.length);
      if (!hasTaggedChild) return;

      const spacerLevel = (node.level || 1) + 1;
      const nodeStartIdx = (node.wPos || 1) - 1;

      const nodeWordCount = wordCountForNode(node);
      if (nodeWordCount > 0) {
        addSpacerRect(node, nodeStartIdx, nodeWordCount, spacerLevel, node.wPos || 1);
      }

      for (const ch of nodes){
        const chTreeCount = treeWordCountForNode(ch);
        if (!ch.tag && chTreeCount > 0){
          const startIdx = (ch.wPos || 1) - 1;
          addSpacerRect(node, startIdx, chTreeCount, spacerLevel, ch.wPos || 1);
        }
      }
    }

    function applyDialogueStroke(attrs, node){
      if (!node || !node.dialogue || (node.level || 0) < 2) return attrs;
      return Object.assign(attrs, {
        stroke: (SSE_CONFIG.colors?.dialogueStroke || "rgba(255,255,255,0.9)"),
        "stroke-width": "2",
        "stroke-dasharray": "6 4"
      });
    }

    function addRect(node, cursorWords){
      const {xPct,y,wPct,h} = rectGeometry(node, cursorWords);
      const fillSpec = pickFill(node, state);

      if (fillSpec.type === "solid"){
        const attrs = applyDialogueStroke({
          x: `${xPct}%`,
          y: `${y}`,
          width: `${wPct}%`,
          height: `${h}`,
          rx:"10",
          ry:"10",
          fill: fillSpec.value
        }, node);
        const r = svgEl("rect", attrs);
        r.addEventListener("mouseenter", ()=>setHoveringDisplay(tree, node));
        r.addEventListener("click", (e)=>openMenuForNode(e, node));
        svg.appendChild(r);
      } else {
        const attrs = applyDialogueStroke({
          x: `${xPct}%`,
          y: `${y}`,
          width: `${wPct}%`,
          height: `${h}`,
          rx:"10",
          ry:"10",
          fill: `url(#${fillSpec.value})`,
          opacity:"0.5",
          style:"mix-blend-mode:luminosity"
        }, node);
        const r = svgEl("rect", attrs);
        r.addEventListener("mouseenter", ()=>setHoveringDisplay(tree, node));
        r.addEventListener("click", (e)=>openMenuForNode(e, node));
        svg.appendChild(r);
      }
    }

    function walk(node, cursorWords){
      if (!isRenderable(node)) return cursorWords;
      addSpacersForNode(node);

      for (const ch of (node.nodes || [])){
        if (!isRenderable(ch)) {
          cursorWords += treeWordCountForNode(ch);
          continue;
        }
        const isNode = (ch.tag && ch.tag.length > 0);
        if (isNode){
          addRect(ch, cursorWords);
          const childStart = cursorWords;
          const childAfterHeader = childStart + wordCountForNode(ch);
          walk(ch, childAfterHeader);
          cursorWords = childStart + treeWordCountForNode(ch);
        } else {
          cursorWords += wordCountForNode(ch);
        }
      }
      return cursorWords;
    }

    walk(tree, 0);
    return svg;
  }

  function enoughOrMinimumBarHeightForTree(tree, cap){
    const MIN_INNER_H = 5;
    if (!tree) return MIN_INNER_H;
    const span = tree.wTreeCount || 0;
    if (span <= 0) return MIN_INNER_H;

    const f = span > cap ? (span / cap) : 1;
    const maxLevel = tree.maxLevel || 0;
    const requiredMainH =
      (5 * maxLevel) + (3 * maxLevel) + MIN_INNER_H;
    const requiredBarHeight = Math.ceil(requiredMainH / f);

    return (SSE_CONFIG.BAR_HEIGHT >= requiredBarHeight) ? 0 : requiredBarHeight;
  }

  function renderSVGs(parsed){
    const panel = document.getElementById("resultPanel");
    const decon = APP.decon || {};
    if (decon.closeSentenceMenu) decon.closeSentenceMenu();
    panel.innerHTML = "";
    panel.style.background = SSE_CONFIG.RESULT_BG;

    if (!parsed) return;

    const cap = effectiveWordCap(parsed);

    for (let i = 0; i < parsed.length; i++){
      const entry = parsed[i];
      const wrap = document.createElement("div");
      wrap.className = "svgWrap";
      if (entry.tree?.groupWithNext) wrap.classList.add("groupWithNext");

      const suggested = enoughOrMinimumBarHeightForTree(entry.tree, cap);

      if (suggested === 0) {
        const svg = createAnalysisSVG(entry.tree, cap, entry, i);
        wrap.addEventListener("mouseleave", clearHoveringDisplay);
        wrap.appendChild(svg);
      } else {
        const msg = document.createElement("div");
        msg.className = "svgError";
        msg.textContent =
          `Sentence structure rendering failed: increase bar height (suggested \u2265 ${suggested}) or reduce word cap.`;
        wrap.appendChild(msg);
      }

      panel.appendChild(wrap);
    }
  }

  APP.svg = {
    effectiveWordCap,
    createAnalysisSVG,
    renderSVGs,
    setHoveringDisplay,
    clearHoveringDisplay,
    fitStringInSentenceArea
  };
  window.SSE_SVG = APP.svg;
})();
