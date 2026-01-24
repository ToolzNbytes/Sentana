# Main Page UI Overview

This note captures the visible structure of the main tool page so future features
can align with the existing layout and interaction flow.

## Module map (JS)
- `Sv4/ui_main.js`: main UI wiring, corpus loading, filter panel, modals, store/collapse, settings.
- `Sv4/svg_render.js`: SVG construction, hover/highlight, sentence display updates.
- `Sv4/deconstruct.js`: deconstruction feature + context menus.
- `Sv4/tag_registry.js`: tag metadata (labels + palettes/patterns) and shared helpers.
- `Sv4/sse_common.js`: parsing + storage utilities shared by pages.
- Shared state / APIs live in `window.SSE_APP` (single container). Legacy globals
  (`SSE_TAGS`, `SSE_UTIL`, `SSE_CONFIG`, `SSE_SVG`, `SSE_DECON`, `SSE_UI`, `SSE_STORAGE`)
  are still assigned for compatibility but should not be used in new code.

## Top Bar (`.topbar`)
- Center: tool name + subtitle, responsive and can compress to the minimum when the
  page width shrinks.
- Left and right: top interface buttons.

### Top Bar buttons (left to right)
- `#collapseBtn`: hide the main workspace (only if there is at least one `.copyR`).
- `#storeBtn`: copy the current rendering into a new `.copyR` container on the right.
- `#helpBtn`: open the user guide (HTML page).
- `#localDataBtn`: open the Local Corpus Management page (`local_corpus.html`).
- `#settingsBtn`: open the settings panel for visual rendering.

## Workspace (`#workspace`)
The main container below the Top Bar. It sits inside the `#workspaces` container.

When a copy of the rendered visual is made, it is a `.copyR` section that is a
sibling of the workspace wrapper and is placed to the right. Several `.copyR`
sections can be added on the right of the primary workspace inside `#workspaces`.

The primary workspace is always present but it can be collapsed (hidden) to only show the copies.

### Zones inside the workspace
- Excerpt Selector: choose the excerpt to process and display.
- Explorer Area: detailed information about the hovered sentence SVG, and excerpt
  info when nothing is hovered; includes a button to access the excerpt's text.
- Result Panel: builds the series of SVGs that render the selected excerpt, one per sentence.
- Deconstruction Panel: (optional) sits below the result panel and hosts the sentence deconstruction controls.

### Explorer Area button
- `#excerptSourceBtn`: open the excerpt source panel (`#excerptSourcePnl`).

### Excerpt Source Panel (`#excerptSourcePnl`)
Default view shows the analyzed sentences with custom structural syntax. Buttons:
- Switch to original Excerpt (replace panel content with the original text).
- Copy to clipboard.
- Clone to local corpus (copy metadata + analyzed text into browser local corpus).
- Close (also dismisses by clicking outside).

When showing the original text, only two buttons are available:
- Switch to structural analysis (return to default view).
- Copy to clipboard.

### Excerpt Selector details (`#excerptSelector`)
- Left side: Work Details (`#workDetails`) showing the main metadata for the
  currently selected excerpt.
- Right side: excerpt selection list for processing and rendering.
  - Source toggles: `corpusRemoteBtn` and `corpusLocalBtn` select the remote or
    local list.
  - Filter button (above the toggles): for filtering the remote list only.

## Settings panel
Adjustable parameters:
- Word cap: number of words before a sentence SVG uses full width.
- Bar height: root SVG height for deep nesting with few words.
- Bg color: convenience for screenshots.
- Display width: custom width (inherited value) for showing several copies.

Buttons:
- Cancel.
- Validate & Process (apply parameters to current workspace).
