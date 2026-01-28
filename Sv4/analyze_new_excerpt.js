const panels = Array.from(document.querySelectorAll(".wizardPanel"));
const progressSteps = Array.from(document.querySelectorAll(".progressStep"));
const wizardStatus = document.getElementById("wizardStatus");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const headerBackBtn = document.getElementById("headerBackBtn");
const loadSavedBtn = document.getElementById("loadSavedBtn");

const textSteps = Array.from(document.querySelectorAll(".textStep"));
const textStepLabel = document.getElementById("textStepLabel");
const rawExcerpt = document.getElementById("rawExcerpt");
const joinLinesBtn = document.getElementById("joinLinesBtn");
const joinLinesMsg = document.getElementById("joinLinesMsg");
const joinLinesFlash = document.getElementById("joinLinesFlash");
const joinLinesOverlay = document.getElementById("joinLinesOverlay");
const paraPreview = document.getElementById("paraPreview");
const paraSearchInput = document.getElementById("paraSearchInput");
const paraNextBtn = document.getElementById("paraNextBtn");
const paraInsertBtn = document.getElementById("paraInsertBtn");
const paraSearchMsg = document.getElementById("paraSearchMsg");
const sentenceSplitInput = document.getElementById("sentenceSplitInput");
const sentenceSplitPreview = document.getElementById("sentenceSplitPreview");
const structureCounter = document.getElementById("structureCounter");
const prevSentenceBtn = document.getElementById("prevSentenceBtn");
const nextSentenceBtn = document.getElementById("nextSentenceBtn");
const structureNavStatus = document.getElementById("structureNavStatus");
const currentSentenceDisplay = document.getElementById("currentSentenceDisplay");
const currentSentenceText = document.getElementById("currentSentenceText");
const togglePrevContextBtn = document.getElementById("togglePrevContextBtn");
const toggleNextContextBtn = document.getElementById("toggleNextContextBtn");
const splitSentenceBtn = document.getElementById("splitSentenceBtn");
const alwaysShowControlsToggle = document.getElementById("alwaysShowControlsToggle");
const clauseHintsToggle = document.getElementById("clauseHintsToggle");
const prevSentenceDisplay = document.getElementById("prevSentenceDisplay");
const nextSentenceDisplay = document.getElementById("nextSentenceDisplay");
const fusePrevBtn = document.getElementById("fusePrevBtn");
const fuseNextBtn = document.getElementById("fuseNextBtn");
const sentenceDialogueToggle = document.getElementById("sentenceDialogueToggle");
const sentenceComment = document.getElementById("sentenceComment");
const structureTable = document.getElementById("structureTable");
const structurePendingStatus = document.getElementById("structurePendingStatus");

const metaHintTitle = document.getElementById("metaHintTitle");
const metaHintBody = document.getElementById("metaHintBody");
const metaFields = [
  document.getElementById("fWork"),
  document.getElementById("fAuthor"),
  document.getElementById("fYear"),
  document.getElementById("fChoice"),
  document.getElementById("fLanguage"),
  document.getElementById("fTags"),
  document.getElementById("fComment"),
];

let panelIndex = 0;
let textStepIndex = 0;
let searchIndex = 0;
let lastFoundIndex = -1;
let sourceText = "";
let sourceLocked = false;
let splitReady = false;
let splitTextWorking = "";
let joinLinesFlashTimer = null;
let sentenceEntries = [];
let sentenceIndex = 0;
let showPrevContext = false;
let showNextContext = false;
let wordMenuState = null;
let splitMenuState = null;
const LS_KEY_WIZARD_DRAFT = "SentenceStructureExplorer.v1.wizardDraft";
let dragState = null;
let dragIndicator = null;
let tagMenuState = null;
let lastDragTime = 0;

function setStatus(message) {
  wizardStatus.textContent = message;
}

function showPanel(index) {
  panelIndex = Math.max(0, Math.min(index, panels.length - 1));
  const activeStepIndex = Math.max(0, panelIndex);
  panels.forEach((panel, i) => panel.classList.toggle("isActive", i === panelIndex));
  progressSteps.forEach((step, i) => {
    const stepIndex = i + 1;
    const isActive = activeStepIndex === stepIndex;
    const isDone = activeStepIndex > stepIndex;
    step.classList.toggle("isActive", isActive);
    step.classList.toggle("isDone", isDone);
  });
  sourceLocked = panelIndex >= 3;
  if (panelIndex === 2) {
    showTextStep(0);
  }
  if (panelIndex === 3) {
    initializeSentenceSplit();
  }
  if (panelIndex === 4) {
    showStructuresPanel();
  }
  updateNavState();
  updateProgressFill();
}

function showTextStep(index) {
  textStepIndex = Math.max(0, Math.min(index, textSteps.length - 1));
  textSteps.forEach((step, i) => step.classList.toggle("isActive", i === textStepIndex));
  textStepLabel.textContent = `Text prep: ${textStepTitle(textStepIndex)}`;
  if (textStepIndex === 1) {
    updateJoinLinesHint();
  }
  if (textStepIndex === 2) {
    prepareSourceText();
    updatePreview();
  }
  updateNavState();
  updateProgressFill();
}

function textStepTitle(index) {
  if (index === 0) return "Paste the raw excerpt";
  if (index === 1) return "Check for extra line breaks";
  return "Confirm paragraph boundaries";
}

function assessLineBreaks(text) {
  const singleBreaks = (text.match(/[^\n]\n(?!\s*\n)/g) || []).length;
  const paragraphBreaks = (text.match(/\n\s*\n/g) || []).length;
  const hasLotsOfSingles = singleBreaks >= 3 && singleBreaks > paragraphBreaks;
  return hasLotsOfSingles;
}

function updateJoinLinesHint() {
  const text = rawExcerpt.value.trim();
  if (!text) {
    joinLinesMsg.textContent = "Paste text to check line breaks.";
    clearJoinLinesFlash();
    return;
  }
  if (assessLineBreaks(text)) {
    joinLinesMsg.textContent = "Looks like hard-wrapped lines. Joining could help restore paragraphs.";
    triggerJoinLinesFlash();
  } else {
    joinLinesMsg.textContent = "Line breaks look intentional. Join lines only if the source was hard-wrapped.";
    clearJoinLinesFlash();
  }
}

function joinLines() {
  const text = rawExcerpt.value;
  if (!text.trim()) {
    setStatus("Paste text first, then try joining lines.");
    return;
  }
  const paragraphs = text.split(/\n\s*\n/);
  const joined = paragraphs
    .map((para) => para.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim())
    .join("\n\n");
  rawExcerpt.value = joined;
  updateJoinLinesHint();
  updatePreview();
  setStatus("Lines joined within each paragraph.");
}

