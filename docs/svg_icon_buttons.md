# SVG Icon Buttons

This note captures the current SVG icon button patterns in Sentana and the
agreed conventions to avoid size, offset, and crop issues.

## 1) Prepare the SVG file (manual edit once)
When adding a new icon from a library, edit the SVG file to match these two requirements:

- Use `currentColor` for fill and/or stroke so the icon inherits button color.
- Add `id="icon"` on the root `<svg>` element (this is the fragment we reference via `<use>`).

Example (root line):
```html
<svg id="icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
```

## 2) Standard HTML usage
Use a wrapper `<svg>` and a `<use>` reference, always with `#icon`:

```html
<svg class="icon" aria-hidden="true">
  <use href="../icons/scissors_cut.svg#icon" width="100%" height="100%" x="0" y="0"></use>
</svg>
```

## 3) Current button patterns

1) Top bar icon buttons
```html
<button class="button iconBtn" aria-label="Help">
  <svg class="icon" aria-hidden="true"><use href="../icons/manual_help.svg#icon"></use></svg>
</button>
```
CSS: `Sv4/structure_display_v4.css` (`.button`, `.iconBtn`, `.topbar .iconBtn`)

Notes:
- Standard size: 40x40, padding 6.
- Uses `.iconBtn` with a top bar override (border transparent at rest, icon fills the button).

2) General icon buttons (corpus switch, local corpus controls)
```html
<button class="button iconBtn" aria-label="Local corpus">
  <svg class="icon" aria-hidden="true"><use href="../icons/hard-drive.svg#icon"></use></svg>
</button>
```
CSS: `Sv4/structure_display_v4.css` (`.iconBtn`, `.iconBtn svg`)

Notes:
- Standard size: 40x40, padding 6.
- Icon wrapper is 22x22.

3) Wizard square icon buttons (analyze_new_excerpt)
```html
<button class="wizardActionBtn iconSquareBtn" aria-label="Split sentence">
  <svg class="icon" aria-hidden="true">
    <use href="../icons/scissors_cut.svg#icon" width="100%" height="100%" x="0" y="0"></use>
  </svg>
</button>
```
CSS: `Sv4/analyze_new_excerpt.css` (`.iconSquareBtn`, `.iconSquareBtn > svg.icon`, `.iconSquareBtn > svg.icon > use`)

Notes:
- Bordered 40x40 buttons in this page.
- Icon wrapper is 22x22.
- `<use>` is forced to fill the wrapper (fixes 16x16 sources rendering too small).

4) Non-square example (excerpt source button)
```html
<!-- Non-square icon button: width set inline, height stretches with the row. -->
<button class="button iconBtnNonStandard" id="excerptSourceBtn" style="width:36px">
  <svg class="icon" aria-hidden="true"><use href="../icons/dive-in_doc.svg#icon"></use></svg>
</button>
```
CSS: `Sv4/structure_display_v4.css` (`.iconBtnNonStandard`)

Notes:
- Use `.iconBtnNonStandard` when the button should stretch in height to match its row.
- Set the width inline per instance (keeps this exception explicit).

## 4) Responsive sizing
We standardize 40x40 for desktop. On small screens (phones), we keep 40x40 but
reduce padding slightly:

```css
@media (max-width: 640px){
  .iconBtn,
  .topbar .iconBtn{
    width: 40px;
    height: 40px;
    padding: 5px;
  }
  .iconBtnNonStandard{
    padding: 5px;
  }
}
```

## 5) Compact variants (non-square)
Planned compact variants for tighter layouts:

- `.iconSmallWideBtn` (short and wide, 32x25)
- `.iconSmallNarrowBtn` (tall and narrow, 25x32)

These should be used as modifiers alongside `.iconBtn` or `.iconBtnNonStandard`.

```css
.iconSmallWideBtn{
  width: 32px;
  height: 25px;
  padding: 3px;
  border-radius: 8px;
}
.iconSmallNarrowBtn{
  width: 25px;
  height: 32px;
  padding: 3px;
  border-radius: 8px;
}
.iconSmallWideBtn svg,
.iconSmallNarrowBtn svg{
  width: 18px;
  height: 18px;
}
```

## 6) Hover border behavior
All icon buttons share the same hover effect:
- background highlight via `var(--hlBtn)`
- brighter border via `var(--iconBorderHover)`
- top bar buttons keep a transparent border at rest, but show the border on hover

## 7) corpusFilterBtn reminder
`#corpusFilterBtn.hasFilter` uses a thicker dashed border to stand out.
If it ever feels jumpy, consider an `outline` or `box-shadow` to avoid layout shifts.

## 8) Troubleshooting checklist
If an icon looks offset or cropped:
- Confirm the SVG file has `id="icon"` and `fill="currentColor"` (or `stroke="currentColor"`).
- Make sure the `<use>` includes `width="100%" height="100%" x="0" y="0"` (or the CSS equivalent).
- Ensure the wrapper `<svg class="icon">` has explicit width and height (22x22).
- If the button is not square, check for missing `iconSquareBtn` or flex shrink.
