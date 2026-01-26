const panels = Array.from(document.querySelectorAll(".wizardPanel"));
const progressSteps = Array.from(document.querySelectorAll(".progressStep"));
const wizardStatus = document.getElementById("wizardStatus");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const headerBackBtn = document.getElementById("headerBackBtn");

const textSteps = Array.from(document.querySelectorAll(".textStep"));
const textStepLabel = document.getElementById("textStepLabel");
const rawExcerpt = document.getElementById("rawExcerpt");
const joinLinesBtn = document.getElementById("joinLinesBtn");
const joinLinesMsg = document.getElementById("joinLinesMsg");
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
const togglePrevContextBtn = document.getElementById("togglePrevContextBtn");
const toggleNextContextBtn = document.getElementById("toggleNextContextBtn");
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
let sentenceEntries = [];
let sentenceIndex = 0;
let showPrevContext = false;
let showNextContext = false;
let wordMenuState = null;

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
    return;
  }
  if (assessLineBreaks(text)) {
    joinLinesMsg.textContent = "Looks like hard-wrapped lines. Joining could help restore paragraphs.";
  } else {
    joinLinesMsg.textContent = "Line breaks look intentional. Join lines only if the source was hard-wrapped.";
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
    nextBtn.textContent = "Start";
    nextBtn.disabled = false;
    return;
  }

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
  if (panelIndex === 2) {
    if (textStepIndex < textSteps.length - 1) {
      showTextStep(textStepIndex + 1);
      return;
    }
    sourceText = cleanExcerpt(rawExcerpt.value);
    rawExcerpt.value = sourceText;
    sourceLocked = true;
    showPanel(3);
    return;
  }
  if (panelIndex === 3) {
    sentenceEntries = collectSentenceEntries(sentenceSplitInput.value);
    initializeSentenceEntries();
    showPanel(4);
    return;
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

rawExcerpt.addEventListener("input", () => {
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
togglePrevContextBtn.addEventListener("click", () => toggleContext("prev"));
toggleNextContextBtn.addEventListener("click", () => toggleContext("next"));
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
sentenceComment.addEventListener("input", () => {
  const entry = getCurrentEntry();
  if (!entry) return;
  entry.structure.comment = sentenceComment.value;
});

structureTable.addEventListener("click", (event) => {
  const word = event.target.closest(".structureWord");
  if (!word) return;
  const lineIndex = Number(word.dataset.lineIndex);
  const wordStart = Number(word.dataset.wordStart);
  const wordEnd = Number(word.dataset.wordEnd);
  const token = word.textContent || "";
  openWordMenu(event.clientX, event.clientY, lineIndex, wordStart, wordEnd, token);
});

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
  currentSentenceDisplay.textContent = entry.text;

  const hasPrev = sentenceIndex > 0;
  const hasNext = sentenceIndex < sentenceEntries.length - 1;
  prevSentenceBtn.disabled = !hasPrev;
  nextSentenceBtn.disabled = !hasNext;
  togglePrevContextBtn.disabled = !hasPrev;
  toggleNextContextBtn.disabled = !hasNext;

  togglePrevContextBtn.textContent = showPrevContext ? "Hide previous" : "Show previous";
  toggleNextContextBtn.textContent = showNextContext ? "Hide following" : "Show following";

  const showPrev = showPrevContext && hasPrev;
  const showNext = showNextContext && hasNext;
  prevSentenceDisplay.hidden = !showPrev;
  nextSentenceDisplay.hidden = !showNext;
  if (showPrev) {
    prevSentenceDisplay.querySelector(".sentenceContextText").textContent = sentenceEntries[sentenceIndex - 1].text;
  } else {
    prevSentenceDisplay.querySelector(".sentenceContextText").textContent = "";
  }
  if (showNext) {
    nextSentenceDisplay.querySelector(".sentenceContextText").textContent = sentenceEntries[sentenceIndex + 1].text;
  } else {
    nextSentenceDisplay.querySelector(".sentenceContextText").textContent = "";
  }

  fusePrevBtn.style.display = showPrev ? "inline-flex" : "none";
  fuseNextBtn.style.display = showNext ? "inline-flex" : "none";
}

function renderStructureTable() {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryStructure(entry);
  structureTable.innerHTML = "";
  sentenceDialogueToggle.checked = Boolean(entry.structure.dialogue);
  sentenceComment.value = entry.structure.comment || "";

  entry.structure.lines.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "structureRow";
    row.dataset.lineIndex = index;

    const textCell = document.createElement("div");
    textCell.className = "structureCell structureTextCell";
    textCell.style.paddingLeft = `${10 + Math.max(0, line.level - 1) * 18}px`;

    const textNodes = buildWordNodes(line.text, index);
    textNodes.forEach((node) => textCell.appendChild(node));

    const controlsCell = document.createElement("div");
    controlsCell.className = "structureCell structureControls";
    const tagRow = document.createElement("div");
    tagRow.className = "structureControlRow structureControlRowTight";
    tagRow.appendChild(buildTagSelect(line, index));
    const dialogueWrap = buildDialogueToggle(entry, line);
    if (dialogueWrap) tagRow.appendChild(dialogueWrap);
    controlsCell.appendChild(tagRow);

    const toggleRow = document.createElement("div");
    toggleRow.className = "structureControlRow";

    const forwardWrap = buildForwardToggle(line);
    if (forwardWrap) toggleRow.appendChild(forwardWrap);
    controlsCell.appendChild(toggleRow);

    const actionRow = document.createElement("div");
    actionRow.className = "structureControlRow";
    const unindentBtn = document.createElement("button");
    unindentBtn.className = "wizardActionBtn structureIndentBtn";
    unindentBtn.type = "button";
    unindentBtn.textContent = "←";
    unindentBtn.disabled = !canUnindent(line);
    unindentBtn.addEventListener("click", () => {
      line.level = Math.max(1, line.level - 1);
      normalizeLineLevel(entry, index);
      renderStructureTable();
      updateSentenceDone(entry);
      updateProgressFill();
    });

    const indentBtn = document.createElement("button");
    indentBtn.className = "wizardActionBtn structureIndentBtn";
    indentBtn.type = "button";
    indentBtn.textContent = "→";
    indentBtn.disabled = !canIndent(entry, index);
    indentBtn.addEventListener("click", () => {
      line.level = line.level + 1;
      normalizeLineLevel(entry, index);
      renderStructureTable();
      updateSentenceDone(entry);
      updateProgressFill();
    });

    const splitBtn = document.createElement("button");
    splitBtn.className = "wizardActionBtn";
    splitBtn.type = "button";
    splitBtn.textContent = "Split";
    splitBtn.style.display = index === 0 ? "none" : "inline-flex";
    splitBtn.addEventListener("click", () => splitSentenceAtLine(index));

    actionRow.appendChild(unindentBtn);
    actionRow.appendChild(indentBtn);
    actionRow.appendChild(splitBtn);
    controlsCell.appendChild(actionRow);

    const hintCell = document.createElement("div");
    hintCell.className = "structureCell structureHint";
    hintCell.textContent = buildTagHint(entry, index);

    row.appendChild(controlsCell);
    row.appendChild(textCell);
    row.appendChild(hintCell);
    structureTable.appendChild(row);
  });

  updateSentenceDone(entry);
  updatePendingStatus(entry);
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
  });
  forwardWrap.appendChild(forwardToggle);
  forwardWrap.appendChild(document.createTextNode("Forward"));
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
    return;
  }
  if (prevTag !== "CP" && nextTag === "CP") {
    line.level = getParentLevel(entry, index);
  }
  if (prevTag === "CP" && nextTag !== "CP") {
    line.level = getParentLevel(entry, index) + 1;
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
  if (line.tag === "??") return "Define the type of the sentence part/clause.";
  if (line.tag === "--") {
    const ref = findPreviousTagAtLevel(entry, index, line.level);
    return ref ? `Continuation of ${ref}.` : "Continuation.";
  }
  const label = window.SSE_APP?.tags?.getLabel ? window.SSE_APP.tags.getLabel(line.tag) : "";
  return label || "Define the clause type.";
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
  let lastIndex = 0;
  const re = /\S+/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(document.createTextNode(raw.slice(lastIndex, match.index)));
    }
    const span = document.createElement("span");
    span.className = "structureWord";
    span.textContent = match[0];
    span.dataset.lineIndex = lineIndex;
    span.dataset.wordStart = String(match.index);
    span.dataset.wordEnd = String(match.index + match[0].length);
    nodes.push(span);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < raw.length) {
    nodes.push(document.createTextNode(raw.slice(lastIndex)));
  }
  return nodes;
}

