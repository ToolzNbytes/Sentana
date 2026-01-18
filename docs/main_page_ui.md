# Main Page UI Overview

This note captures the visible structure of the main tool page so future features
can align with the existing layout and interaction flow.

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
- Top Panel: choose the excerpt to process and display.
- Explorer Area: detailed information about the hovered sentence SVG, and excerpt
  info when nothing is hovered; includes a button to access the excerpt's text.
- Result Panel: builds the series of SVGs that render the selected excerpt.

### Explorer Area button
- `.plus-btn`: open the dive-in panel (`#plusModal`).

### Top Panel details
- Left side: Work Details (`#workDetails`) showing the main metadata for the
  currently selected excerpt.
- Right side: excerpt selection list for processing and rendering.
  - Source toggles: `corpusRemoteBtn` and `corpusLocalBtn` select the remote or
    local list.
  - Filter button (above the toggles): for filtering the remote list only.
