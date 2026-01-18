// Local corpus management page logic
// Depends on sse_common.js (window.SSE).

const SSE = window.SSE;

const entryListEl = document.getElementById("entryList");
const backBtn = document.getElementById("backBtn");

const fWork = document.getElementById("fWork");
const fAuthor = document.getElementById("fAuthor");
const fYear = document.getElementById("fYear");
const fChoice = document.getElementById("fChoice");
const fComment = document.getElementById("fComment");

const analysisInput = document.getElementById("analysisInput");
const newEntryBtn = document.getElementById("newEntryBtn");
const verifyBtn = document.getElementById("verifyBtn");
const storeBtnLocal = document.getElementById("storeBtnLocal");
const downloadBtn = document.getElementById("downloadBtn");
const statusMsg = document.getElementById("statusMsg");

let corpusLocal = [];
let selectedIndex = null;
let suppressDirty = false;

function loadLocalCorpus(){
  const saved = SSE.storageGet(SSE.LS_KEY_LOCAL_CORPUS, []);
  return Array.isArray(saved) ? saved : [];
}

function saveLocalCorpus(){
  SSE.storageSet(SSE.LS_KEY_LOCAL_CORPUS, corpusLocal);
}

function normalizeEntry(e){
  const obj = (e && typeof e === "object") ? e : {};
  return {
    Work: String(obj.Work || "").trim(),
    Author: String(obj.Author || "").trim(),
    Year: (obj.Year === 0 || obj.Year) ? String(obj.Year).trim() : "",
    Choice: String(obj.Choice || "").trim(),
    Comment: String(obj.Comment || "").trim(),
    AnalyzedText: String(obj.AnalyzedText || obj.analyzedText || "").replace(/\r\n/g, "\n")
  };
}

function computeLabels(corpus){
  // Returns an array of labels with duplicate numbering per Work (like the main page).
  const counts = new Map();
  const labels = [];
  for (const e0 of corpus){
    const e = normalizeEntry(e0);
    const base = e.Work || "(untitled)";
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    const title = (n === 1) ? base : `${base} (${n})`;
    const author = e.Author || "(unknown author)";
    labels.push(`${title} — ${author}`);
  }
  return labels;
}

function renderEntryList(){
  entryListEl.innerHTML = "";

  if (!corpusLocal.length){
    const empty = document.createElement("div");
    empty.className = "entryRow entryRowEmpty";
    empty.textContent = "No local entries yet.";
    entryListEl.appendChild(empty);
    return;
  }

  const labels = computeLabels(corpusLocal);

  labels.forEach((label, idx) => {
    const row = document.createElement("div");
    row.className = "entryRow" + (idx === selectedIndex ? " active" : "");

    const lab = document.createElement("div");
    lab.className = "entryLabel";
    lab.textContent = label;

    const del = document.createElement("button");
    del.className = "entryDelete";
    del.type = "button";
    del.textContent = "×";
    del.title = "Delete entry";

    del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const ok = confirm("Delete entry?");
      if (!ok) return;

      corpusLocal.splice(idx, 1);
      saveLocalCorpus();

      if (selectedIndex === idx) selectedIndex = null;
      else if (selectedIndex !== null && selectedIndex > idx) selectedIndex--;

      renderEntryList();

      if (selectedIndex !== null && corpusLocal[selectedIndex]) {
        loadEntryToForm(selectedIndex, { validate: true });
      } else if (corpusLocal.length) {
        selectedIndex = Math.min(idx, corpusLocal.length - 1);
        loadEntryToForm(selectedIndex, { validate: true });
      } else {
        clearForm();
      }
    });

    row.appendChild(lab);
    row.appendChild(del);

	row.addEventListener("click", () => {
	  // Allow deselection by clicking the active entry again.
	  if (selectedIndex === idx){
	    clearForm();
	    return;
	  }
	  loadEntryToForm(idx, { validate: true });
	});

    entryListEl.appendChild(row);
  });
}

function setStatusUnknown(){
  statusMsg.classList.remove("valid", "error");
  statusMsg.textContent = " ? ? ? ? ? ";
}

function setStatusValid(){
  statusMsg.classList.remove("error");
  statusMsg.classList.add("valid");
  statusMsg.textContent = "== Valid ==";
}

function setStatusError(msg){
  statusMsg.classList.remove("valid");
  statusMsg.classList.add("error");
  statusMsg.textContent = msg || "Invalid.";
}

function verifyAnalyzedText(text){
  let errMsg = null;
  const parsed = SSE.parseAnalyzedText(text, (msg) => { errMsg = msg; });
  if (!parsed){
    return { ok: false, msg: errMsg || "Invalid analysis." };
  }
  return { ok: true, msg: null };
}

function updateStoreEnabled(){
  const okMeta = fWork.value.trim().length > 0 && fAuthor.value.trim().length > 0;
  const okText = analysisInput.value.trim().length > 0;
  storeBtnLocal.disabled = !(okMeta && okText);
  downloadBtn.disabled = (selectedIndex == null);
}

