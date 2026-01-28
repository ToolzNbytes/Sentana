# New Tool: Analyze New Excerpt Wizard

## Overall context
This document is part of the Sentana repository. Read `AGENTS.md` first for the overall project context and working constraints; it is important to know before implementing this tool.

## Goal
Provide a guided, step-by-step helper tool that takes a raw excerpt and produces a fully analyzed text (structure notation + tags + comments), then stores it in the local corpus or downloads it as a file. This tool should guide the user through metadata capture, text preparation, sentence handling, structural splitting, tagging, commenting, and verification.

This document is meant as working context for implementing the tool in this repository. Note that the repo path contains spaces, so use quotes in shell commands.

## Location and shared utilities
- New page path: `Sv4/analyze_new_excerpt.html` (under `Sentana-GIT/Sentana/`).
- Reuse utilities where relevant, especially:
  - `Sv4/tag_registry.js` for tag labels/palettes.
  - `Sv4/sse_common.js` for structure validation and any parsing helpers (see `Sv4/local_corpus.js` for how validation is performed).
- The new tool has its own HTML/CSS/JS files, but may share common assets/utilities.

## Chosen UI approach
Wizard stepper, responsive and smartphone-compatible. The UI shows only the current panel, with clear "Next" and "Back" navigation, and a progress indicator.

Key requirements:
- Panels 5, 6, and 7 loop per sentence, so the user repeats those panels for each sentence before advancing.
- The loop must allow sentence merge/split corrections without losing work.
- The tool must be compatible with narrow screens.
- Keep copy and UI hints to explain what each step does and why it matters.
- Remote corpus submission is not included in this tool. Keep a reminder/incentive placeholder for a later version.

## Metadata fields (from local corpus manager)
The metadata fields mirror the local corpus entry format:
- Work (Title) [required]
- Author [required]
- Year(s) of writing
- Choice (what part from where)
- Language (ISO)
- Tags
- Entry comment

These are the same fields as the local corpus management page in `Sv4/local_corpus.html` and are used by `Sv4/local_corpus.js` when storing entries.

## Panels and steps
Panels are the wizard screens. Steps are the tasks inside each panel.

1) Start a new analysis
   - Welcome and scope of the tool
   - Quick overview of the workflow and expected output

2) Excerpt metadata
   - Capture Work, Author, Year, Choice, Language, Tags, Comment
   - Explain how metadata impacts corpus filtering and file headers

3) Text input
   - Paste raw excerpt
   - Optional: merge hard-wrapped lines into proper paragraphs (auto-suggested if detected)
   - Confirm or reconstruct paragraph boundaries

4) Sentence segmentation
   - Split text into sentences
   - Review and adjust sentence boundaries
   - Enable re-splitting before entering the per-sentence loop

5) Structures (per sentence, loop)
   - Structural split of the current sentence
   - Apply tags to the sentence structure elements
   - Add comments for the current sentence or clauses
   - Provide visual aids or clause drag/snap helpers if possible

6) Final checks
   - Validate the analyzed text format
   - Highlight warnings and jump to the problematic sentence
   - Confirm overall readiness

7) Store or save
   - Save to local corpus (browser storage)
   - Export a text file for later inclusion in the remote corpus
   - Reminder placeholder about future remote corpus submission (no action yet)

## Looping behavior for panel 5
The wizard progression is:
1, 2, 3, 4, (5) x N sentences, 6, 7.

Loop requirements:
- Show progress within the excerpt, such as "Sentence 4 of 12".
- Allow "merge with previous" or "split this sentence" actions inside the loop.
- If a merge/split occurs, update the sentence list and re-index the loop without losing completed sentence work (best-effort preservation).
- Provide a quick way to jump back to the sentence segmentation panel if major corrections are needed.

## Notes and reminders
- Keep Unicode glyphs intact in existing files; avoid introducing mojibake.
- The final analyzed text must follow the corpus file format described in `docs/corpus_entry_format.md`.
- The tool should reuse parsing and validation logic from `sse_common.js` where possible.
- No automated tests exist in this repo, so keep validation visible in the UI.
- Structures panel implementation notes: see `docs/wizard_structures_panel.md`.

## Storage behavior (updates)
- Provide the usual local corpus entry addition (same storage used by the local corpus manager).
- Also provide a special `DraftExcerpt` storage:
  - A unique fixed entry in the local corpus (single slot), potentially with extra JSON data.
  - There will be a special main-tool URL variant that, when used, opens this draft directly in the main tool.