function updatePreview() {
  const text = rawExcerpt.value.trim();
  if (!text) {
    paraPreview.innerHTML = "<em>No text yet.</em>";
    return;
  }
  const paragraphs = text.split(/\n/).filter((p) => p.trim().length > 0);
  const html = paragraphs
    .map((para) => `<p>${escapeHtml(para.replace(/\s*\n\s*/g, " ").trim())}</p>`)
    .join("");
  paraPreview.innerHTML = html;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function findNextOccurrence() {
  const text = rawExcerpt.value;
  const query = paraSearchInput.value.trim();
  if (!query) {
    paraSearchMsg.textContent = "Type a few words to search.";
    return;
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let index = lowerText.indexOf(lowerQuery, searchIndex);
  if (index === -1 && searchIndex > 0) {
    index = lowerText.indexOf(lowerQuery, 0);
  }
  if (index === -1) {
    paraSearchMsg.textContent = "No match found in the excerpt.";
    return;
  }
  lastFoundIndex = index;
  searchIndex = index + lowerQuery.length;
  rawExcerpt.focus();
  rawExcerpt.setSelectionRange(index, index + query.length);
  paraSearchMsg.textContent = "Match highlighted. Use Next to jump again.";
}

function insertParagraphBreak() {
  const text = rawExcerpt.value;
  const query = paraSearchInput.value.trim();
  if (!query) {
    paraSearchMsg.textContent = "Type a few words before inserting a paragraph break.";
    return;
  }
  let index = lastFoundIndex;
  if (index < 0 || text.toLowerCase().indexOf(query.toLowerCase(), index) !== index) {
    index = text.toLowerCase().indexOf(query.toLowerCase(), 0);
  }
  if (index === -1) {
    paraSearchMsg.textContent = "No match found to insert a paragraph break.";
    return;
  }
  const before = text.slice(0, index);
  const after = text.slice(index);
  const alreadySeparated = /\n$/.test(before);
  const insert = alreadySeparated ? "" : "\n";
  rawExcerpt.value = before + insert + after;
  paraSearchInput.value = "";
  searchIndex = 0;
  lastFoundIndex = -1;
  updatePreview();
  paraSearchMsg.textContent = "Paragraph break inserted.";
}

function updateMetaHint(event) {
  const target = event.target;
  if (!target || !target.dataset) return;
  if (!target.dataset.hintTitle) return;
  metaHintTitle.textContent = target.dataset.hintTitle;
  metaHintBody.textContent = target.dataset.hintBody || "";
}

function hasRequiredMetadata() {
  const work = document.getElementById("fWork").value.trim();
  const author = document.getElementById("fAuthor").value.trim();
  return work.length > 0 && author.length > 0;
}

function hasRawText() {
  return rawExcerpt.value.trim().length > 0;
}

function updateNavState() {
  backBtn.disabled = panelIndex === 0 && textStepIndex === 0;
  backBtn.style.visibility = panelIndex === 0 ? "hidden" : "visible";

  if (panelIndex === 0) {
    const hasDraft = Boolean(loadWizardDraft());
    nextBtn.textContent = hasDraft ? "Start new" : "Start";
    if (loadSavedBtn) loadSavedBtn.classList.toggle("hidden", !hasDraft);
    nextBtn.disabled = false;
    return;
  }
  if (loadSavedBtn) loadSavedBtn.classList.add("hidden");

  if (panelIndex === 2) {
    nextBtn.textContent = "Next";
    nextBtn.disabled = !hasRawText();
    return;
  }

  nextBtn.textContent = "Next";
  if (panelIndex === 1) {
    nextBtn.disabled = !hasRequiredMetadata();
    return;
  }
  if (panelIndex === 4) {
    nextBtn.disabled = !allSentencesDone();
    return;
  }
  nextBtn.disabled = false;
}

function updateProgressFill() {
  progressSteps.forEach((step, i) => {
    const stepIndex = i + 1;
    const fill = computeStepFill(stepIndex);
    const fillEl = step.querySelector(".progressFill");
    if (fillEl) {
      fillEl.style.width = `${Math.round(fill * 100)}%`;
    }
  });
}

function computeStepFill(stepIndex) {
  if (panelIndex > stepIndex) return 1;
  if (panelIndex < stepIndex) return 0;
  if (stepIndex === 1) {
    const filledCount = metaFields.filter((field) => field.value.trim().length > 0).length;
    const totalUnits = metaFields.length + 1;
    return (filledCount + 1) / totalUnits;
  }
  if (stepIndex === 2) {
    let units = 1;
    if (hasRawText()) units += 1;
    if (textStepIndex >= 1) units += 1;
    if (textStepIndex >= 2) units += 1;
    return units / 4;
  }
  if (stepIndex === 3) {
    return panelIndex >= 4 ? 1 : 0.5;
  }
  if (stepIndex === 4) {
    const total = sentenceEntries.length;
    if (!total) return 0;
    const doneCount = sentenceEntries.filter((entry) => entry.done).length;
    return doneCount / total;
  }
  return 0;
}

function handleBack() {
  if (panelIndex === 2 && textStepIndex > 0) {
    showTextStep(textStepIndex - 1);
    return;
  }
  if (panelIndex > 0) {
    showPanel(panelIndex - 1);
  }
}

function handleNext() {
  if (panelIndex === 0) {
    if (loadWizardDraft()) clearWizardDraft();
    resetWizardState();
    showPanel(1);
    return;
  }
  if (panelIndex === 1) {
    saveWizardDraft({ panelIndex: 1 });
    showPanel(2);
    return;
  }
  if (panelIndex === 2) {
    if (textStepIndex < textSteps.length - 1) {
      showTextStep(textStepIndex + 1);
      return;
    }
    sourceText = cleanExcerpt(rawExcerpt.value);
    rawExcerpt.value = sourceText;
    sourceLocked = true;
    saveWizardDraft({ panelIndex: 2, textStepIndex: 2 });
    showPanel(3);
    return;
  }
  if (panelIndex === 3) {
    sentenceEntries = collectSentenceEntries(sentenceSplitInput.value);
    initializeSentenceEntries();
    saveWizardDraft({ panelIndex: 3 });
    showPanel(4);
    return;
  }
  if (panelIndex === 4) {
    saveWizardDraft({ panelIndex: 4 });
  }
  if (panelIndex < panels.length - 1) {
    showPanel(panelIndex + 1);
  }
}

headerBackBtn.addEventListener("click", () => {
  window.location.href = "structure_display_v4.html";
});

backBtn.addEventListener("click", handleBack);
nextBtn.addEventListener("click", handleNext);
loadSavedBtn?.addEventListener("click", () => {
  const draft = loadWizardDraft();
  if (!draft) return;
  restoreWizardDraft(draft);
});

rawExcerpt.addEventListener("input", () => {
  if (panelIndex === 2 && textStepIndex === 0 && rawExcerpt.value.trim().length > 0) {
    showTextStep(1);
  }
  if (textStepIndex === 1) updateJoinLinesHint();
  if (textStepIndex === 2) updatePreview();
  updateNavState();
  updateProgressFill();
});

joinLinesBtn.addEventListener("click", joinLines);

paraSearchInput.addEventListener("input", () => {
  searchIndex = 0;
  lastFoundIndex = -1;
  paraSearchMsg.textContent = "Search for a phrase to navigate the text.";
});

paraNextBtn.addEventListener("click", findNextOccurrence);
paraInsertBtn.addEventListener("click", insertParagraphBreak);

document.querySelectorAll(".metaGrid input, .metaGrid textarea").forEach((field) => {
  field.addEventListener("focus", updateMetaHint);
  field.addEventListener("mouseenter", updateMetaHint);
  field.addEventListener("input", () => {
    updateNavState();
    updateProgressFill();
  });
});

showPanel(0);

function saveWizardDraft(overrides = {}) {
  if (!window.SSE?.storageSet) return;
  const payload = buildWizardDraft(overrides);
  window.SSE.storageSet(LS_KEY_WIZARD_DRAFT, payload);
  updateNavState();
}

function loadWizardDraft() {
  if (!window.SSE?.storageGet) return null;
  return window.SSE.storageGet(LS_KEY_WIZARD_DRAFT, null);
}

function clearWizardDraft() {
  if (!window.SSE?.storageRemove) return;
  window.SSE.storageRemove(LS_KEY_WIZARD_DRAFT);
  updateNavState();
}

function buildWizardDraft(overrides = {}) {
  return {
    panelIndex,
    textStepIndex,
    metadata: {
      work: document.getElementById("fWork").value || "",
      author: document.getElementById("fAuthor").value || "",
      year: document.getElementById("fYear").value || "",
      choice: document.getElementById("fChoice").value || "",
      language: document.getElementById("fLanguage").value || "",
      tags: document.getElementById("fTags").value || "",
      comment: document.getElementById("fComment").value || ""
    },
    rawExcerpt: rawExcerpt.value || "",
    sourceText,
    splitTextWorking,
    sentenceEntries,
    sentenceIndex,
    showPrevContext,
    showNextContext,
    showControls: Boolean(alwaysShowControlsToggle?.checked),
    showHints: Boolean(clauseHintsToggle?.checked),
    ...overrides
  };
}

function restoreWizardDraft(draft) {
  if (!draft) return;
  const meta = draft.metadata || {};
  document.getElementById("fWork").value = meta.work || "";
  document.getElementById("fAuthor").value = meta.author || "";
  document.getElementById("fYear").value = meta.year || "";
  document.getElementById("fChoice").value = meta.choice || "";
  document.getElementById("fLanguage").value = meta.language || "";
  document.getElementById("fTags").value = meta.tags || "";
  document.getElementById("fComment").value = meta.comment || "";

  rawExcerpt.value = draft.rawExcerpt || "";
  sourceText = draft.sourceText || "";
  splitTextWorking = draft.splitTextWorking || "";
  sentenceEntries = Array.isArray(draft.sentenceEntries) ? draft.sentenceEntries : [];
  sentenceIndex = Number.isFinite(draft.sentenceIndex) ? draft.sentenceIndex : 0;
  textStepIndex = Number.isFinite(draft.textStepIndex) ? draft.textStepIndex : 0;
  showPrevContext = Boolean(draft.showPrevContext);
  showNextContext = Boolean(draft.showNextContext);
  if (alwaysShowControlsToggle) {
    alwaysShowControlsToggle.checked = Boolean(draft.showControls);
  }
  if (clauseHintsToggle) {
    clauseHintsToggle.checked = Boolean(draft.showHints);
  }

  const targetPanel = Number.isFinite(draft.panelIndex) ? draft.panelIndex : 1;
  showPanel(targetPanel);
  if (targetPanel === 2) {
    showTextStep(textStepIndex || 2);
  }
  if (targetPanel === 3) {
    if (splitTextWorking) {
      sentenceSplitInput.value = splitTextWorking;
      renderSplitPreview(splitTextWorking);
      splitReady = true;
    }
  }
  if (targetPanel === 4) {
    initializeSentenceEntries();
    showStructuresPanel();
  }
}

function resetWizardState() {
  document.getElementById("fWork").value = "";
  document.getElementById("fAuthor").value = "";
  document.getElementById("fYear").value = "";
  document.getElementById("fChoice").value = "";
  document.getElementById("fLanguage").value = "";
  document.getElementById("fTags").value = "";
  document.getElementById("fComment").value = "";
  rawExcerpt.value = "";
  paraPreview.innerHTML = "";
  sentenceSplitInput.value = "";
  sentenceSplitPreview.innerHTML = "";
  sourceText = "";
  splitTextWorking = "";
  sentenceEntries = [];
  sentenceIndex = 0;
  textStepIndex = 0;
  sourceLocked = false;
  splitReady = false;
  showPrevContext = false;
  showNextContext = false;
  if (alwaysShowControlsToggle) alwaysShowControlsToggle.checked = false;
  if (clauseHintsToggle) clauseHintsToggle.checked = false;
}
applyResponsiveDefaults();

function cleanExcerpt(text) {
  let cleaned = text.replace(/^[ \t]+/gm, "");
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  cleaned = cleaned.replace(/\n{2,}/g, "\n");
  return cleaned.trim();
}

function prepareSourceText() {
  const cleaned = cleanExcerpt(rawExcerpt.value);
  if (cleaned !== rawExcerpt.value) {
    rawExcerpt.value = cleaned;
  }
  if (!sourceLocked) {
    sourceText = cleaned;
    splitTextWorking = "";
  }
}

function triggerJoinLinesFlash() {
  if (!joinLinesFlash || !joinLinesOverlay) return;
  joinLinesFlash.textContent = "Consider using Join lines.";
  joinLinesFlash.classList.add("isActive");
  joinLinesOverlay.textContent = "Consider using Join lines.";
  joinLinesOverlay.classList.remove("hidden");
  if (joinLinesFlashTimer) clearTimeout(joinLinesFlashTimer);
  joinLinesFlashTimer = setTimeout(() => {
    clearJoinLinesFlash();
  }, 2000);
}

function clearJoinLinesFlash() {
  if (!joinLinesFlash || !joinLinesOverlay) return;
  joinLinesFlash.textContent = "";
  joinLinesFlash.classList.remove("isActive");
  joinLinesOverlay.classList.add("hidden");
  if (joinLinesFlashTimer) clearTimeout(joinLinesFlashTimer);
  joinLinesFlashTimer = null;
}

function dismissJoinLinesFlashOnAction() {
  if (!joinLinesOverlay || joinLinesOverlay.classList.contains("hidden")) return;
  clearJoinLinesFlash();
}

["pointerdown", "keydown", "wheel", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, dismissJoinLinesFlashOnAction, { passive: true });
});