function clearForm(){
  suppressDirty = true;
  selectedIndex = null;

  fWork.value = "";
  fAuthor.value = "";
  fYear.value = "";
  fChoice.value = "";
  fComment.value = "";
  analysisInput.value = "";

  suppressDirty = false;
  setStatusUnknown();
  updateStoreEnabled();

  // Ensure the list reflects the deselection.
  renderEntryList();
}

function loadEntryToForm(idx, opts = {}){
  const { validate = false } = opts;

  selectedIndex = idx;

  const e = normalizeEntry(corpusLocal[idx]);

  suppressDirty = true;

  fWork.value = e.Work;
  fAuthor.value = e.Author;
  fYear.value = e.Year;
  fChoice.value = e.Choice;
  fComment.value = e.Comment;
  analysisInput.value = e.AnalyzedText;

  suppressDirty = false;

  renderEntryList();
  updateStoreEnabled();

  if (validate) runVerify({ scrollOnError: false });
  else setStatusUnknown();
}

function gatherEntryFromForm(){
  return {
    Work: fWork.value.trim(),
    Author: fAuthor.value.trim(),
    Year: fYear.value.trim(),
    Choice: fChoice.value.trim(),
    Comment: fComment.value.trim(),
    AnalyzedText: analysisInput.value.replace(/\r\n/g, "\n")
  };
}

function runVerify(opts = {}){
  const { scrollOnError = true } = opts;

  const res = verifyAnalyzedText(analysisInput.value);

  if (res.ok){
    setStatusValid();
    return true;
  }

  setStatusError(res.msg);

  if (scrollOnError){
    const ln = SSE.extractLineNumber(res.msg);
    if (ln) SSE.scrollTextareaToLine(analysisInput, ln);
  }

  return false;
}

function handleTextDirty(){
  if (suppressDirty) return;
  setStatusUnknown();
  updateStoreEnabled();
}

function handleMetaDirty(){
  updateStoreEnabled();
}

backBtn.addEventListener("click", () => {
  window.location.href = "structure_display_v4.html";
});

analysisInput.addEventListener("input", handleTextDirty);
[fWork, fAuthor, fYear, fChoice, fComment].forEach((el) => {
  el.addEventListener("input", handleMetaDirty);
});

verifyBtn.addEventListener("click", () => {
  runVerify({ scrollOnError: true });
});

newEntryBtn.addEventListener("click", () => {
  // Explicitly start a new entry (do not overwrite the selected one).
  clearForm();
  fWork.focus();
});

storeBtnLocal.addEventListener("click", () => {
  if (storeBtnLocal.disabled) return;

  const entry = gatherEntryFromForm();
  const ok = runVerify({ scrollOnError: false });

  if (selectedIndex === null){
    corpusLocal.push(entry);
    selectedIndex = corpusLocal.length - 1;
  } else {
    corpusLocal[selectedIndex] = entry;
  }

  saveLocalCorpus();
  renderEntryList();
  loadEntryToForm(selectedIndex, { validate: ok });

  if (ok){
    alert("Stored in local corpus.");
  } else {
    alert("Stored in local corpus, but invalid. Please run the verification and fix the reported line.");
  }
});

function sanitizeFilenameBase(s){
  // Remove characters that often break filenames on Windows/macOS/Linux.
  // Also collapse spaces to underscores.
  let base = (s || "").trim();
  if (!base) base = "entry";

  base = base.replace(/[\/\\:*?"<>|]/g, ""); // forbidden characters
  base = base.replace(/\s+/g, "_");          // spaces -> underscores
  base = base.replace(/_+/g, "_");           // collapse underscores
  base = base.replace(/^\.+/, "");           // no leading dots
  base = base.replace(/\.+$/, "");           // no trailing dots
  if (!base) base = "entry";
  return base;
}

function buildTextFileContent(){
  // Build header in the required order, then "###", then textarea content.
  const author  = (fAuthor.value  || "").trim();
  const work    = (fWork.value    || "").trim();
  const year    = (fYear.value    || "").trim();
  const choice  = (fChoice.value  || "").trim();
  const comment = (fComment.value || "").trim();

  const headerLines = [
    `Author: ${author}`,
    `Work: ${work}`,
    `Year: ${year}`,
    `Choice: ${choice}`,
    `Comment: ${comment}`,
    "",
    "###",
    ""
  ];

  // Keep the textarea content as-is (normalize line endings).
  const body = (analysisInput.value || "").replace(/\r\n/g, "\n");

  // Ensure file ends with a newline (nice for git diffs).
  return headerLines.join("\n") + body + (body.endsWith("\n") ? "" : "\n");
}

function triggerDownload(filename, content){
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revoke later (avoid revoking too early on some browsers).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

downloadBtn.addEventListener("click", () => {
  if (selectedIndex == null) return;

  const work = (fWork.value || "").trim();
  const base = sanitizeFilenameBase(work);
  const filename = `${base}_1.txt`;

  const content = buildTextFileContent();
  triggerDownload(filename, content);
});

function init(){
  corpusLocal = loadLocalCorpus();
  renderEntryList();

  if (corpusLocal.length){
    selectedIndex = 0;
    loadEntryToForm(0, { validate: true });
  } else {
    clearForm();
  }
}

document.addEventListener("DOMContentLoaded", init);
