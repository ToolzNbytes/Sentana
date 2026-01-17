# Refactor suggestions for syntax growth

Focus: make it easier to add new tags and syntax cases without destabilizing parsing or rendering.

- Parser is monolithic with shared mutable state; consider splitting into a small tokenizer + parse step so new tokens or block types do not require touching multiple nested branches. (`Sentana/Sv4/sse_common.js:61`)
- Node schema is duplicated for root, paren nodes, bracket nodes, and leaves; introduce a small node factory/helper to keep structure changes in one place. (`Sentana/Sv4/sse_common.js:103`, `Sentana/Sv4/sse_common.js:140`, `Sentana/Sv4/sse_common.js:173`, `Sentana/Sv4/sse_common.js:205`)
- Syntax handling is hard-coded to "(", ")", "[", "]", and indentation rules; a token handler map or light state machine would scale better if cases double. (`Sentana/Sv4/sse_common.js:117`)
- Header parsing is rigid (`[A-Z]{2}\d+` with optional refs); if tag shapes expand, adjust the regex or move parsing to a more flexible tag parser. (`Sentana/Sv4/sse_common.js:87`)
- Rendering uses hard-coded tag-to-style logic in `pickFill`; move that mapping into a data table/config so new tags are mostly data additions. (`Sentana/Sv4/structure_display_v4.js:620`)
- Default tag comments live in a static map; keep it in sync with any new tags or consider loading a shared tag definition table for both parser and renderer. (`Sentana/Sv4/structure_display_v4.js:42`)
