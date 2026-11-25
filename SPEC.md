# prism-latex — implementation spec

Goal: a DeepSeek Harness (DSH) **bundle** that renders generated `.tex` files inside the right
sidebar's document preview, the way the built-in PDF / Office previews work. Opening a `.tex`
file compiles it with the machine's TeX Live, rasterizes the PDF pages, and shows a living
document in the preview pane. Inspired by Open-Prism (https://github.com/assistant-ui/open-prism,
MIT); see README and THIRD_PARTY_NOTICES.md.

Package name: `prism-latex`. Version 0.1.0. Plain ESM JavaScript, no build step, no
runtime dependencies. The bundle is installed from this directory with
`plugin_manager install_bundle` (local directory link).

## File ownership (do not edit files outside your assignment)

| File | Owner | Notes |
|---|---|---|
| `src/host.js` | host worker | Host half: compile + rasterize + HTTP routes |
| `src/client.js` | client worker | Client half: document-preview renderer |
| `demo/example.tex` | docs worker | sample document used for verification |
| `package.json`, `cordis.patch.yml`, `locale/*.json`, `icon.svg`, `README.md`, `SPEC.md` | lead | already written, do not modify |

Never edit the DSH profile (`~/.dsh`), never run `pnpm`, never install anything.

## Host half — `src/host.js`

```js
export const inject = ['webServer']          // required services
export function apply(ctx, config = {}) { … } // Cordis plugin entry
```

No `Config` export. Read `config` defensively (it may be `undefined`/partial):

| key | default | meaning |
|---|---|---|
| `engine` | `'pdflatex'` | one of `pdflatex`, `xelatex`, `lualatex`, `latexmk` |
| `enginePath` | resolved | absolute path to the engine binary |
| `ghostscriptPath` | resolved | absolute path to the `gs` binary |
| `dpi` | `144` | raster DPI, clamped to 96–300 |
| `maxPages` | `50` | rasterize at most this many pages |
| `timeoutMs` | `60000` | per compile/rasterize budget |
| `maxSourceBytes` | `4194304` | refuse larger `.tex` sources |
| `cacheEntries` | `8` | in-memory compile cache entries |
| `extraPathDirs` | `[]` | directories prepended to the child `PATH` |

### Executable discovery

GUI-launched apps on macOS get a minimal `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`), so the engine
and Ghostscript must be found by absolute candidate paths, not just `PATH`:

- engine: `config.enginePath`, then `<name>` on `PATH`, then
  `/Library/TeX/texbin/<name>`, `/opt/homebrew/bin/<name>`, `/usr/local/bin/<name>`,
  then the first `/usr/local/texlive/*/bin/*/<name>` and `/opt/homebrew/texlive/*/bin/*/<name>`.
- ghostscript: `config.ghostscriptPath`, then `gs` on `PATH`, then `/opt/homebrew/bin/gs`,
  `/usr/local/bin/gs`, `/usr/bin/gs`.
- Check with `fs.accessSync(path, fs.constants.X_OK)`. Cache the resolved path. Never guess a
  path that does not exist.
- Child env: `PATH` = engine dir + ghostscript dir + `config.extraPathDirs` + the inherited
  `PATH` + `/usr/bin:/bin:/usr/sbin:/sbin`, so TeX helper programs resolve.

### Routes

Register both with `ctx.effect(() => ctx.webServer.register(route))`:

1. `GET /api/prism-latex/render?session=<id>&path=<path>&enginе=<name>`
2. `GET /api/prism-latex/pdf?session=<id>&path=<path>&engine=<name>`

Use the Fetch-style form (GET/HEAD only, which is all we need):

```js
{
  kind: 'exact',
  path: '/api/prism-latex/render',
  resource: async (request) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  }),
}
```

`resource` receives a Fetch `Request`; return a `Response`. Never throw out of it (the webserver
answers 400); catch everything and answer a JSON error.

### Request handling

1. Guard the request: if `request.headers.get('origin')` is present and is neither
   `ctx.webServer.getOrigin()` nor the page origin, answer 403. If
   `sec-fetch-site` is `cross-site` or `same-site`, answer 403. (Desktop forwards requests with
   `origin` and `sec-fetch-site` stripped, so their absence is allowed.)
2. `session` and `path` are required. `path` may be absolute (`/…`, `C:/…`) or relative to the
   session's workspace root; URL-decode query values (`new URL(request.url).searchParams`).
3. Resolve the workspace root: `ctx.inject(['sessions'], …)` is not available in a route
   callback, so resolve lazily per request through optional services:
   `ctx.get('sessions')?.get(sessionId)?.header.cwd` and `ctx.get('sandboxPolicy')?.workspaceRoot`.
   Use the first non-empty root. If no root is available, answer 503
   `{"ok":false,"error":{"code":"no-workspace","message":…}}`.
4. Resolve the absolute target: `path.isAbsolute(path) ? path : path.resolve(root, path)`, then
   `fs.realpathSync` it. Reject (`code: 'forbidden'`, 403) unless the real path is the root itself
   or starts with `root + path.sep`. Reject symlinks that escape the workspace.
   Accept only `.tex`, `.latex`, `.ltx` (case-insensitive) → else `code:'bad-request'`, 400.
   Missing file → `code:'not-found'`, 404.
