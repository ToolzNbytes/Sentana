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

## How to run
No build step. Since it uses dynamic loading, serve the folder with a static server, for example:

```bash
python -m http.server
```

Then visit `http://localhost:8000`.

## Notes
- There are no automated tests in this repo.
- Keep edits focused on the static assets and the HTML/CSS/JS in `Sv4/structure_display_v4.html` unless you are updating the welcome page.
- The welcome `index.html` page must stay robust and use independent assets; avoid coupling it to main page revisions.
