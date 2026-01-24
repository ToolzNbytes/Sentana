// Tag registry + shared helpers for Sentence Structure Explorer (Sv4).
// Exposes window.SSE_APP (preferred) plus legacy aliases.

(function(){
  const SSE_APP = window.SSE_APP || {
    version: "v4",
    tags: {},
    util: {},
    config: {},
    state: {},
    ui: {},
    decon: {},
    storage: {}
  };

  const defs = {
    IC:  { label: "independent clause", palette: ["#89CFF1","#6EB1D6","#5293BB","#3776A1","#1B5886","#003A6B"] },
    DC:  { label: "dependent clause", palette: ["#f2d6a6","#f0c493","#e59f7d","#d47557","#b75f4b","#9f4e3b","#7c3e29","#5a2a1e"] },
    DCf: { label: "dependent clause before the subject of the referenced clause", palette: ["#e38989","#c55a5a","#ae3a3a"] },
    PP:  { label: "participial phrase or similar, optional", palette: ["#C7E9C0","#A1D99B","#74C476","#41AB5D"] },
    PPf: { label: "participial phrase or similar, optional, before the refered subject", palette: ["#6EE389","#34B75A","#0D8A37"] },
    AP:  { label: "other adjunct phrase, optional", palette: ["#f8ed62","#e9d700","#dab600","#a98600"] },
    AT:  { label: "attribution", palette: ["#808080"] },
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

  SSE_APP.tags.defs = defs;
  SSE_APP.tags.resolveTagKey = resolveTagKey;
  SSE_APP.tags.getLabel = getLabel;

  const util = SSE_APP.util;

  util.escapeHtml = function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  };

  util.copyToClipboard = async function copyToClipboard(text){
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

  util.getChoiceMarkerFromValue = function getChoiceMarkerFromValue(choice){
    const raw = String(choice ?? "").trim();
    if (!raw.startsWith("#")) return "";
    const rest = raw.slice(1).trim();
    if (!rest) return "";
    return rest.split(/\s+/)[0];
  };

  const rootStyle = getComputedStyle(document.documentElement);
  const config = SSE_APP.config;
  if (typeof config.WORD_CAP !== "number") config.WORD_CAP = 50;
  if (typeof config.BAR_HEIGHT !== "number") config.BAR_HEIGHT = 45;
  if (typeof config.DISPLAY_WIDTH !== "number") config.DISPLAY_WIDTH = 0;
  if (typeof config.RESULT_BG !== "string" || !config.RESULT_BG.trim()){
    config.RESULT_BG = rootStyle.getPropertyValue("--panel").trim();
  }

  if (!config.colors || typeof config.colors !== "object") config.colors = {};
  const colors = config.colors;
  if (typeof colors.rootDefault !== "string") colors.rootDefault = "#808080";
  if (typeof colors.rootDialogue !== "string") colors.rootDialogue = "rgba(230,230,230,0.8)";
  if (typeof colors.fillFallback !== "string") colors.fillFallback = "rgba(231,215,182,.35)";
  if (typeof colors.dialogueStroke !== "string") colors.dialogueStroke = "rgba(255,255,255,0.9)";

  window.SSE_APP = SSE_APP;
  // Legacy aliases for compatibility.
  window.SSE_TAGS = SSE_APP.tags;
  window.SSE_UTIL = SSE_APP.util;
  window.SSE_CONFIG = SSE_APP.config;
})();