function initializeSentenceSplit() {
  if (splitTextWorking) {
    sentenceSplitInput.value = splitTextWorking;
    renderSplitPreview(splitTextWorking);
    splitReady = true;
    updateProgressFill();
    return;
  }
  const baseText = sourceText || cleanExcerpt(rawExcerpt.value);
  if (!baseText) {
    sentenceSplitInput.value = "";
    sentenceSplitPreview.innerHTML = "<em>No text available yet.</em>";
    splitReady = false;
    updateProgressFill();
    return;
  }
  const splitText = autoSplitSentences(baseText);
  sentenceSplitInput.value = splitText;
  splitTextWorking = splitText;
  splitReady = true;
  renderSplitPreview(splitText);
  updateProgressFill();
}

function autoSplitSentences(text) {
  const abbreviations = [
    "Mr",
    "Mrs",
    "Ms",
    "Dr",
    "Prof",
    "Sr",
    "Jr",
    "St",
    "Mt",
    "etc",
    "vs",
    "e.g",
    "i.e",
  ];
  const abbrRegex = new RegExp(`\\b(?:${abbreviations.join("|")})\\.`, "gi");
  const splitRegex = /(\.\.\.|…|[.!?])(["'”’)\]]?)([ \t]+)(?=[A-ZÀ-ÖØ-Ý])/g;

  return text
    .split("\n")
    .map((line) => {
      if (!line) return "";
      const core = line.trim();
      const protectedText = core.replace(abbrRegex, (match) => match.replace(/\./g, "§"));
      const splitText = protectedText.replace(splitRegex, "$1$2\n").replace(/§/g, ".");
      const splitLines = splitText.split("\n");
      splitLines[0] = ` ${splitLines[0]}`;
      return splitLines.join("\n");
    })
    .join("\n");
}
function renderSplitPreview(text) {
  if (!text.trim()) {
    sentenceSplitPreview.innerHTML = "<em>No text yet.</em>";
    return;
  }
  const lines = text.split("\n");
  const html = lines
    .map((line) => {
      if (!line.trim()) return "";
      const cleaned = line.trim();
      const escaped = escapeHtml(cleaned);
      const highlighted = escaped.replace(/(\.\.\.|…|[.!?])/g, '<span class="splitMark">$1</span>');
      return `<div class="splitSentence">${highlighted}</div>`;
    })
    .join("");
  sentenceSplitPreview.innerHTML = html;
}

sentenceSplitInput.addEventListener("input", () => {
  splitTextWorking = sentenceSplitInput.value;
  renderSplitPreview(splitTextWorking);
});

prevSentenceBtn.addEventListener("click", () => moveSentence(-1));
nextSentenceBtn.addEventListener("click", () => moveSentence(1));
togglePrevContextBtn.addEventListener("change", () => toggleContext("prev"));
toggleNextContextBtn.addEventListener("change", () => toggleContext("next"));
splitSentenceBtn.addEventListener("click", () => openSplitMenu());
fusePrevBtn.addEventListener("click", () => fuseWithContext("prev"));
fuseNextBtn.addEventListener("click", () => fuseWithContext("next"));
sentenceDialogueToggle.addEventListener("change", () => {
  const entry = getCurrentEntry();
  if (!entry) return;
  entry.structure.dialogue = sentenceDialogueToggle.checked;
  if (entry.structure.dialogue) {
    entry.structure.lines.forEach((line) => { line.dialogue = false; });
  }
  renderStructureTable();
  updateNavState();
});

alwaysShowControlsToggle.addEventListener("change", () => {
  renderStructureTable();
});

clauseHintsToggle.addEventListener("change", () => {
  renderStructureTable();
});
sentenceComment.addEventListener("input", () => {
  const entry = getCurrentEntry();
  if (!entry) return;
  entry.structure.comment = sentenceComment.value;
});

structureTable.addEventListener("click", (event) => {
  if (Date.now() - lastDragTime < 200) return;
  const word = event.target.closest(".structureWord");
  if (word) {
    const lineIndex = Number(word.dataset.lineIndex);
    const wordStart = Number(word.dataset.wordStart);
    const wordEnd = Number(word.dataset.wordEnd);
    const token = word.textContent || "";
    openWordMenu(event.clientX, event.clientY, lineIndex, wordStart, wordEnd, token);
    return;
  }
  const textCell = event.target.closest(".structureTextCell");
  if (!textCell) return;
  const lineIndex = Number(textCell.dataset.lineIndex);
  if (!Number.isFinite(lineIndex)) return;
  openTagMenu(event.clientX, event.clientY, lineIndex);
});

structureTable.addEventListener("pointerdown", (event) => {
  const word = event.target.closest(".structureWord");
  if (word) return;
  const textCell = event.target.closest(".structureTextCell");
  if (!textCell) return;
  const lineIndex = Number(textCell.dataset.lineIndex);
  if (!Number.isFinite(lineIndex)) return;
  const rect = textCell.getBoundingClientRect();
  dragState = {
    lineIndex,
    startX: event.clientX,
    startY: event.clientY,
    pointerId: event.pointerId,
    active: true,
    started: false,
    rowHeight: rect.height,
    textCell
  };
  textCell.setPointerCapture(event.pointerId);
});

structureTable.addEventListener("pointermove", (event) => {
  if (!dragState || !dragState.active) return;
  if (event.pointerId !== dragState.pointerId) return;
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  const distance = Math.hypot(dx, dy);
  if (!dragState.started && distance < 8) return;
  if (!dragState.started) {
    dragState.started = true;
    dragState.textCell.classList.add("isDragging");
    structureTable.classList.add("isDragging");
    showDragIndicator(event.clientX, event.clientY, "↔");
  }
  updateDragIndicator(event.clientX, event.clientY, dx, dy, dragState);
});

structureTable.addEventListener("pointerup", (event) => {
  if (!dragState) return;
  if (event.pointerId !== dragState.pointerId) return;
  finalizeDrag(event.clientX, event.clientY);
});

structureTable.addEventListener("pointercancel", (event) => {
  if (!dragState) return;
  if (event.pointerId !== dragState.pointerId) return;
  cancelDrag();
});

function updateDragIndicator(x, y, dx, dy, state) {
  const entry = getCurrentEntry();
  if (!entry) return;
  const line = entry.structure.lines[state.lineIndex];
  if (!line) return;
  const rowHeight = state.rowHeight || 0;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  let label = "↔";
  let forbidden = false;
  if (absX >= absY) {
    if (absX < 30) {
      label = "↔";
    } else if (dx > 0) {
      if (canIndent(entry, state.lineIndex)) {
        label = "+1";
      } else {
        label = "⛔";
        forbidden = true;
      }
    } else {
      if (canUnindent(line)) {
        label = "-1";
      } else {
        label = "⛔";
        forbidden = true;
      }
    }
  } else {
    if (absY < rowHeight) {
      label = "↕";
    } else if (dy < 0) {
      if (state.lineIndex > 0) {
        label = "⇡";
      } else {
        label = "⛔";
        forbidden = true;
      }
    } else {
      if (state.lineIndex < entry.structure.lines.length - 1) {
        label = "⇣";
      } else {
        label = "⛔";
        forbidden = true;
      }
    }
  }
  setDragIndicator(label, forbidden);
  positionDragIndicator(x, y);
}

function finalizeDrag(x, y) {
  const entry = getCurrentEntry();
  const state = dragState;
  if (!state) return;
  const dx = x - state.startX;
  const dy = y - state.startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const rowHeight = state.rowHeight || 0;
  if (state.started) {
    lastDragTime = Date.now();
    if (absX >= absY && absX >= 30) {
      if (dx > 0 && canIndent(entry, state.lineIndex)) {
        const line = entry.structure.lines[state.lineIndex];
        line.level += 1;
        normalizeLineLevel(entry, state.lineIndex);
        renderStructureTable();
        updateSentenceDone(entry);
        updateProgressFill();
      } else if (dx < 0) {
        const line = entry.structure.lines[state.lineIndex];
        if (canUnindent(line)) {
          line.level = Math.max(1, line.level - 1);
          normalizeLineLevel(entry, state.lineIndex);
          renderStructureTable();
          updateSentenceDone(entry);
          updateProgressFill();
        }
      }
    } else if (absY > absX && absY >= rowHeight) {
      if (dy < 0 && state.lineIndex > 0) {
        mergeLine(entry, state.lineIndex, "up");
      } else if (dy > 0 && state.lineIndex < entry.structure.lines.length - 1) {
        mergeLine(entry, state.lineIndex, "down");
      }
    }
  }
  cancelDrag();
}

function cancelDrag() {
  if (dragState?.textCell) dragState.textCell.classList.remove("isDragging");
  structureTable.classList.remove("isDragging");
  dragState = null;
  hideDragIndicator();
}

function ensureDragIndicator() {
  if (dragIndicator) return;
  dragIndicator = document.createElement("div");
  dragIndicator.className = "dragIndicator";
  document.body.appendChild(dragIndicator);
}

function showDragIndicator(x, y, text) {
  ensureDragIndicator();
  dragIndicator.textContent = text;
  dragIndicator.classList.remove("isForbidden");
  dragIndicator.style.display = "block";
  positionDragIndicator(x, y);
}

function setDragIndicator(text, forbidden) {
  if (!dragIndicator) return;
  dragIndicator.textContent = text;
  dragIndicator.classList.toggle("isForbidden", Boolean(forbidden));
}

function positionDragIndicator(x, y) {
  if (!dragIndicator) return;
  dragIndicator.style.left = `${x}px`;
  dragIndicator.style.top = `${y}px`;
}

function hideDragIndicator() {
  if (!dragIndicator) return;
  dragIndicator.style.display = "none";
  dragIndicator.classList.remove("isForbidden");
}

document.addEventListener("pointerdown", (event) => {
  if (!wordMenuState) return;
  const menu = document.getElementById("wordMenu");
  if (!menu) return;
  if (event.target.closest("#wordMenu")) return;
  if (event.target.closest(".structureWord")) return;
  closeWordMenu();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeWordMenu();
  if (event.key === "Escape") closeSplitMenu();
  if (event.key === "Escape") closeTagMenu();
});

function collectSentenceEntries(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      text: line,
      structure: null,
      done: false,
    }));
}

