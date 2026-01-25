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

const metaHintTitle = document.getElementById("metaHintTitle");
const metaHintBody = document.getElementById("metaHintBody");

let panelIndex = 0;
let textStepIndex = 0;
let searchIndex = 0;
let lastFoundIndex = -1;

function setStatus(message) {
  wizardStatus.textContent = message;
}

function showPanel(index) {
  panelIndex = Math.max(0, Math.min(index, panels.length - 1));
  panels.forEach((panel, i) => panel.classList.toggle("isActive", i === panelIndex));
  progressSteps.forEach((step, i) => {
    step.classList.toggle("isActive", i === panelIndex);
    step.classList.toggle("isDone", i < panelIndex);
  });
  if (panelIndex === 2) {
    showTextStep(0);
  }
  updateNavState();
}

function showTextStep(index) {
  textStepIndex = Math.max(0, Math.min(index, textSteps.length - 1));
  textSteps.forEach((step, i) => step.classList.toggle("isActive", i === textStepIndex));
  textStepLabel.textContent = `Text prep: ${textStepTitle(textStepIndex)}`;
  if (textStepIndex === 1) {
    updateJoinLinesHint();
  }
  if (textStepIndex === 2) {
    updatePreview();
  }
  updateNavState();
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
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
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
  const alreadySeparated = /\n\s*\n$/.test(before);
  const insert = alreadySeparated ? "" : "\n\n";
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

  if (panelIndex === 0) {
    nextBtn.textContent = "Start";
    nextBtn.disabled = false;
    return;
  }

  if (panelIndex === 2) {
    nextBtn.textContent = textStepIndex === 2 ? "Next (panel 4 soon)" : "Next";
    if (textStepIndex === 0) {
      nextBtn.disabled = !hasRawText();
      return;
    }
    nextBtn.disabled = false;
    return;
  }

  nextBtn.textContent = "Next";
  if (panelIndex === 1) {
    nextBtn.disabled = !hasRequiredMetadata();
    return;
  }
  nextBtn.disabled = false;
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
    setStatus("Panel 4 is not wired yet.");
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
  field.addEventListener("input", updateNavState);
});

showPanel(0);
