# Third-party notices

## Open-Prism

- Project: **Open-Prism** — open-source AI LaTeX writing workspace with live preview
- Source: <https://github.com/assistant-ui/open-prism>
- Author: assistant-ui
- License: MIT

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

## Prism.js

- Project: **Prism** — lightweight, robust syntax highlighting
- Source: <https://prismjs.com/> (<https://github.com/PrismJS/prism>)
- License: MIT

The Client half inlines Prism 1.29's minified core and its LaTeX/TeX grammar so the Source view
highlights `.tex` correctly without a network fetch or a build step. Prism is loaded in manual mode
and only used for `Prism.tokenize()`; it never touches the page DOM.

The Source view's colors were sampled from the Codex LaTeX preview this plugin is modelled on
(a screenshot of Codex rendering a `.tex` file): `#a892e8` for commands, `#e0a575` for optional
arguments, near-white `#e6e8ea` for brace content and section titles, dim italic `#6b7481` for
comments, on a `#0f1113` surface. Prism's grammar is used for tokenization; the optional-argument
run is a post-pass because Prism's `lookbehind` support needs a fixed-length prefix.

```
MIT License

Copyright (c) 2012 Lea Verou

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
