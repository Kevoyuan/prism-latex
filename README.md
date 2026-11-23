# dsh-openprism-latex

**Open-Prism style LaTeX rendering for [DeepSeek Harness](https://github.com/deepseek-ai): the AI writes `.tex`, you read a compiled document.**

Built on the idea behind [**Open-Prism**](https://github.com/assistant-ui/open-prism) — an
open-source AI LaTeX writing workspace with live preview — brought into DSH as a native
document-preview renderer. See [Credits and provenance](#credits-and-provenance).

```
model writes paper.tex  →  ⌘-click the link (or open it in Files)
                        →  right sidebar compiles it with your TeX Live
                        →  pages render inline with fit-width + zoom
                        →  Download PDF, or switch to source in the renderer menu
```

## What it does

DSH already renders PDF, Office, Markdown and images in the right sidebar. This bundle teaches
that pane about `.tex`:

- **Edit where you read.** The Source view is a real editor: type, press **⌘S** (or the save
  symbol), and the pane writes the file and recompiles it — preview and source stay in sync. If
  the file changed on disk meanwhile, the save is refused with a *Changed on disk* banner instead
  of overwriting the other writer.
- **A panel you can find.** The left rail lists the workspace's LaTeX documents, so the feature is
  reachable without already knowing which file to open.
- **A real compile, not a syntax highlighter.** The Host compiles with the local TeX Live
  (`pdflatex` by default, or `xelatex` / `lualatex` / `latexmk`) in the file's own directory, so
  `\input`, `\includegraphics` and relative paths behave exactly as in a local build.
- **Pages, not a blob.** The PDF is rasterized with Ghostscript and shown as a vertical page stack
  with fit-width by default, fixed zoom steps up to 300 %, page count and compile time, and a
  **Download PDF** button.
- **Failures are readable.** A LaTeX error shows the offending message and the compiler log tail in
  the pane, with Retry — no terminal needed.
- **It stays in sync.** The preview is a member of the document pane's file watches, so a new
  version of the file recompiles the page; the pane's own **Reload** button forces a rebuild.
- **Source stays one click away.** The preview's renderer menu keeps **Plain text**, so you can flip
  between the rendered document and the `.tex` source.

## Where it appears

**1. The right sidebar (the main surface).** Opening a `.tex`, `.latex` or `.ltx` file opens a
LaTeX tab in the right sidebar that compiles it and shows the pages — next to the conversation,
where you already look. This tab type claims those files at the `extension` band, so it wins over
the built-in plain-text viewer; the tab chip carries a prism glyph before the file name.

The tab has a **Preview / Source / Side by side** switch in its header — an eye, a pair of code
chevrons and a split-pane symbol, each with an English tooltip — and the rest of the pane follows
the same rule: fit-width, download, refresh and retry are symbols, values stay as short English
text (`3 pages · 0.7 s`). The copy is English only, deliberately terse, like an IDE: Preview shows the compiled pages, Source is an editor on a near-black surface, tokenized by a small LaTeX scanner whose classes
follow `codemirror-lang-latex` (the grammar Open-Prism's editor uses): commands `#a892e8`,
environment names `#e5c07b`, optional arguments `#e0a575`, math `#56b6c2`, comments dim italic,
with tabular line numbers. Colors were sampled from the Codex LaTeX preview. No highlighter
library is bundled and nothing is evaluated at runtime., and Side by side puts the source and
the pages in two independently scrolling halves.

**2. The LaTeX workspace panel.** A prism icon in the far-left rail opens a
panel listing every `.tex`, `.latex` and `.ltx` file in the current session's workspace. Pick one
and it compiles there, with fit-width pages, zoom, page count/compile time and **Download PDF**.
The list follows the conversation you are in and refreshes on demand.

**3. The document-preview renderer (fallback).** In a composition whose preview package exposes
its `documentPreviews` registry, the plugin also registers a LaTeX renderer there, so a `.tex`
file opened by that preview offers *LaTeX document* next to *Plain text*.

## Requirements

The plugin drives tools you already have; nothing is bundled or downloaded at runtime.

| Tool | Version | Notes |
|---|---|---|
| TeX Live | any recent | `pdflatex` is the default engine. `xelatex`, `lualatex` and `latexmk` are used when configured. On macOS, MacTeX's `/Library/TeX/texbin` is found automatically even though GUI apps start with a minimal `PATH`. |
| Ghostscript | 9.x / 10.x | `gs`, used only to rasterize pages for preview. |

If either is missing, the pane says so — it does not fail silently.

## Install

From this directory, with the DSH CLI:

```bash
dsh plugin --profile desktop add /Volumes/SSD/Projects/Code/openprism-latex
```

or in the app: **Plugins → Add plugin → local directory**, then pick this folder. A local
directory is linked, not copied, so later edits here are picked up on the next restart.

Installing adds a new package to the profile, so DSH asks for a **restart** to load both halves
(the compile routes and the browser bundle). After the restart, open any `.tex` file.

The bundle adds two rows: the Host half (`dsh-openprism-latex`) registers the compile routes, and
its `dsh.client` entry loads the renderer into the web UI. Disable either from **Plugins** to turn
the preview off; `.tex` files then fall back to plain text.

## Configuration

Optional, in the profile's `cordis.patch.yml`:

```yaml
- id: dsh-openprism-latex
  name: dsh-openprism-latex
  config:
    engine: xelatex          # pdflatex | xelatex | lualatex | latexmk
    enginePath: /Library/TeX/texbin/xelatex   # optional explicit binary
    ghostscriptPath: /usr/local/bin/gs        # optional explicit binary
    dpi: 144                 # preview raster resolution, 96–300
    maxPages: 50             # page cap per preview
    timeoutMs: 60000         # per compile/rasterize budget
```

The renderer menu stays available for every `.tex` file regardless of configuration.

## How it works

- **Host half** (`src/host.js`) — a Cordis plugin that mounts five loopback HTTP resources on DSH's
  own web server: `GET /api/dsh-openprism-latex/render` (compile → rasterize → JSON pages),
  `GET /api/dsh-openprism-latex/pdf` (the compiled PDF), `GET /api/dsh-openprism-latex/files`
  (the workspace's LaTeX documents), `GET /api/dsh-openprism-latex/source` (one file's text), and
  `POST /api/dsh-openprism-latex/write` (an editor save: bounded body, optional expected version,
  atomic replace). Both are origin-guarded, restricted to
  `.tex`/`.latex`/`.ltx` files inside the session's workspace, and run the engine with
  `-no-shell-escape` under a timeout. Outputs live in a throwaway temp directory; the workspace is
  never written to. A small in-memory cache keyed by path + mtime + engine makes reopening and
  reloading cheap.
- **Client half** (`src/client.js`) — a browser bundle with no build step and no Harness imports.
  It registers a `documentPreviews` implementation for the three suffixes plus its body in the
  `sidebar.right.tab.document` slot, then owns loading: fetch the render route, show progress, keep
  the compiled pages in Blob URLs for the tab's lifetime.

## Limits

- **A minimal editor.** Plain typing, ⌘S save, two-space Tab, and Prism color under the text. No
  multi-cursor, search panel, folding or SyncTeX forward/backward search; files larger than the
  editor cap are shown read-only. Compile artifacts (`\input` siblings) come from the file's
  directory.
- **Raster preview.** Pages are PNGs at the configured DPI, so very high zoom softens letterforms;
  text is not selectable in the pane. **Download PDF** gives you the vector original.
- **One engine per compile**, no bibliography pass orchestration beyond what `latexmk` does
  (BibTeX/Biber runs are part of the `latexmk` engine, not the plain engines).
- **Page cap.** Longer documents preview their first `maxPages` pages; the PDF route still returns
  the whole file.
- Shell escape is always off, so packages that need `\write18` (e.g. `minted`) will not compile.

## Credits and provenance

**Source project: [assistant-ui/open-prism](https://github.com/assistant-ui/open-prism) — MIT.**

Open-Prism is an open-source AI LaTeX writing workspace: Next.js + assistant-ui on the front end, a
Hono "latex-api" that compiles with TeX Live and returns a PDF (`apps/latex-api`), and a browser
preview built on react-pdf. This plugin ports that *idea* — AI-authored LaTeX, compiled and shown
as a living document — into DSH's plugin system, where the renderer slot makes it as native as the
built-in PDF preview. It reuses no upstream source files and is not an official assistant-ui
project; the compile-then-preview pipeline follows what Open-Prism documents.

The upstream MIT license and the licensing of the tools this plugin invokes are reproduced in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

MIT — see [LICENSE](./LICENSE).