function initializeSentenceEntries() {
  sentenceEntries.forEach((entry) => {
    if (!entry.structure) entry.structure = null;
    if (typeof entry.done !== "boolean") entry.done = false;
  });
  sentenceIndex = 0;
}

function makeLine(text, tag, level) {
  return {
    text: text || "",
    tag,
    level,
    forward: false,
    dialogue: false
  };
}

function showStructuresPanel() {
  if (!sentenceEntries.length) {
    structureCounter.textContent = "Sentence 0 of 0";
    structureNavStatus.textContent = "No sentences available yet.";
    currentSentenceDisplay.textContent = "";
    structureTable.innerHTML = "<div class=\"panelHint\">Add sentences in the previous step.</div>";
    structurePendingStatus.textContent = "";
    updateStructuresProgressLabel();
    return;
  }
  closeWordMenu();
  closeSplitMenu();
  sentenceIndex = Math.max(0, Math.min(sentenceIndex, sentenceEntries.length - 1));
  updateStructuresProgressLabel();
  renderStructuresPanel();
}

function renderStructuresPanel() {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryStructure(entry);
  structureCounter.textContent = `Sentence ${sentenceIndex + 1} of ${sentenceEntries.length}`;
  structureNavStatus.textContent = entry.done ? "Marked as done." : "Pending structure details.";
  updateStructuresProgressLabel();
  renderSentenceContext();
  renderStructureTable();
  updateSplitTextFromSentences();
  updateProgressFill();
  updateNavState();
}

function renderSentenceContext() {
  const entry = getCurrentEntry();
  if (!entry) return;
  if (currentSentenceText) {
    currentSentenceText.textContent = entry.text;
  } else {
    currentSentenceDisplay.textContent = entry.text;
  }

  const hasPrev = sentenceIndex > 0;
  const hasNext = sentenceIndex < sentenceEntries.length - 1;
  prevSentenceBtn.disabled = !hasPrev;
  nextSentenceBtn.disabled = !hasNext;
  togglePrevContextBtn.checked = showPrevContext;
  toggleNextContextBtn.checked = showNextContext;

  const showPrev = showPrevContext && hasPrev;
  const showNext = showNextContext && hasNext;
  prevSentenceDisplay.hidden = false;
  nextSentenceDisplay.hidden = false;
  prevSentenceDisplay.style.visibility = showPrevContext ? "visible" : "hidden";
  nextSentenceDisplay.style.visibility = showNextContext ? "visible" : "hidden";
  const prevTextEl = prevSentenceDisplay.querySelector(".sentenceContextText");
  const nextTextEl = nextSentenceDisplay.querySelector(".sentenceContextText");
  if (showPrev) {
    prevTextEl.textContent = sentenceEntries[sentenceIndex - 1].text;
    prevTextEl.classList.remove("isPlaceholder");
  } else if (showPrevContext && !hasPrev) {
    prevTextEl.textContent = "(= Beginning of the excerpt =)";
    prevTextEl.classList.add("isPlaceholder");
  } else {
    prevTextEl.textContent = "";
    prevTextEl.classList.remove("isPlaceholder");
  }
  if (showNext) {
    nextTextEl.textContent = sentenceEntries[sentenceIndex + 1].text;
    nextTextEl.classList.remove("isPlaceholder");
  } else if (showNextContext && !hasNext) {
    nextTextEl.textContent = "(= End of the excerpt =)";
    nextTextEl.classList.add("isPlaceholder");
  } else {
    nextTextEl.textContent = "";
    nextTextEl.classList.remove("isPlaceholder");
  }

  fusePrevBtn.style.display = showPrev ? "inline-flex" : "none";
  fuseNextBtn.style.display = showNext ? "inline-flex" : "none";
  splitSentenceBtn.disabled = entry.structure.lines.length < 2;
}

