# Third-party notices

## Open-Prism

- Project: **Open-Prism** — open-source AI LaTeX writing workspace with live preview
- Source: <https://github.com/assistant-ui/open-prism>
- Author: assistant-ui
- License: MIT

The Source view's tokenizer follows the node classes of `codemirror-lang-latex` (the lezer grammar
Open-Prism's editor uses): control sequences, environment names, sectioning commands, comments,
brackets, math and optional arguments each get one class. Its colors were sampled from the Codex
LaTeX preview: `#a892e8` commands, `#e5c07b` environments, `#e0a575` optional arguments, `#56b6c2`
math, `#6b7481` comments on `#0f1113`. No third-party highlighter is bundled.

This DeepSeek Harness plugin brings the *same idea* into DSH: an AI writes LaTeX, the workspace
compiles it and shows a living preview instead of plain source. The compile-then-preview pipeline
(TeX Live → PDF → page preview) follows what Open-Prism documents for `apps/latex-api` and
`apps/web`. This package is an independent reimplementation for the DSH sidebar and shares no
source files with the upstream project; it is not an official assistant-ui product.

The upstream MIT license is reproduced below to accompany the attribution above.

```
MIT License

Copyright (c) 2026 assistant-ui

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Runtime tools this plugin drives (not bundled)

The plugin invokes programs already installed on the user's machine; it redistributes none of them.

- **TeX Live** (pdfTeX, XeTeX, LuaTeX, latexmk) — LPPL and friends, see
  <https://www.tug.org/texlive/>.
- **Ghostscript** (`gs`), used to rasterize PDF pages — AGPL-3.0, see
  <https://www.ghostscript.com/licensing/>.
