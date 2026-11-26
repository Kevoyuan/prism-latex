# prism-latex

**LaTeX for [DeepSeek Harness](https://github.com/deepseek-ai): the model writes `.tex`, you read the compiled page beside the source.**

This bundle compiles `.tex` with your own TeX Live and shows the pages inside DSH — in the right
sidebar, and in a `LaTeX` view with an outline, an editor and a preview. Double-click a spot on a
page and the caret lands on that character.

**English** · [中文](README_CN.md)

![The LaTeX view: outline rail, source editor, rendered page](docs/view.png)

## Quick start

1. **Install it** (below), then quit and reopen DSH.
2. Open any `.tex` file — a link from the model, the file tree, anything. It opens in the right
   sidebar and compiles there.
3. To edit, switch the conversation's view row to **LaTeX**. It edits whichever file the sidebar is
   showing.
4. Double-click a spot on a rendered page: the caret goes to that character.

Nothing to compile? Open `demo/showcase.tex` — title, abstract, sections, maths, a table, two pages.

## Install

You need the DSH desktop app, a local TeX Live (`latexmk` or `pdflatex`; `xelatex` for CJK), and
Ghostscript for the page images.

Add the bundle to your DSH profile, then restart the app:

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": { "prism-latex": "^0.2.0" },
  "dsh": { "profile": { "bundles": ["prism-latex"] } }
}
```

```bash
cd ~/.dsh/profiles/<profile> && pnpm install
```

Working on the plugin itself? Point the dependency at your checkout instead —
`"prism-latex": "link:/path/to/checkout"`. Client code is served once per launch: **quit and reopen
DSH**, `⌘R` keeps the old bytes.

## What you get

| Surface | |
|---|---|
| **Right sidebar tab** | The reader. Compiles the file you opened; page stack with fit-width and zoom to 300 %, engine picker, Preview / Source / Side by side, PDF download, errors with a clickable line. |
| **`LaTeX` view** | The writer. Outline rail (drag to resize, hideable), editor with LaTeX highlighting, optional preview behind the eye toggle, the shell's composer underneath. |

## Shortcuts

| Keys | Does |
|---|---|
| `⌘S` | Save the file and recompile |
| `⌘↩` | Compile |
| `⌘F` / `⌘G` | Find and replace / go to line |
| `⌘=` `⌘−` `⌘0` | Editor type size (10–20 px), remembered |
| `⌘`/Ctrl + wheel | Zoom the rendered pages |

## Known limits

- Inverse search works (page → caret). Forward search (caret → page) is not built yet.
- No word-wrap: long lines scroll sideways.
- One entry point on purpose — the `LaTeX` view. The left-rail icon and the `main` panel were
  removed.

## Development

```bash
node --check src/host.js && node --check src/client.js
node scripts/smoke-host.mjs
PRISMLX_REACT_PATH="$DSH_PROFILE_DIR/node_modules/react" node scripts/smoke-client.mjs
node scripts/check-pairing.mjs
```

The suites run against stand-in DSH contexts: they cover the plugin, not the dock. Anything that
touches tabs, the conversation view or scrolling needs one real relaunch check. `CLAUDE.md` holds
the rules, `POSTMORTEM.md` the eight regressions behind them, `SPEC.md` the design notes, and
[`docs/architecture.svg`](docs/architecture.svg) the two-halves picture.

## Credits and license

The idea — an AI LaTeX editor with a live preview — comes from
[assistant-ui/open-prism](https://github.com/assistant-ui/open-prism). This is an independent
implementation for the DSH plugin API, not a fork; borrowed behaviour is named in the code and in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

MIT — [`LICENSE`](LICENSE). [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)