function renderStructureTable() {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryStructure(entry);
  entry._hasIllegalContinuation = false;
  const spacerColors = computeSpacerColors(entry);
  structureTable.innerHTML = "";
  sentenceDialogueToggle.checked = Boolean(entry.structure.dialogue);
  sentenceComment.value = entry.structure.comment || "";

  entry.structure.lines.forEach((line, index) => {
    if (["DC", "PP", "AP"].includes(line.tag) && line.level < 2) {
      line.level = 2;
    }
    const row = document.createElement("div");
    row.className = "structureRow";
    row.dataset.lineIndex = index;
    const isLastRow = index === entry.structure.lines.length - 1;

    const textCell = document.createElement("div");
    textCell.className = "structureCell structureTextCell";
    textCell.dataset.lineIndex = index;
    textCell.dataset.tag = line.tag || "";
    if (isLastRow) textCell.classList.add("isLastRow");
    const spacerWrap = document.createElement("div");
    spacerWrap.className = "structureSpacers";
    buildSpacers(spacerColors[index] || []).forEach((spacer) => spacerWrap.appendChild(spacer));
    const textWrap = document.createElement("div");
    textWrap.className = "structureTextContent";
    const textNodes = buildWordNodes(line.text, index);
    textNodes.forEach((node) => textWrap.appendChild(node));
    textCell.appendChild(spacerWrap);
    textCell.appendChild(textWrap);

    const controlsCell = document.createElement("div");
    controlsCell.className = "structureCell structureControls";
    if (isLastRow) controlsCell.classList.add("isLastRow");

    const mergeCol = document.createElement("div");
    mergeCol.className = "structureMergeCol";

    const controlsStack = document.createElement("div");
    controlsStack.className = "structureControlStack";

    const tagRow = document.createElement("div");
    tagRow.className = "structureControlRow structureControlRowTight";
    tagRow.appendChild(buildTagSelect(line, index));
    const dialogueWrap = buildDialogueToggle(entry, line);
    if (dialogueWrap) tagRow.appendChild(dialogueWrap);
    const forwardWrap = buildForwardToggle(line);
    if (forwardWrap) tagRow.appendChild(forwardWrap);
    controlsStack.appendChild(tagRow);

    const actionRow = document.createElement("div");
    actionRow.className = "structureControlRow";
    const unindentBtn = document.createElement("button");
    unindentBtn.className = "wizardActionBtn structureIndentBtn";
    unindentBtn.type = "button";
    unindentBtn.textContent = "🢀"; // unicode 1F880
    // alternative:
    // ↤ Leftwards Arrow From Bar 21A4
    // 🡐 LEFTWARDS SANS-SERIF ARROW, U+1F850
    // 🠈 LEFTWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD, U+1F808
    // ⭰ LEFTWARDS TRIANGLE-HEADED ARROW TO BAR, U+2B70
    // 🢀 WIDE-HEADED LEFTWARDS VERY HEAVY BARB ARROW, U+1F880
    unindentBtn.disabled = !canUnindent(line);
    unindentBtn.addEventListener("click", () => {
      line.level = Math.max(1, line.level - 1);
      normalizeLineLevel(entry, index);
      renderStructureTable();
      updateSentenceDone(entry);
      updateProgressFill();
    });

    const levelBadge = document.createElement("span");
    levelBadge.className = "structureLevel";
    levelBadge.textContent = String(line.level);

    const indentBtn = document.createElement("button");
    indentBtn.className = "wizardActionBtn structureIndentBtn";
    indentBtn.type = "button";
    indentBtn.textContent = "🢂"; // unicode 1F882
    // Alternaives:
    // ↦ Rightwards Arrow From Bar 21A6
    // 🠊 RIGHTWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD, U+1F80A
    // 🢂 WIDE-HEADED RIGHTWARDS VERY HEAVY BARB ARROW, U+1F882
    indentBtn.disabled = !canIndent(entry, index);
    indentBtn.addEventListener("click", () => {
      line.level = line.level + 1;
      normalizeLineLevel(entry, index);
      renderStructureTable();
      updateSentenceDone(entry);
      updateProgressFill();
    });

    const mergeUpBtn = document.createElement("button");
    mergeUpBtn.className = "wizardActionBtn structureMergeBtn";
    mergeUpBtn.type = "button";
    mergeUpBtn.textContent = "🠝"; // unicode 1F81D
    // alternatives:
    // ↟ Upwards Two Headed Arrow 219F
    // ⯭ UPWARDS TWO-HEADED ARROW WITH TRIANGLE ARROWHEADS, U+2BED
    // ⮬ BLACK CURVED LEFTWARDS AND UPWARDS ARROW, U+2BAC
    // ⮴ RIBBON ARROW RIGHT UP, U+2BB5
    // ⮤ LEFTWARDS TRIANGLE-HEADED ARROW WITH LONG TIP UPWARDS, U+2BA4
    // 🠉UPWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD, U+1F809
    // 🠝 HEAVY UPWARDS ARROW WITH LARGE EQUILATERAL ARROWHEAD, U+1F81D
    mergeUpBtn.disabled = index === 0;
    mergeUpBtn.addEventListener("click", () => mergeLine(entry, index, "up"));

    const mergeDownBtn = document.createElement("button");
    mergeDownBtn.className = "wizardActionBtn structureMergeBtn";
    mergeDownBtn.type = "button";
    mergeDownBtn.textContent = "🠟"; // unicode 1F81F
    // alternative:
    // ↡ Downwards Two Headed Arrow 21A1
    // ⯯  DOWNWARDS TWO-HEADED ARROW WITH TRIANGLE ARROWHEADS, U+2BEF
    // ⮧ RIGHTWARDS TRIANGLE-HEADED ARROW WITH LONG TIP DOWNWARDS, U+2BA7
    // 🠋 DOWNWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD, U+1F80B
    // 🠟 HEAVY DOWNWARDS ARROW WITH LARGE EQUILATERAL ARROWHEAD, U+1F81F
    mergeDownBtn.disabled = index >= entry.structure.lines.length - 1;
    mergeDownBtn.addEventListener("click", () => mergeLine(entry, index, "down"));

    mergeCol.appendChild(mergeUpBtn);
    mergeCol.appendChild(mergeDownBtn);

    actionRow.appendChild(unindentBtn);
    actionRow.appendChild(levelBadge);
    actionRow.appendChild(indentBtn);
    controlsStack.appendChild(actionRow);
    controlsCell.appendChild(mergeCol);
    controlsCell.appendChild(controlsStack);

    const hintCell = document.createElement("div");
    hintCell.className = "structureCell structureHint";
    if (isLastRow) hintCell.classList.add("isLastRow");
    hintCell.textContent = buildTagHint(entry, index);

    row.appendChild(controlsCell);
    row.appendChild(textCell);
    row.appendChild(hintCell);
    structureTable.appendChild(row);
  });

  updateSentenceDone(entry);
  updatePendingStatus(entry);
  updateStructureVisibility(entry);
}

function buildTagSelect(line, index) {
  const select = document.createElement("select");
  const options = getTagOptions(index);
  options.forEach((tag) => {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = tag;
    select.appendChild(opt);
  });
  select.value = line.tag;
  select.addEventListener("change", () => {
    const entry = getCurrentEntry();
    const prevTag = line.tag;
    line.tag = select.value;
    handleTagChange(entry, index, prevTag, line.tag);
    renderStructureTable();
    updateSentenceDone(entry);
    updateStructuresProgressLabel();
    updateProgressFill();
    updateNavState();
  });
  return select;
}

function buildForwardToggle(line) {
  const forwardAllowed = ["DC", "PP", "AP"].includes(line.tag);
  if (!forwardAllowed) {
    line.forward = false;
    return null;
  }
  const forwardWrap = document.createElement("label");
  forwardWrap.className = "structureControlRow";
  const forwardToggle = document.createElement("input");
  forwardToggle.type = "checkbox";
  forwardToggle.checked = Boolean(line.forward);
  forwardToggle.addEventListener("change", () => {
    line.forward = forwardToggle.checked;
    renderStructureTable();
  });
  forwardWrap.appendChild(forwardToggle);
  forwardWrap.appendChild(document.createTextNode("Fwd"));
  return forwardWrap;
}

function buildDialogueToggle(entry, line) {
  const dialogueAllowed = ["IC", "FG"].includes(line.tag) && !entry.structure.dialogue;
  if (!dialogueAllowed) {
    line.dialogue = false;
    return null;
  }
  const dialogueWrap = document.createElement("label");
  dialogueWrap.className = "structureControlRow";
  const dialogueToggle = document.createElement("input");
  dialogueToggle.type = "checkbox";
  dialogueToggle.checked = Boolean(line.dialogue);
  dialogueToggle.addEventListener("change", () => {
    line.dialogue = dialogueToggle.checked;
    renderStructureTable();
  });
  dialogueWrap.appendChild(dialogueToggle);
  dialogueWrap.appendChild(document.createTextNode("Dlg"));
  return dialogueWrap;
}

function getTagOptions(index) {
  if (index === 0) return ["IC", "FG", "??"];
  return ["??", "--", "IC", "FG", "DC", "PP", "AP", "CP", "AT"];
}

function handleTagChange(entry, index, prevTag, nextTag) {
  const line = entry.structure.lines[index];
  if (!line) return;
  if (index === 0) {
    line.level = 1;
    line.forward = false;
    return;
  }
  if (prevTag === "??" || prevTag === "--") {
    if (nextTag === "CP" || nextTag === "--") {
      line.level = getParentLevel(entry, index);
    } else {
      line.level = getParentLevel(entry, index) + 1;
    }
    if (["DC", "PP", "AP"].includes(nextTag) && line.level < 2) {
      line.level = 2;
    }
    return;
  }
  if (prevTag !== "CP" && nextTag === "CP") {
    line.level = getParentLevel(entry, index);
  }
  if (prevTag === "CP" && nextTag !== "CP") {
    line.level = getParentLevel(entry, index) + 1;
  }
  if (["DC", "PP", "AP"].includes(nextTag) && line.level < 2) {
    line.level = 2;
  }
  if (nextTag !== "DC" && nextTag !== "PP" && nextTag !== "AP") {
    line.forward = false;
  }
}

function getParentLevel(entry, index) {
  const prev = entry.structure.lines[index - 1];
  return prev ? prev.level : 1;
}

