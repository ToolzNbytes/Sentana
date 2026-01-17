// Shared utilities for Sentence Structure Explorer (storage + parsing)
// This file intentionally exposes a small global API under window.SSE.

(function(){
  const STORAGE_PREFIX = "SentenceStructureExplorer.v1.";
  const LS_KEY_PREFS = STORAGE_PREFIX + "prefs";
  const LS_KEY_LOCAL_CORPUS = STORAGE_PREFIX + "localCorpus";

  function storageSet(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch(e){ console.warn("LocalStorage write failed", e); }
  }
  function storageGet(key, fallback = null){
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch(e){
      console.warn("LocalStorage read/parse failed", e);
      return fallback;
    }
  }
  function storageRemove(key){
    try { localStorage.removeItem(key); } catch(e){ /* ignore */ }
  }

  // Extract a 1-based line number from standard error messages:
  // "...\nLine 12: <content>"
  function extractLineNumber(msg){
    const m = String(msg || "").match(/\bLine\s+(\d+)\b/);
    return m ? Number(m[1]) : null;
  }

  // Scroll a textarea roughly to a 1-based line number and select the line.
  function scrollTextareaToLine(textarea, line1){
    if (!textarea || !Number.isFinite(line1) || line1 <= 0) return;

    const value = textarea.value || "";
    const lines = value.split(/\r?\n/);

    const targetIdx = Math.min(lines.length - 1, Math.max(0, line1 - 1));

    let start = 0;
    for (let i = 0; i < targetIdx; i++){
      start += lines[i].length + 1; // + newline
    }
    const end = start + (lines[targetIdx] || "").length;

    textarea.focus();
    try { textarea.setSelectionRange(start, end); } catch(e){ /* ignore */ }

    const cs = getComputedStyle(textarea);
    let lh = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lh)) {
      const fs = parseFloat(cs.fontSize);
      lh = Number.isFinite(fs) ? fs * 1.35 : 18;
    }
    textarea.scrollTop = Math.max(0, (targetIdx - 1) * lh);
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
      maxLevel:0,
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

  function walkCounts(node, root = node){
    let w = node.wCount || 0;
    let c = node.cCount || 0;
    for (const ch of node.nodes){
      walkCounts(ch, root);
      w += ch.wTreeCount;
      c += ch.cTreeCount;
    }
    node.wTreeCount = w;
    node.cTreeCount = c;
    if (node.level > root.maxLevel) {// update max level
      root.maxLevel = node.level;
    }
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
    const marker = '—';

    function buildWordSpans(text){
      const spans = [];
      let i = 0;
      const n = text.length;

      while (i < n){
        if (text.startsWith(marker, i)){
          i += marker.length;
          continue;
        }
        if (/\s/.test(text[i])){
          i++;
          continue;
        }

        const start = i;
        i++;
        while (i < n){
          if (text.startsWith(marker, i)) break;
          if (/\s/.test(text[i])) break;
          i++;
        }
        spans.push({ start, end: i });
      }
      return spans;
    }

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
    root._wordSpans = buildWordSpans(full);

    function fillStrings(n){
      const startPos = lens[n._start] || 0;
      const endPos = lens[n._end] || 0;
      n.textSoFar = full.slice(0, startPos);
      n.textTree  = full.slice(startPos, endPos);
      n.textAfter = full.slice(endPos);
      n.cPos = startPos + 1;
      n.wPos = countWords(n.textSoFar) + 1;
      for (const ch of (n.nodes || [])) fillStrings(ch);
    }
    fillStrings(root);

    return full;
  }

  try {
    while (i < lines.length){
      let rootWorthyComment = null;
      const nodeComments = new Map();

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


  window.SSE = window.SSE || {};
  Object.assign(window.SSE, {
    LS_KEY_PREFS,
    LS_KEY_LOCAL_CORPUS,
    storageSet,
    storageGet,
    storageRemove,
    parseAnalyzedText,
    extractLineNumber,
    scrollTextareaToLine
  });
})();