function updatePendingStatus(entry) {
  const pending = entry.structure.lines.filter((line) => line.tag === "??").length;
  const { noneDefined, pendingCount, doneCount, total } = getStructureSummary();
  if (pending === 0) {
    if (doneCount === total && total > 0) {
      structurePendingStatus.textContent = "Current sentence done? / Excerpt structures done?";
    } else {
      structurePendingStatus.textContent = `Current sentence done? / Excerpt: ${noneDefined} sentences have no structure defined at all, ${pendingCount} have pending structure.`;
    }
    return;
  }
  structurePendingStatus.textContent = `Current sentence: ${pending} line(s) tagged ?? / Excerpt: ${noneDefined} sentences have no structure defined at all, ${pendingCount} have pending structure.`;
}

function updateSentenceDone(entry) {
  entry.done = entry.structure.lines.every((line) => line.tag !== "??");
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
  sentenceIndex = nextIndex;
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
    showPrevContext = !showPrevContext;
  } else {
    showNextContext = !showNextContext;
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
  if (!window.confirm("Split this sentence at the selected line?")) return;
  const firstLines = entry.structure.lines.slice(0, lineIndex);
  const secondLines = entry.structure.lines.slice(lineIndex).map((line) => ({
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
  if (line.tag === "--" && line.level > prev.level) return false;
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
  beforeBtn.textContent = `New clause before ${token}`;
  afterBtn.textContent = `New clause after ${token}`;

  const text = String(line.text || "");
  const beforeIndex = findBeforeSplitIndex(text, wordStart);
  const afterIndex = wordEnd;
  const prevEmpty = lineIndex > 0 && entry.structure.lines[lineIndex - 1].text.trim().length === 0;
  const canBefore = beforeIndex >= 0;
  const canAfter = text.slice(afterIndex).trim().length > 0;
  beforeBtn.disabled = !canBefore || (beforeIndex === 0 && prevEmpty);
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
    const cancelBtn = document.createElement("button");
    cancelBtn.dataset.action = "cancel";
    cancelBtn.textContent = "Cancel";
    menu.appendChild(beforeBtn);
    menu.appendChild(afterBtn);
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

function ensureEntryStructure(entry) {
  if (!entry.structure || !entry.structure.lines || entry.structure.lines.length === 0) {
    entry.structure = {
      lines: [makeLine(entry.text, "IC", 1)],
      dialogue: false,
      comment: ""
    };
  }
}

function findBeforeSplitIndex(text, wordStart) {
  let idx = wordStart;
  while (idx > 0 && /\s/.test(text[idx - 1])) idx -= 1;
  return idx;
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
    const newLine = makeLine(leftText, "??", line.level);
    line.text = rightText;
    entry.structure.lines.splice(lineIndex, 0, newLine);
  } else {
    if (!rightText.trim()) return;
    line.text = leftText;
    const newLine = makeLine(rightText, "??", line.level);
    entry.structure.lines.splice(lineIndex + 1, 0, newLine);
  }

  entry.text = joinSentenceLines(entry.structure.lines);
  updateSentenceDone(entry);
  renderStructuresPanel();
}