function buildTagHint(entry, index) {
  const line = entry.structure.lines[index];
  if (!line) return "";
  const parts = [];
  if (index === 0 && entry.structure.dialogue) parts.push("(Dialogue line)");
  if (line.dialogue) parts.push("Dialogue quote:");
  if (line.forward) parts.push("Forward");
  if (line.tag === "??") {
    return `${parts.join(" ")}${parts.length ? " " : ""}Define the type of the sentence part/clause.`;
  }
  if (line.tag === "--") {
    const ref = findPreviousTagAtLevel(entry, index, line.level);
    const base = ref ? `Continuation of ${ref}.` : "Continuation.";
    const prev = entry.structure.lines[index - 1];
    if (!prev || prev.level === 1 || line.level >= prev.level) {
      entry._hasIllegalContinuation = true;
      return `${parts.join(" ")}${parts.length ? " " : ""}${base} Illegal continuation line.`;
    }
    return `${parts.join(" ")}${parts.length ? " " : ""}${base}`;
  }
  const label = window.SSE_APP?.tags?.getLabel ? window.SSE_APP.tags.getLabel(line.tag) : "";
  const base = label || "Define the clause type.";
  return `${parts.join(" ")}${parts.length ? " " : ""}${base}`;
}

function findPreviousTagAtLevel(entry, index, level) {
  for (let i = index - 1; i >= 0; i--) {
    const line = entry.structure.lines[i];
    if (line.level === level && line.tag && line.tag !== "--" && line.tag !== "??") {
      return line.tag;
    }
  }
  return "";
}

function buildWordNodes(text, lineIndex) {
  const nodes = [];
  const raw = String(text || "");
  if (!raw.trim()) {
    const empty = document.createElement("span");
    empty.className = "structureEmpty";
    empty.textContent = "(= empty start =)";
    nodes.push(empty);
    return nodes;
  }
  let lastIndex = 0;
  const re = /\S+/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    let spanStart = match.index;
    while (spanStart > 0 && /\s/.test(raw[spanStart - 1])) spanStart -= 1;
    if (spanStart > 0 && raw[spanStart - 1] === "—" && !/\s/.test(raw[spanStart - 2] || "")) {
      spanStart -= 1;
    }
    if (spanStart > lastIndex) {
      nodes.push(document.createTextNode(raw.slice(lastIndex, spanStart)));
    }
    const span = document.createElement("span");
    span.className = "structureWord";
    span.textContent = raw.slice(spanStart, match.index + match[0].length);
    span.dataset.lineIndex = lineIndex;
    span.dataset.wordStart = String(spanStart);
    span.dataset.wordEnd = String(match.index + match[0].length);
    nodes.push(span);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < raw.length) {
    nodes.push(document.createTextNode(raw.slice(lastIndex)));
  }
  return nodes;
}

function buildSpacers(colors) {
  const spacers = [];
  const list = Array.isArray(colors) ? colors : [];
  for (let i = 0; i < list.length; i++) {
    const spacer = document.createElement("div");
    spacer.className = "structureSpacer";
    spacer.style.background = list[i] || "transparent";
    spacers.push(spacer);
  }
  return spacers;
}

function computeSpacerColors(entry) {
  const lines = entry?.structure?.lines || [];
  const colorsByLine = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const level = Math.max(1, line.level || 1);
    const prevColors = i > 0 ? (colorsByLine[i - 1] || []) : [];
    const colors = [];
    for (let j = 0; j < level - 1; j++) {
      colors[j] = prevColors[j] || "transparent";
    }
    let ownColor = "transparent";
    if (line.tag === "--" || line.tag === "CP") {
      ownColor = prevColors[level - 1] || "transparent";
    } else if (line.tag !== "??") {
      const tagKey = window.SSE_APP?.tags?.resolveTagKey
        ? window.SSE_APP.tags.resolveTagKey(line.tag, Boolean(line.forward))
        : line.tag;
      const palette = window.SSE_APP?.tags?.defs?.[tagKey]?.palette || [];
      ownColor = palette[0] || "transparent";
    }
    colors[level - 1] = ownColor;
    colorsByLine[i] = colors;
  }
  return colorsByLine;
}

function updatePendingStatus(entry) {
  const pending = entry.structure.lines.filter((line) => line.tag === "??").length;
  const { noneDefined, pendingCount, doneCount, total } = getStructureSummary();
  if (pending === 0) {
    if (doneCount === total && total > 0) {
      structurePendingStatus.textContent = "Current sentence done? / Excerpt structures done?";
    } else {
      const parts = [`${noneDefined} sentences have no structure defined at all`];
      if (pendingCount > 0) parts.push(`${pendingCount} have pending structure`);
      structurePendingStatus.textContent = `Current sentence done? / Excerpt: ${parts.join(", ")}.`;
    }
    return;
  }
  const parts = [`${noneDefined} sentences have no structure defined at all`];
  if (pendingCount > 0) parts.push(`${pendingCount} have pending structure`);
  structurePendingStatus.textContent = `Current sentence: ${pending} line(s) tagged ?? / Excerpt: ${parts.join(", ")}.`;
}

function updateSentenceDone(entry) {
  entry.done = entry.structure.lines.every((line) => line.tag !== "??") && !entry._hasIllegalContinuation;
}

function updateStructureVisibility(entry) {
  const alwaysShow = Boolean(alwaysShowControlsToggle?.checked);
  const showHints = Boolean(clauseHintsToggle?.checked);
  const hasUnknown = entry.structure.lines.some((line) => line.tag === "??");
  const hasIssue = Boolean(entry._hasIllegalContinuation);
  const showControls = alwaysShow || hasUnknown || hasIssue;
  structureTable.classList.toggle("hideControls", !showControls);
  structureTable.classList.toggle("hideHints", !showHints);
}

function applyResponsiveDefaults() {
  const narrow = window.innerWidth <= 640;
  if (alwaysShowControlsToggle) {
    alwaysShowControlsToggle.checked = !narrow;
  }
  if (clauseHintsToggle) {
    clauseHintsToggle.checked = !narrow;
  }
}

function getStructureSummary() {
  const total = sentenceEntries.length;
  let noneDefined = 0;
  let pendingCount = 0;
  let doneCount = 0;
  sentenceEntries.forEach((entry) => {
    if (!entry.structure || !entry.structure.lines || entry.structure.lines.length === 0) {
      noneDefined += 1;
      return;
    }
    const lines = entry.structure.lines;
    const allUnknown = lines.every((line) => line.tag === "??");
    if (allUnknown) {
      noneDefined += 1;
      return;
    }
    if (entry.done) {
      doneCount += 1;
    } else {
      pendingCount += 1;
    }
  });
  return { noneDefined, pendingCount, doneCount, total };
}

function allSentencesDone() {
  return sentenceEntries.length > 0 && sentenceEntries.every((entry) => entry.done);
}

function getCurrentEntry() {
  return sentenceEntries[sentenceIndex] || null;
}

function moveSentence(direction) {
  const nextIndex = sentenceIndex + direction;
  if (nextIndex < 0 || nextIndex >= sentenceEntries.length) return;
  closeWordMenu();
  closeSplitMenu();
  sentenceIndex = nextIndex;
  saveWizardDraft({ panelIndex: 4 });
  updateStructuresProgressLabel();
  renderStructuresPanel();
}

function updateStructuresProgressLabel() {
  const step = progressSteps[3];
  if (!step) return;
  const labelEl = step.querySelector(".progressLabel");
  const total = sentenceEntries.length;
  const doneCount = sentenceEntries.filter((entry) => entry.done).length;
  labelEl.textContent = total ? `Structures ${doneCount}/${total}` : "Structures";
}

function toggleContext(which) {
  if (which === "prev") {
    showPrevContext = togglePrevContextBtn.checked;
  } else {
    showNextContext = toggleNextContextBtn.checked;
  }
  renderSentenceContext();
}

function fuseWithContext(which) {
  const entry = getCurrentEntry();
  if (!entry) return;
  if (which === "prev") {
    if (sentenceIndex === 0) return;
    if (!window.confirm("Fuse the current sentence with the previous one?")) return;
    const merged = mergeEntries(sentenceEntries[sentenceIndex - 1], entry);
    sentenceEntries.splice(sentenceIndex - 1, 2, merged);
    sentenceIndex = sentenceIndex - 1;
  } else {
    if (sentenceIndex >= sentenceEntries.length - 1) return;
    if (!window.confirm("Fuse the current sentence with the following one?")) return;
    const merged = mergeEntries(entry, sentenceEntries[sentenceIndex + 1]);
    sentenceEntries.splice(sentenceIndex, 2, merged);
  }
  showPrevContext = false;
  showNextContext = false;
  updateStructuresProgressLabel();
  renderStructuresPanel();
}

function mergeEntries(left, right) {
  const merged = {
    text: mergeTexts(left.text, right.text),
    structure: {
      lines: mergeLines(left.structure.lines, right.structure.lines),
      dialogue: left.structure.dialogue || right.structure.dialogue,
      comment: [left.structure.comment, right.structure.comment].filter(Boolean).join(" ")
    },
    done: false
  };
  updateSentenceDone(merged);
  return merged;
}

function mergeLines(leftLines, rightLines) {
  const rightCopy = rightLines.map((line, idx) => {
    const text = idx === 0 ? String(line.text || "").replace(/^\s+/, "") : line.text;
    return { ...line, text };
  });
  return [...leftLines, ...rightCopy];
}

