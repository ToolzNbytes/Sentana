# Parsing and SVG Construction Notes

This note summarizes how the custom text syntax is parsed into a tree and how the SVG visualization is built from that tree.

## Parsing flow (sse_common.js)
- Entry point: `parseAnalyzedText(...)` splits the analyzed text into sentences and analysis blocks.
- Each analysis block is parsed by `parseAnalysisBlock()` into a tree of nodes.
- Nodes represent either tagged constituents (created from lines starting with `(` or `[`) or plain text leaves (lines without a tag).
- The parser tracks indentation (via leading `~`) and bracket/parenthesis balance to structure the tree.
- Each node includes:
  - `tag`, `id`, `ref`, `forward` from the header (if present).
  - `dialogue` and `dialogueId` when the header uses the `@` marker.
  - `text` for the node’s own text.
  - `nodes` array for children.
  - word/char counts: `wCount`, `cCount`, plus aggregate `wTreeCount`, `cTreeCount`.
  - text slices built later: `textSoFar`, `textTree`, `textAfter`.
  - positions: `wPos`, `cPos` (1-based offsets into the reconstructed sentence).
- `walkCounts(...)` computes aggregate counts and `maxLevel`.
- `buildTextIndex(...)` reconstructs the full sentence (`textTree` for root) and fills:
  - `textSoFar`, `textTree`, `textAfter` for each node.
  - `wPos` (word position based on `textSoFar`) and `cPos` (character position).
- Dialogue marker handling:
  - If a level‑1 IC/FG node carries `@`, the root gets `tree.dialogueRoot = true`.
  - `#@id: Name` comment lines are currently ignored (reserved for future use).

## SVG construction (svg_render.js)
- `createAnalysisSVG(tree, cap)` renders one SVG per sentence tree.
- The width of a rect is proportional to the node’s word count (`wTreeCount`) and scaled by `cap`.
- The vertical margins depend on node level, creating nested “stacked” bars.
- `pickFill(...)` maps tags to colors/patterns (IC/DC/PP/etc.) via `tag_registry.js`.
- When `tree.dialogueRoot` is true, the outer root rect uses the dialogue root fill.
- Any node with `@` at level 2+ is rendered with a dashed white stroke.
- `renderSVGs(...)` loops over parsed sentences and mounts each SVG into `.result-panel`.

## Hover highlight summary
- Hovering an SVG rect calls `setHoveringDisplay(...)` which updates the sentence area.
- HL1 highlights the full `textTree`.
- HL1b (child text overlay) is added for tagged child nodes.
- HL2 is applied via invisible spacer rects that map to a node’s “own text” segments (more efficient than cursor tracking).
