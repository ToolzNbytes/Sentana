# AGENTS.md

## Project overview
Sentana is a static, client-side web app for exploring sentence structure across authors. The main page asynchronously loads text assets (custom syntax) and processes them in JS to build the data shown in the UI, so local testing requires a simple HTTP server.

## Repo layout
- `index.html`: welcome page, updated occasionally (often by hand).
- `Sv4/structure_display_v4.html`: main app page.
- `gen/texts.meta.json`: metadata compilation from headers of the files in `texts/*.txt`.
- `doc_syntax_v4.md`: a guide for the custom syntax used in the body of the files in `texts/`.
- `img`, `icons`, `texts`, `Sv4`: data and assets used by the UI.
- `gen`: files automatically generated, do not edit here.
- `proto`, `queued`: can be ignored (historical prototype, provisional assets).
- `.github`: repo metadata.
- `docs`: documentation, and more .md for the IA Agents (listed and linked below).

## How to run
No build step. Since it uses dynamic loading, serve the folder with a static server, for example:

```bash
python -m http.server
```

Then visit `http://localhost:8000`.

## More information on the project
- Main page UI structure and buttons: see `docs/main_page_ui.md` (useful when updating UI behavior or layout).
- Parsing and SVG construction overview: see `docs/parse_svg_notes.md`.

## Notes
- The UI uses intentional Unicode glyphs (e.g., em dash, stylized close symbol) in labels/buttons; preserve these and keep file encoding UTF-8.
- Avoid re-encoding files that contain Unicode markers (like the em dash used in text parsing). Keep the literal characters in source, and do not replace them with mojibake sequences.
- The app’s main purpose is the SVG-based visual display of text structure with hover highlights; accessibility compliance is inherently limited for this tool (an alternative would be reading the source texts directly).
- There are no automated tests in this repo.
- Local workflow: work in the `Sentana-GIT` copy and merge changes back to GitHub after local testing.
- Keep edits focused on the static assets and the HTML/CSS/JS in `Sv4/structure_display_v4.html` unless you are updating the welcome page.
- The welcome `index.html` page must stay robust and use independent assets; avoid coupling it to main page revisions.