function mergeTexts(left, right) {
  const leadMatch = String(left || "").match(/^\s+/);
  const lead = leadMatch ? leadMatch[0] : "";
  const leftTrim = String(left || "").trim();
  const rightTrim = String(right || "").trim();
  const core = [leftTrim, rightTrim].filter(Boolean).join(" ");
  return lead + core;
}

function splitSentenceAtLine(lineIndex) {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryStructure(entry);
  const firstLines = entry.structure.lines.slice(0, lineIndex + 1);
  const secondLines = entry.structure.lines.slice(lineIndex + 1).map((line) => ({
    ...line,
    tag: "??",
    level: 1,
    forward: false,
    dialogue: false
  }));
  const firstEntry = {
    text: joinSentenceLines(firstLines),
    structure: {
      lines: firstLines,
      dialogue: entry.structure.dialogue,
      comment: entry.structure.comment
    },
    done: false
  };
  const secondEntry = {
    text: joinSentenceLines(secondLines),
    structure: {
      lines: secondLines,
      dialogue: false,
      comment: ""
    },
    done: false
  };
  updateSentenceDone(firstEntry);
  updateSentenceDone(secondEntry);
  sentenceEntries.splice(sentenceIndex, 1, firstEntry, secondEntry);
  sentenceIndex = sentenceIndex;
  showPrevContext = false;
  showNextContext = false;
  updateStructuresProgressLabel();
  renderStructuresPanel();
}

function joinSentenceLines(lines) {
  let out = "";
  lines.forEach((line) => {
    const seg = line.text || "";
    if (!seg) return;
    if (!out) {
      out = seg;
      return;
    }
    if (/\s$/.test(out) || /^\s/.test(seg)) {
      out += seg;
    } else {
      out += " " + seg;
    }
  });
  return out;
}

function updateSplitTextFromSentences() {
  if (!sentenceEntries.length) return;
  splitTextWorking = sentenceEntries.map((entry) => entry.text).join("\n");
  if (sentenceSplitInput) {
    sentenceSplitInput.value = splitTextWorking;
    renderSplitPreview(splitTextWorking);
  }
}

function canUnindent(line) {
  if (line.level > 2) return true;
  if (line.level === 2) {
    return ["IC", "FG", "--", "??"].includes(line.tag);
  }
  return false;
}

function canIndent(entry, index) {
  if (index === 0) return false;
  const line = entry.structure.lines[index];
  const prev = entry.structure.lines[index - 1];
  if (!prev) return false;
  if (line.tag === "--") return line.level < prev.level - 1;
  return line.level <= prev.level;
}

function normalizeLineLevel(entry, index) {
  const line = entry.structure.lines[index];
  if (!line) return;
  if (index === 0) {
    line.level = 1;
    return;
  }
  const prev = entry.structure.lines[index - 1];
  if (!prev) return;
  const maxLevel = prev.level + 1;
  if (line.level > maxLevel) line.level = maxLevel;
  if (line.level < 1) line.level = 1;
}

function openWordMenu(x, y, lineIndex, wordStart, wordEnd, token) {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryStructure(entry);
  const line = entry.structure.lines[lineIndex];
  if (!line) return;
  ensureWordMenu();
  const menu = document.getElementById("wordMenu");
  const beforeBtn = menu.querySelector("[data-action='before']");
  const afterBtn = menu.querySelector("[data-action='after']");
  const cancelBtn = menu.querySelector("[data-action='cancel']");
  const tagBtn = menu.querySelector("[data-action='tagging']");
  beforeBtn.innerHTML = `New clause before <em>${escapeHtml(token)}</em>`;
  afterBtn.innerHTML = `New clause after <em>${escapeHtml(token)}</em>`;

  const text = String(line.text || "");
  const beforeIndex = findBeforeSplitIndex(text, wordStart);
  const afterIndex = findAfterSplitIndex(text, wordEnd);
  const prevLine = entry.structure.lines[lineIndex - 1];
  const prevSameEmpty = prevLine && prevLine.level === line.level && prevLine.text.trim().length === 0;
  const canBefore = beforeIndex >= 0;
  const canAfter = text.slice(afterIndex).trim().length > 0;
  beforeBtn.disabled = !canBefore || (beforeIndex === 0 && prevSameEmpty);
  afterBtn.disabled = !canAfter;

  beforeBtn.onclick = () => {
    splitLineAtIndex(lineIndex, beforeIndex, "before");
    closeWordMenu();
  };
  afterBtn.onclick = () => {
    splitLineAtIndex(lineIndex, afterIndex, "after");
    closeWordMenu();
  };
  cancelBtn.onclick = () => closeWordMenu();
  tagBtn.onclick = () => {
    closeWordMenu();
    openTagMenu(x, y, lineIndex);
  };

  menu.style.left = `${x + 8}px`;
  menu.style.top = `${y + 8}px`;
  menu.classList.remove("hidden");
  const backdrop = document.getElementById("wordMenuBackdrop");
  if (backdrop) backdrop.classList.remove("hidden");
  wordMenuState = { lineIndex, wordStart, wordEnd };
}

function ensureWordMenu() {
  let menu = document.getElementById("wordMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "wordMenu";
    menu.className = "wordMenu hidden";
    const beforeBtn = document.createElement("button");
    beforeBtn.dataset.action = "before";
    const afterBtn = document.createElement("button");
    afterBtn.dataset.action = "after";
    const tagBtn = document.createElement("button");
    tagBtn.dataset.action = "tagging";
    tagBtn.textContent = "Tagging…";
    const cancelBtn = document.createElement("button");
    cancelBtn.dataset.action = "cancel";
    cancelBtn.textContent = "Cancel";
    menu.appendChild(beforeBtn);
    menu.appendChild(afterBtn);
    menu.appendChild(tagBtn);
    menu.appendChild(cancelBtn);
    document.body.appendChild(menu);
    menu.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      if (btn.dataset.action === "cancel") {
        event.preventDefault();
        closeWordMenu();
      }
    });
  }

  let backdrop = document.getElementById("wordMenuBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "wordMenuBackdrop";
    backdrop.className = "wordMenuBackdrop hidden";
    backdrop.addEventListener("click", () => closeWordMenu());
    document.body.appendChild(backdrop);
  }
}

function closeWordMenu() {
  const menu = document.getElementById("wordMenu");
  if (menu) menu.classList.add("hidden");
  const backdrop = document.getElementById("wordMenuBackdrop");
  if (backdrop) backdrop.classList.add("hidden");
  wordMenuState = null;
}

function ensureTagMenu() {
  let menu = document.getElementById("menuTag");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "menuTag";
    menu.className = "sentenceMenu hidden";
    menu.innerHTML = `
      <div class="sentenceMenuTitle">
        <span>Change Tag</span>
        <button class="sentenceMenuClose" type="button" aria-label="Close">×</button>
      </div>
      <div class="menuTagList"></div>
    `;
    document.body.appendChild(menu);
    const closeBtn = menu.querySelector(".sentenceMenuClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTagMenu();
      });
    }
    menu.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  let backdrop = document.getElementById("menuTagBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "menuTagBackdrop";
    backdrop.className = "wordMenuBackdrop hidden";
    backdrop.addEventListener("click", () => closeTagMenu());
    document.body.appendChild(backdrop);
  }
  return menu;
}

function openTagMenu(x, y, lineIndex) {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryStructure(entry);
  const line = entry.structure.lines[lineIndex];
  if (!line) return;
  const menu = ensureTagMenu();
  const list = menu.querySelector(".menuTagList");
  list.innerHTML = "";

  const defs = window.SSE_APP?.tags?.defs || {};
  const allowedTags = getTagOptions(lineIndex).filter((tag) => tag !== "??" && tag !== "--");
  allowedTags.forEach((key) => {
    const item = document.createElement("button");
    item.className = "sentenceMenuItem menuTagItem";
    const hint = shortenTagHint(defs[key]?.label || "");
    item.innerHTML = `<span class="menuTagLabel">${key}</span><span class="menuTagHint"> - ${escapeHtml(hint)}</span>`;
    item.addEventListener("click", () => {
      const prevTag = line.tag;
      line.tag = key;
      handleTagChange(entry, lineIndex, prevTag, line.tag);
      renderStructureTable();
      updateSentenceDone(entry);
      updateStructuresProgressLabel();
      updateProgressFill();
      updateNavState();
      closeTagMenu();
    });
    list.appendChild(item);
  });

  const contItem = document.createElement("button");
  contItem.className = "sentenceMenuItem menuTagItem";
  contItem.innerHTML = `<span class="menuTagLabel">--</span><span>Continuation text</span>`;
  contItem.addEventListener("click", () => {
    const prevTag = line.tag;
    line.tag = "--";
    handleTagChange(entry, lineIndex, prevTag, line.tag);
    renderStructureTable();
    updateSentenceDone(entry);
    updateStructuresProgressLabel();
    updateProgressFill();
    updateNavState();
    closeTagMenu();
  });
  list.appendChild(contItem);

  const allowDialogue = ["IC", "FG"].includes(line.tag) && !entry.structure.dialogue;
  if (allowDialogue) {
    const dlgItem = document.createElement("button");
    dlgItem.className = "sentenceMenuItem menuTagOption";
    dlgItem.innerHTML = `<span class="menuTagBox">${line.dialogue ? "☑" : "☐"}</span><span>Dialogue</span>`;
    dlgItem.addEventListener("click", () => {
      line.dialogue = !line.dialogue;
      renderStructureTable();
      closeTagMenu();
    });
    list.appendChild(dlgItem);
  }

  const allowForward = ["DC", "PP", "AP"].includes(line.tag);
  if (allowForward) {
    const fwdItem = document.createElement("button");
    fwdItem.className = "sentenceMenuItem menuTagOption";
    fwdItem.innerHTML = `<span class="menuTagBox">${line.forward ? "☑" : "☐"}</span><span>Forward ref.</span>`;
    fwdItem.addEventListener("click", () => {
      line.forward = !line.forward;
      renderStructureTable();
      closeTagMenu();
    });
    list.appendChild(fwdItem);
  }

  menu.classList.remove("hidden");
  const backdrop = document.getElementById("menuTagBackdrop");
  if (backdrop) backdrop.classList.remove("hidden");

  menu.style.left = "0px";
  menu.style.top = "0px";
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    const maxX = window.scrollX + window.innerWidth - rect.width - pad;
    const maxY = window.scrollY + window.innerHeight - rect.height - pad;
    const nextX = Math.max(window.scrollX + pad, Math.min(x, maxX));
    const nextY = Math.max(window.scrollY + pad, Math.min(y, maxY));
    menu.style.left = `${nextX}px`;
    menu.style.top = `${nextY}px`;
  });
  tagMenuState = { lineIndex };
}

