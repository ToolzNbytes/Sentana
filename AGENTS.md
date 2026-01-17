# AGENTS.md

## Project overview
Sentana is a static, client-side web app for exploring sentence structure across authors. The site is served as plain HTML/CSS/JS with assets in folders like `img`, `icons`, and `gen`.

## Repo layout
- `index.html`: main entry point for the site.
- `doc_syntax_v4.md`: documentation for the syntax used by the project.
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
- Keep edits focused on the static assets and the HTML/CSS/JS in `index.html`.