5. Compile (see below) and rasterize, then answer.

### Compile

Work in `fs.mkdtempSync(path.join(os.tmpdir(), 'prism-latex-'))`; always remove it in
`finally`. Run the compile with `child_process.spawn` (no shell, `windowsHide: true`):

- engine flags: `-interaction=nonstopmode -halt-on-error -file-line-error -no-shell-escape`
  plus `-output-directory=<tmp>` and the absolute `.tex` path; `cwd` = the `.tex` file's directory
  so `\input`, `\graphicspath` and relative image paths resolve.
- `latexmk`: `-pdf -interaction=nonstopmode -halt-on-error -file-line-error -no-shell-escape`,
  `-outdir=<tmp>`, then the `.tex` path (no `-output-directory`).
- Kill on `timeoutMs` (SIGTERM, then SIGKILL after 2 s) and answer `code:'timeout'`.
- Capture stdout+stderr, cap 64 KiB each. Also read `<tmp>/<base>.log` and keep its last 8 KiB.
- Expect `<tmp>/<base>.pdf`. A missing PDF is a failed compile: `code:'latex-error'`, message
  "LaTeX failed to produce a PDF", with `logTail`.
- Parse the log for the first `file:line: message` occurrence (`^(.+?):(\d+): (.+)$`) to fill
  `error.line` and `error.message`; otherwise the message is the first line of the log tail that
  is not `This is …`/`Latexmk:` noise.
- A missing engine binary is `code:'engine-missing'` (HTTP 200, so the client shows guidance).

### Rasterize

Ghostscript, one process, all pages at once:

```
gs -q -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r<dpi>
   -dTextAlphaBits=4 -dGraphicsAlphaBits=4
   -dFirstPage=1 -dLastPage=<maxPages>
   -sOutputFile=<tmp>/page-%04d.png <tmp>/<base>.pdf
```

Failure → `code:'rasterizer-missing'` when `gs` is absent, else `code:'rasterize-failed'`.
Read the produced `page-*.png` files in numeric order; read width/height from each PNG's IHDR
(bytes 16–24, big-endian uint32). Cap the summed PNG bytes at 40 MiB
(`code:'too-large'`).

## Response bodies

`render` (HTTP 200):

```json
{
  "ok": true,
  "version": "1720…-42",
  "engine": "pdflatex",
  "dpi": 144,
  "durationMs": 812,
  "pageCount": 2,
  "truncated": false,
  "pages": [{ "width": 1224, "height": 1584, "png": "<base64 of png bytes>" }],
  "pdfUrl": "api/prism-latex/pdf?session=…&path=…&engine=pdflatex"
}
```

`version` is the source freshness token the compiler saw: `${size}-${mtimeMs}` of the `.tex` file
(an opaque string for the client only). `pages` is ordered. `truncated` is true when the PDF has
more pages than `maxPages` (detect by `gs` output count reaching `maxPages` and the PDF's page
count greater — a `N pages` match in the compile log is acceptable detection; default `false`).

Failure (HTTP 200 for compile/rasterize failures, so the client can show the log):

```json
{ "ok": false, "error": { "code": "latex-error", "message": "…", "line": 12, "logTail": "…" } }
```

`url`/`pdf` route: `application/pdf`, `content-disposition: inline; filename="<base>.pdf"`,
`cache-control: no-store`; body is the compiled PDF (reuse the cache, compile when missing).
Any failure answers JSON with the same error shape and a non-200 status.

## Cache

`Map` keyed by `realpath|mtimeMs|size|engine`, storing `{ version, pdf: Buffer, pages, dpi,
truncated, at }`. LRU-evict beyond `cacheEntries`. Rasterization happens lazily: the `pdf` route
never rasterizes; the `render` route rasterizes only when the cached entry lacks pages at the
requested `dpi`.

## Client half — `src/client.js`

Plain-JS browser bundle in DSH's module-loader shape (no JSX, no bundler, no Harness imports):

```js
window.__ModuleLoader__.load({
  id: 'prism-latex',
  factory(require) {
    const React = require('react')
    // … components …
    return { name: 'prism-latex', inject: ['slots', 'locale', 'documentPreviews'], apply }
  },
})
```

Only `require('react')` is allowed. Never import `@deepseek-ai/*` packages.

### apply(ctx)

```js
ctx.effect(() => ctx.locale.register('prismLatex', { en, zh }))
const t = ctx.locale.bind('prismLatex')
ctx.effect(() => ctx.documentPreviews.register({
  id: 'prism-latex',
  extensions: ['tex', 'latex', 'ltx'],
  priority: 'extension',          // ranks above the builtin "Plain text" renderer
  title: () => t('title'),        // e.g. "LaTeX document"
  loading: 'renderer',            // this renderer owns loading
  wrap: false,
}))
ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
  name: 'sidebar.right.tab.document',
  key: 'prism-latex',     // same id as the registration above
  locale: 'prismLatex',
}, LatexBody)))
```