function shortenTagHint(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const idx = raw.toLowerCase().indexOf(" or ");
  if (idx === -1) return raw;
  return `${raw.slice(0, idx + 4)}…`;
}

function closeTagMenu() {
  const menu = document.getElementById("menuTag");
  if (menu) menu.classList.add("hidden");
  const backdrop = document.getElementById("menuTagBackdrop");
  if (backdrop) backdrop.classList.add("hidden");
  tagMenuState = null;
}

function ensureEntryStructure(entry) {
  if (!entry.structure || !entry.structure.lines || entry.structure.lines.length === 0) {
    entry.structure = {
      lines: [makeLine(entry.text, "IC", 1)],
      dialogue: false,
      comment: ""
    };
  }
  enforceFirstLineIC(entry);
}

function enforceFirstLineIC(entry) {
  if (!entry?.structure?.lines?.length) return;
  const first = entry.structure.lines[0];
  if (!first.tag || first.tag === "??") first.tag = "IC";
  first.level = 1;
}

function findBeforeSplitIndex(text, wordStart) {
  let idx = wordStart;
  while (idx > 0 && /\s/.test(text[idx - 1])) idx -= 1;
  return idx;
}

function findAfterSplitIndex(text, wordEnd) {
  const space = text[wordEnd];
  const punct = text[wordEnd + 1];
  const space2 = text[wordEnd + 2];
  if (space === " " && /[,:;.!?]/.test(punct || "") && space2 === " ") {
    return wordEnd + 2;
  }
  return wordEnd;
}

function splitLineAtIndex(lineIndex, splitIndex, direction) {
  const entry = getCurrentEntry();
  if (!entry) return;
  const line = entry.structure.lines[lineIndex];
  if (!line) return;
  const text = String(line.text || "");
  if (splitIndex < 0 || splitIndex > text.length) return;
  const leftText = text.slice(0, splitIndex);
  const rightText = text.slice(splitIndex);
  const prevEmpty = lineIndex > 0 && entry.structure.lines[lineIndex - 1].text.trim().length === 0;
  if (direction === "before") {
    if (leftText.trim().length === 0 && prevEmpty) return;
    if (!rightText.trim()) return;
    const newLine = makeLine(leftText, line.tag, line.level);
    line.text = rightText;
    entry.structure.lines.splice(lineIndex, 0, newLine);
  } else {
    if (!rightText.trim()) return;
    line.text = leftText;
    const newLine = makeLine(rightText, line.tag, line.level);
    entry.structure.lines.splice(lineIndex + 1, 0, newLine);
  }
  enforceFirstLineIC(entry);

  entry.text = joinSentenceLines(entry.structure.lines);
  updateSentenceDone(entry);
  renderStructuresPanel();
}

function openSplitMenu() {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryStructure(entry);
  if (entry.structure.lines.length < 2) return;
  closeWordMenu();
  ensureSplitMenu();
  const menu = document.getElementById("splitMenu");
  const list = menu.querySelector(".splitMenuList");
  list.innerHTML = "";

  const addCancel = () => {
    const btn = document.createElement("button");
    btn.className = "splitMenuItem isAction";
    btn.textContent = "Cancel";
    btn.addEventListener("click", () => closeSplitMenu());
    list.appendChild(btn);
  };

  addCancel();

  entry.structure.lines.forEach((line, idx) => {
    const quote = document.createElement("div");
    quote.className = "splitMenuItem isQuote";
    quote.textContent = getLinePreview(line.text);
    list.appendChild(quote);

    if (idx < entry.structure.lines.length - 1) {
      const splitBtn = document.createElement("button");
      splitBtn.className = "splitMenuItem isAction";
      splitBtn.textContent = "Split here";
      splitBtn.disabled = shouldDisableSplitAt(entry, idx);
      splitBtn.addEventListener("click", () => {
        closeSplitMenu();
        splitSentenceAtLine(idx);
      });
      list.appendChild(splitBtn);
    }
  });

  addCancel();

  menu.classList.remove("hidden");
  const backdrop = document.getElementById("splitMenuBackdrop");
  if (backdrop) backdrop.classList.remove("hidden");
  splitMenuState = { sentenceIndex };

  menu.style.left = "0px";
  menu.style.top = "0px";
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const btnRect = splitSentenceBtn.getBoundingClientRect();
    const pad = 8;
    const maxX = window.scrollX + window.innerWidth - rect.width - pad;
    const maxY = window.scrollY + window.innerHeight - rect.height - pad;
    const nextX = Math.max(window.scrollX + pad, Math.min(window.scrollX + btnRect.left, maxX));
    const nextY = Math.max(window.scrollY + pad, Math.min(window.scrollY + btnRect.bottom + 6, maxY));
    menu.style.left = `${nextX}px`;
    menu.style.top = `${nextY}px`;
  });
}

function shouldDisableSplitAt(entry, idx) {
  if (idx <= 0) return false;
  for (let i = 0; i < idx; i++) {
    if (entry.structure.lines[i].text.trim().length > 0) return false;
  }
  return true;
}

function getLinePreview(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "(empty line)";
  return trimmed.length > 25 ? `${trimmed.slice(0, 25)}…` : trimmed;
}

function ensureSplitMenu() {
  let menu = document.getElementById("splitMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "splitMenu";
    menu.className = "splitMenu hidden";
    const list = document.createElement("div");
    list.className = "splitMenuList";
    menu.appendChild(list);
    document.body.appendChild(menu);
  }
  let backdrop = document.getElementById("splitMenuBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "splitMenuBackdrop";
    backdrop.className = "splitMenuBackdrop hidden";
    backdrop.addEventListener("click", () => closeSplitMenu());
    document.body.appendChild(backdrop);
  }
}

function closeSplitMenu() {
  const menu = document.getElementById("splitMenu");
  if (menu) menu.classList.add("hidden");
  const backdrop = document.getElementById("splitMenuBackdrop");
  if (backdrop) backdrop.classList.add("hidden");
  splitMenuState = null;
}

function mergeLine(entry, index, direction) {
  if (direction === "up") {
    if (index <= 0) return;
    const prev = entry.structure.lines[index - 1];
    const current = entry.structure.lines[index];
    prev.text = joinText(prev.text, current.text);
    entry.structure.lines.splice(index, 1);
  } else {
    if (index >= entry.structure.lines.length - 1) return;
    const current = entry.structure.lines[index];
    const next = entry.structure.lines[index + 1];
    current.text = joinText(current.text, next.text);
    entry.structure.lines.splice(index + 1, 1);
  }
  sanitizeLevels(entry);
  enforceFirstLineIC(entry);
  entry.text = joinSentenceLines(entry.structure.lines);
  updateSentenceDone(entry);
  renderStructuresPanel();
}

function joinText(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a) return b;
  if (!b) return a;
  if (/\s$/.test(a) || /^\s/.test(b)) return a + b;
  return `${a} ${b}`;
}

function sanitizeLevels(entry) {
  if (!entry || !entry.structure) return;
  const lines = entry.structure.lines;
  if (!lines.length) return;
  lines[0].level = 1;
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const line = lines[i];
    if (line.level > prev.level + 1) line.level = prev.level + 1;
    if (["DC", "PP", "AP"].includes(line.tag) && line.level < 2) line.level = 2;
    if (line.tag === "--") {
      if (line.level >= prev.level) {
        line.level = Math.max(1, prev.level - 1);
      }
    }
    if (line.level < 1) line.level = 1;
  }
}
