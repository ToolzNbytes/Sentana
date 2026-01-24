# Decoration Nodes Notes

This note documents the current understanding of "decoration nodes" in the SVG rendering layer, with emphasis on CP (compound predicate / coordinated parallel constituent) and the intended semantic/visual behavior.

## What "decoration" means here
- A decoration node is a tagged text (like how clauses are tagged) that should not increase perceived nesting in the visualization but instead decorate the parent clause's rectangle.
- CP is the canonical example: semantically at the same level as its parent, visually shown as a decoration rather than as its own nested block.

## Current implementation (as of v4)
- Parsing: CP is a standard two-letter tag in analyzed text. It is parsed as a normal node with its own `level` derived from indentation.
- Rendering: CP uses overlay rectangles with a pattern (currently `contrast_line1..4`) and `mix-blend-mode: luminosity` to combine with the parent solid rectangle.
- Nesting: CP uses the same geometry rules and stacking order as other tags (`node.level` -> vertical margins). The decoration does not add a perceived nesting level, but its SVG elements are stacked as usual atop the parent.

## Intended behavior (per current design goal)
- CP is semantically at the same level as its parent.
- CP should not appear as a nested rectangle; instead, it should decorate the parent's rectangle (e.g., patterned overlay, stripe, or other visual marker).
- The decoration should be visible but should not consume additional vertical space.

## Future expansion notes
- Additional decoration tags may use other SVG patterns with the same kind of blended overlay, or other blending approaches.
- If future decorations overlap, they will blend in the stacking order. There is no special overlap resolution yet.
- CP nodes are hoverable/clickable like other tagged rectangles. If future decoration nodes are purely decorative, this may impact selection and hover behavior and should be revisited.

## Related files
- `Sv4/sse_common.js`: parses tags and builds node levels.
- `Sv4/tag_registry.js`: tag definitions + labels + palettes/patterns.
- `Sv4/svg_render.js`: `pickFill(...)` and `createAnalysisSVG(...)` use `node.level` for vertical geometry.
