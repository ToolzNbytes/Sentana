# SVG Icon Buttons

This note documents the standard setup for SVG icon buttons in Sentana so we avoid size/offset/crop issues.

## 1) Prepare the SVG file (manual edit once)
When adding a new icon from a library, edit the SVG file to match these two requirements:

- Use `currentColor` for fill and/or stroke so the icon inherits button color.
- Add `id="icon"` on the root `<svg>` element (this is the fragment we reference via `<use>`).

Example (root line):
```html
<svg id="icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
```

## 2) HTML usage
Always embed icons using a wrapper `<svg>` and a `<use>` that fills it:

```html
<button class="wizardActionBtn iconSquareBtn" type="button" aria-label="Split sentence" title="Split sentence">
  <svg class="icon" aria-hidden="true">
    <use href="../icons/scissors_cut.svg#icon" width="100%" height="100%" x="0" y="0"></use>
  </svg>
</button>
```

Notes:
- The `width/height/x/y` on `<use>` forces the referenced SVG to scale to the wrapper.
- This is critical when icon sources have different intrinsic sizes (e.g., 16×16 vs 24×24).

## 3) CSS for square icon buttons
Use a dedicated class for square icon buttons. The current pattern lives in
`Sv4/analyze_new_excerpt.css`:

```css
.iconSquareBtn{
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  max-width: 40px;
  max-height: 40px;
  flex: 0 0 40px; /* prevent flex from shrinking width */
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  font-size: 0;
  line-height: 0;
}

.iconSquareBtn > svg.icon{
  width: 22px;
  height: 22px;
  display: block;
  pointer-events: none;
  overflow: visible;
}

.iconSquareBtn > svg.icon > use{
  width: 100%;
  height: 100%;
  x: 0;
  y: 0;
}
```

Why this works:
- The button stays square even in flex layouts (prevents the 27–28px width bug).
- The wrapper sets a consistent icon box (22×22).
- The `<use>` is forced to fill the wrapper so 16×16 assets no longer render small or offset.

## 4) Troubleshooting checklist
If an icon looks offset or cropped:
- Confirm the SVG file has `id="icon"` and `fill="currentColor"` (or `stroke="currentColor"`).
- Make sure the `<use>` includes `width="100%" height="100%" x="0" y="0"`.
- Ensure the wrapper `<svg class="icon">` has explicit width/height (22×22).
- If the button isn’t square, check for missing `iconSquareBtn` or flex shrink.

