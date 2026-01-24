# JS Refactor Sketch (Sv4)

This document proposes a tidy split of `Sv4/structure_display_v4.js` into focused modules, without behavior changes. It also introduces a shared tag registry for future features.

## Proposed files
- `Sv4/ui_main.js`
  - General UI wiring for the main page (lists, top bar, modals, corpus switching, filter panel, store/collapse).
  - DOM helpers that are not specific to SVG rendering or deconstruction.

- `Sv4/svg_render.js`
  - SVG creation pipeline: geometry, patterns, fill selection, render loop.
  - Hover/highlight sentence display helpers used by SVG events.
  - Any decoration logic (including CP pattern overlays).

- `Sv4/deconstruct.js`
  - Deconstruction feature: sentence menu action, dyn tree building, punctuation handling, dyn rendering, controls and status.

- `Sv4/tag_registry.js` (new shared module)
  - Central tag definitions used by SVG rendering and hover hints.
  - Normal/forward (`XXf`) mapping and per-tag style metadata.
  - Intended for reuse by future features.

- `Sv4/local_corpus.js`
  - Keep as-is for local management page (no split unless it grows).

- `Sv4/sse_common.js`
  - Keep parsing + tree utilities as-is (no new parsing module needed).

## Tag registry sketch (shared)
`Sv4/tag_registry.js` will export a plain object used by other modules:
- Labels for hover hints (short and practical).
- Style metadata: fill type, palette/pattern key, and whether a tag is a decoration.
- Forward mapping rule: `tagKey = node.forward ? tag + "f" : tag`.
This avoids hard-coded per-tag logic in `pickFill` and default comments.

## Block moves (from structure_display_v4.js)
Below are the major sections and their destination:
- **Defaults + prefs** (WORD_CAP, BAR_HEIGHT, RESULT_BG, DISPLAY_WIDTH): `ui_main.js` (prefs still read/written here).
- **Corpus + filtering + list population + switching**: `ui_main.js`.
- **Excerpt source modal + clone to local**: `ui_main.js` (depends on corpus state and parsing).
- **Settings (parameters modal)**: `ui_main.js`.
- **SVG rendering** (`IC_SHADES`/`pickFill`/`createAnalysisSVG`/`renderSVGs`/highlight helpers): `svg_render.js` with palette definitions moved to `tag_registry.js`.
- **Deconstruct feature** (sentence menu action + dyn trees): `deconstruct.js`.
- **Clipboard helper**: keep in `ui_main.js` and re-export or pass into SVG/deconstruct as needed.

## Approximate line counts (target)
Current `structure_display_v4.js`: ~2324 lines.
Estimated split (rough):
- `ui_main.js`: 900–1100 lines
- `svg_render.js`: 600–750 lines
- `deconstruct.js`: 450–600 lines
- `tag_registry.js`: 120–200 lines
These numbers are approximate and depend on how much shared code is extracted.

## Module boundaries & dependencies
- `tag_registry.js` should be dependency-free (pure data + tiny helpers).
- `svg_render.js` depends on tag registry and the main page DOM (sentence area + comment box).
- `deconstruct.js` depends on parsing (`SSE`), SVG rendering helpers, and clipboard.
- `ui_main.js` orchestrates everything, initializes on DOMContentLoaded, and exposes the few shared utilities needed by other modules (or imports them if you prefer a simple global namespace).

## Script loading order (HTML)
For `Sv4/structure_display_v4.html`:
1) `sse_common.js`
2) `tag_registry.js`
3) `svg_render.js`
4) `deconstruct.js`
5) `ui_main.js`

This ensures shared data and helpers are available before the UI bootstraps.

## Notes / decisions already agreed
- Tags in analyzed text remain two-letter only.
- `<` means backward reference (default), `>` means forward reference; internally map forward to `XXf`.
- No special rendering for backward references (only forward exceptions).
- CP remains “decoration” but keeps staking rectangle as the normal nesting, but without the nesting geometry of reduced height;
- CP decoration is a patterned overlay blended with parent via `mix-blend-mode: luminosity`.

## PickFill refactor plan (next)
Goal: make `pickFill(...)` fully data-driven and future-proof for new tags, patterns, and decoration types.

1) **Tag registry shape**
   - Extend `Sv4/tag_registry.js` definitions with a `fill` object per tag key.
   - Example:
     - `fill: { type: "palette", values: ["#..."], blend: "normal" }`
     - `fill: { type: "pattern", values: ["contrast_line1"], opacity: 0.5, blend: "luminosity" }`
   - Keep `resolveTagKey(tag, forward)` as the only “forward” mapping logic.

2) **Generic state counter**
   - Initialize counters from registry keys (no hard-coded per-tag counters).
   - Each tag key advances its own index mod `values.length`.

3) **Rendering adapter**
   - `pickFill(node, state)` returns a normalized spec:
     - `{ type, value, opacity, blend }`
   - SVG render consumes the spec without tag-specific branches.

4) **Defaults + fallback**
   - If a tag has no `fill`, use the neutral fallback fill currently in use.

5) **Acceptance checks**
   - IC/DC/PP/AP/FG colors match current rendering.
   - Forward DC/PP map to `DCf`/`PPf` palettes.
   - CP still uses pattern + luminosity blend overlay.
   - No change to per-sentence color cycling.
