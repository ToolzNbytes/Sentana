# Wizard Structures Panel (Panel 5) — Maintenance Notes

This file documents the implemented “Structures” panel in `Sv4/analyze_new_excerpt.html/.js/.css`. Use it as a reference for future maintenance and for the upcoming autosave work.

## Purpose and intent
- Per‑sentence loop to build a *structure model* (not final analyzed text yet).
- Focus: splitting a sentence into structural lines, tagging each line, adjusting nesting (level), optional local flags (Dialogue/Fwd), and comments. Output formatting happens later.
- Must keep sentence list in sync when merges/splits occur, and keep the sentence split panel (`panel 4`) consistent.

## Key data structures (for autosave)
`sentenceEntries` is the core list created from the split panel:
```js
{ text: " sentence…", structure: null, done: false }
```
When a sentence is first displayed in the Structures panel:
```js
entry.structure = {
  lines: [ { text, tag: "IC", level: 1, forward: false, dialogue: false } ],
  dialogue: false,   // sentence-wide
  comment: ""
}
```
Line object fields:
- `text`: raw text fragment (can be empty for “empty start” clauses)
- `tag`: `"IC" | "FG" | "DC" | "PP" | "AP" | "CP" | "AT" | "--" | "??"`
- `level`: integer nesting level (>=1)
- `forward`: boolean for forward reference (DC/PP/AP only)
- `dialogue`: boolean for local dialogue highlight (IC/FG only)

Computed flags used for UI logic:
- `entry.done`: true when no line has `tag === "??"` and no illegal continuation issue.
- `entry._hasIllegalContinuation`: set while building hints when a `--` line is illegal.

These objects are the primary autosave payloads; store/restore them as-is.

## Panel layout and controls
HTML: `Sv4/analyze_new_excerpt.html` panel `data-panel="4"`.

Sections:
1) **Sentence context**  
   - Current sentence + optional previous/next context text.
   - Toggles “Show before/after” persist across sentence navigation.
   - Fuse buttons merge with previous/next sentence.
   - Split button moved into the current sentence row.
2) **Sentence controls**  
   - Show before/after toggles
   - Always show controls (forces column 1 to remain visible)
   - Clause hints (toggle column 3)
   - Sentence-wide Dialogue toggle
3) **Structure table**  
   - Grid-based table with three columns: controls / text / hints.
   - Column hiding uses CSS to keep grid stable (controls/hints hidden via visibility and grid column width 0).
4) **Sentence additions**  
   - Textarea for sentence comment (placeholder only).
5) **Status line** (`#structurePendingStatus`)

## Table rendering and behavior (JS)
Main renderer: `renderStructureTable()`
- Builds rows from `entry.structure.lines`.
- Applies constraints:
  - `DC/PP/AP` must be level >= 2.
  - `--` must be below previous level; marks illegal continuation.
- Recomputes `entry.done` and updates progress bar.
- Updates column visibility based on:
  - `alwaysShowControlsToggle`
  - `clauseHintsToggle`
  - presence of `??` or illegal continuation

### Spacer ribbon (indent replacement)
Text column has a left “ribbon” made of stacked spacers:
```js
computeSpacerColors(entry) -> colors per line
buildSpacers(colors) -> divs (8px wide each)
```
Rules:
- Level N -> N spacers.
- First N-1 spacer colors inherit from previous line’s spacers.
- Nth spacer color comes from the line’s tag palette (tag registry).
- `--` and `CP` inherit the Nth spacer color from the previous line.
- `??` uses transparent.

### Word interaction and splitting
Word spans include the leading space (and em‑dash when attached) so cuts preserve spacing.
Context menu “New clause before/after”:
- Splits current line at computed index.
- New line copies *same tag and level* as current line (before/after only controls the cut position).
- Prevents consecutive empty clause-start lines with same level.

### Tagging menu (#menuTag)
Custom tag menu appears when tapping/clicking inside text cell background or via “Tagging…” from word menu.
Built dynamically on display:
- Tag list mirrors allowed tags for that line (same rules as LOV).
- “-- Continuation text” item (with `--` bold).
- Option toggles: Dialogue / Forward ref. (shown only when allowed).
Menu uses `sentenceMenu` styling, has a backdrop, and closes on selection or outside click.

## Drag & drop (touch + mouse)
Dragging on `.structureTextCell` (but not word spans):
- Horizontal drag (>=30px): indent +1 or unindent −1 (if allowed).
- Vertical drag (>=1 row height): merge up/down (if allowed).
- Visual indicator (`.dragIndicator`) shows `+1`, `-1`, `⇡`, `⇣`, or `⛔`.
- `structureTable.isDragging` disables text selection.

## Merge/split sentence behavior
- **Fuse** merges sentence entries: concatenates text and line arrays (second first line stripped of leading space).
- **Split sentence** via dedicated split menu: splits between line N and N+1, resets tags in second sentence to `??` level 1.
- After any merge/split, `sentenceEntries` and `splitTextWorking` are updated to keep panel 4 consistent.

## Responsive defaults (wide vs narrow)
`applyResponsiveDefaults()` sets:
- Wide: show controls + hints by default.
- Narrow (<=640px): hide controls + hints by default.
Short labels used on narrow screens.

## Files to know
- `Sv4/analyze_new_excerpt.html` — panel markup.
- `Sv4/analyze_new_excerpt.css` — layout, grid, menus, drag indicator.
- `Sv4/analyze_new_excerpt.js` — data model, rendering, menus, drag/merge/split logic.
- `Sv4/tag_registry.js` — tag labels + palettes (used for spacers and tag hints).

## Notes / unusual specs
- Controls and hints columns can be hidden; grid stays stable with zero-width columns (visibility hidden instead of display none).
- Watermark tag in text column is temporary and implemented via `::before` on `.structureTextCell`.
- `entry._hasIllegalContinuation` is set during hint generation; it affects `entry.done` and control visibility.