Locale dictionaries: at least `title`, plus every visible string (see UI text below) in English
and Simplified Chinese.

### Body props (all supplied by the host slot framework)

- `useTabInfo()` → `{ tab: { id, signal, … } }` (`tab.signal` is an `AbortSignal` for the tab).
- `content` → `{ kind: 'renderer', revision, loaded(version), failed(), reload() }` when the owner
  selected this renderer. Return `null` when `content.kind !== 'renderer'`.
- `useResource(address)` → `{ value?: { version, absolutePath, bytes? } }` for the file.
  `value?.version` is the opaque freshness token to hand back to `content.loaded(version)`.
- `resourceAddress` → `dsh-resource://file/session/<sessionId>/<encodedPath>`; parse it yourself:
  strip the `dsh-resource://file/session/` prefix, split the remainder on `/`,
  `decodeURIComponent` each segment, the first is the session id, the rest joined by `/` is the
  path. Return `undefined` when the address is not a session file address.
- `scrollportRef(node)` → attach to the scrolling element you own.
- `sessionId`, `t` are also available.

### Loading protocol

```
useEffect on [content.revision, resourceAddress]:
  controller = new AbortController(); signal = AbortSignal.any([controller.signal, tab.signal])
  fetch(`api/prism-latex/render?session=…&path=…&engine=…`, { signal, cache: 'no-store' })
  ok  → convert pages to Blob URLs, setState ready, content.loaded(resource.value?.version ?? version)
  err → setState error, content.failed()
  cleanup → controller.abort(), revoke Blob URLs
```

Never call `loaded()`/`failed()` for a superseded revision or after abort. Show the compiling
state until the request settles. Retry button → `content.reload()` (the owner bumps `revision`,
which re-runs the effect).

### UI

The pane is the right sidebar's document area; the built-in document toolbar (file name, renderer
dropdown, Reload) sits above it. Body = one column:

1. **Compiling** — centered spinner (CSS animation, disabled under
   `prefers-reduced-motion: reduce`) + the localized “Compiling LaTeX…” label, `role="status"`.
2. **Error** — `role="alert"`; the localized message; the compiler log tail in a monospace block
   (max-height 240px, scrollable, `white-space: pre-wrap`); a Retry button.
3. **Ready** — a vertical stack of page images, 12px gaps, 12px outer padding, page shadows,
   centered; plus a floating pill at the bottom center with: zoom out, percentage label
   (`Fit` when fitting), zoom in, Fit-width button, a page-count label, the compile time
   (e.g. `2 pages · 0.8 s`), and a Download PDF button.
   - Fit width is the default: each page renders at `width: 100%` of the pane (minus padding),
     never upscaled above its intrinsic CSS width.
   - Fixed zoom steps: 0.5, 0.75, 1, 1.25, 1.5, 2, 3. Fixed width =
     `(pngWidth / dpi) * 96 * zoom` CSS px.
   - Download PDF fetches `data.pdfUrl`, makes a Blob URL, clicks a temporary `<a download>` and
     revokes it.
   - Pages keep their aspect ratio from the PNG dimensions (`width`/`height` attributes) so the
     stack does not jump while images decode; `loading="lazy"`, `decoding="async"`,
     `draggable={false}`.

### Styling

Component-local `<style>` element rendered as part of the tree (`h('style', null, CSS)`), every
class prefixed `prismlx-`. Only theme tokens with literal fallbacks:

| use | token | fallback |
|---|---|---|
| pane background | `--dsw-alias-bg-document-preview` | `var(--dsw-alias-bg-layer-2, #f1f2f4)` |
| page shadow | `--dsw-elevation-prominent` | `0 1px 3px rgba(0,0,0,.14), 0 8px 24px rgba(0,0,0,.10)` |
| primary text | `--dsw-alias-label-primary` | `#1c1c1e` |
| secondary text | `--dsw-alias-label-secondary` | `#6b7280` |
| borders | `--dsw-alias-border-l1` | `rgba(0,0,0,.12)` |
| control surface | `--dsw-alias-bg-overlay` | `#fff` |
| error | `--dsw-alias-state-error-primary` | `#c0392b` |
| font | `--dsw-font` | `system-ui, -apple-system, sans-serif` |
| content size | `--dsh-content-font-size` | `14px` |

Write `background: var(--dsw-alias-bg-document-preview, var(--dsw-alias-bg-layer-2, #f1f2f4))`
style declarations with nested fallbacks. No global selectors, no `document.body` writes, no
`!important` outside `prefers-reduced-motion` handling, buttons have `aria-label` and visible
`:focus-visible` outline.

## Definition of done

- `node --check` passes for `src/host.js`, `src/client.js`, `demo/example.tex` is valid LaTeX.
- `node -e "import('./src/host.js')"` resolves and exports `apply` + `inject`.
- `node --check` on the client bundle cannot run (it uses `window`); instead
  `node -e "global.window={__ModuleLoader__:{load(o){console.log(o.id, typeof o.factory)}}}; import('./src/client.js')"`
  prints the id and `function`.
- No Harness package imports, no profile writes, no `package.json` edits.
