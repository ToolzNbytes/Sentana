// Tag registry + shared helpers for Sentence Structure Explorer (Sv4).
// Exposes window.SSE_TAGS, window.SSE_UTIL, window.SSE_CONFIG.

(function(){
  const defs = {
    IC:  { label: "independent clause", palette: ["#89CFF1","#6EB1D6","#5293BB","#3776A1","#1B5886","#003A6B"] },
    DC:  { label: "dependent clause", palette: ["#f2d6a6","#f0c493","#e59f7d","#d47557","#b75f4b","#9f4e3b","#7c3e29","#5a2a1e"] },
    DCf: { label: "dependent clause before the subject of the referenced clause", palette: ["#e38989","#c55a5a","#ae3a3a"] },
    PP:  { label: "participial phrase or similar, optional", palette: ["#C7E9C0","#A1D99B","#74C476","#41AB5D"] },
    PPf: { label: "participial phrase or similar, optional, before the refered subject", palette: ["#6EE389","#34B75A","#0D8A37"] },
    AP:  { label: "other adjunct phrase, optional", palette: ["#f8ed62","#e9d700","#dab600","#a98600"] },
    CP:  { label: "compound predicate or coordinated parallel constituent", patterns: ["contrast_line1","contrast_line2","contrast_line3","contrast_line4"], decoratesParent: true },
    FG:  { label: "fragment", palette: ["#C7A3E6","#A884D2","#8A66BC"] }
  };

  function resolveTagKey(tag, forward){
    if (!tag) return "";
    const key = forward ? (tag + "f") : tag;
    if (defs[key]) return key;
    return defs[tag] ? tag : "";
  }

  function getLabel(tagKey){
    return defs[tagKey]?.label || "";
  }

  const SSE_TAGS = window.SSE_TAGS || {};
  SSE_TAGS.defs = defs;
  SSE_TAGS.resolveTagKey = resolveTagKey;
  SSE_TAGS.getLabel = getLabel;
  window.SSE_TAGS = SSE_TAGS;

  const SSE_UTIL = window.SSE_UTIL || {};

  SSE_UTIL.escapeHtml = function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  };

  SSE_UTIL.copyToClipboard = async function copyToClipboard(text){
    if (!text) return;

    if (navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return;
    }

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
  };

  SSE_UTIL.getChoiceMarkerFromValue = function getChoiceMarkerFromValue(choice){
    const raw = String(choice ?? "").trim();
    if (!raw.startsWith("#")) return "";
    const rest = raw.slice(1).trim();
    if (!rest) return "";
    return rest.split(/\s+/)[0];
  };

  window.SSE_UTIL = SSE_UTIL;

  const rootStyle = getComputedStyle(document.documentElement);
  const SSE_CONFIG = window.SSE_CONFIG || {
    WORD_CAP: 50,
    BAR_HEIGHT: 45,
    RESULT_BG: rootStyle.getPropertyValue("--panel").trim(),
    DISPLAY_WIDTH: 0
  };

  if (typeof SSE_CONFIG.RESULT_BG !== "string" || !SSE_CONFIG.RESULT_BG.trim()){
    SSE_CONFIG.RESULT_BG = rootStyle.getPropertyValue("--panel").trim();
  }

  window.SSE_CONFIG = SSE_CONFIG;
})();
