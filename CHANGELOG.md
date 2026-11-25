# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **The icon is a rendered glass prism** on the indigo card, replacing the line-art triangle.
  `assets/icon.png` (256 px) is what the bundle exports as `./icon`; `assets/icon-180.png` is the
  same artwork at the size plugin markets ask for. The vector `icon.svg` is gone: the new mark is a
  render, and hand-tracing it as SVG would be a worse copy of it.
- `screenshots.json` lists the three screenshots in `docs/`, so storefronts show them in that order
  instead of guessing from the README.

## [0.2.1] — 2026-11-25

### Changed

- **The README is a quick start now**: four numbered steps, the install block with the exact
  profile JSON and `pnpm install`, a shortcuts table and the known limits — 97 lines instead of
  182. The route tables and design notes it used to carry stay in `SPEC.md` and `CLAUDE.md`.

## [0.2.0] — 2026-11-25

### Renamed

- The project is now **prism-latex**. The package name, the GitHub repository, the plugin and bundle
  id, the host routes (`/api/prism-latex/*`), the storage keys, the locale namespace and the CSS
  prefix all follow it; the docs, the install snippets and the demo documents use the new name.
- A profile that installed this bundle renames its dependency and its `dsh.profile.bundles` entry
  from `dsh-openprism-latex` to `prism-latex`. Saved view preferences live under the old
  `dsh-openprism-latex.*` keys and are not migrated, so outline width, preview toggle, code size and
  engine choice start from their defaults once.
- Credit to [assistant-ui/open-prism](https://github.com/assistant-ui/open-prism) is unchanged: that
  is the project this one takes its name and interaction ideas from.

## [0.1.1] — 2026-11-25

### Changed

- **Contrast and clearance in the `LaTeX` view** (design audit F1/F2/F3/F5): the Outline rail
  now clears the 3:1 UI floor (`currentColor` at .45, full accent on the current row), comment
  tokens moved from `#6b7481` to `#7f8896` (5.9:1 on the black editor, 5.4:1 on the panel), the
  `Idle` pill no longer appears before the first compile, and the view measures and reserves the
  height the shell's composer covers, so the editor's last lines and a jumped-to caret stay
  visible.
- **The header toggles show their state** (design audit F4): the Outline and preview icon buttons
  paint a filled surface while pressed, so which column is open is visible without hovering.
- **The view title wears the editor's face** (design audit F8): `LaTeX` is set in the editor's
  monospace at 13/600 with .02em tracking, matching the rail labels; the document subtitle keeps
  the UI face.
- **The Outline follows the document** (design audit F6): its label sticks to the top of the
  column, and the marked row scrolls back into view inside the column when the editor moves past
  it, so a long document never leaves the rail without a "you are here".
- **One surface for both source panes**: the sidebar's source pane and the view's editor column
  are the same editor, but each declared its own colour — One Dark's `#282c34` on one side of the
  same file, the near-black `#0f1113` on the other. They now share one rule, so the code surface is
  the same black in both places.

### Fixed

- **The sidebar's split editor follows a page double-click again**: since 8f91a73 the hit was only
  published for the conversation view, so the pane the click was made in never moved its caret. It
  moves its own caret as well when the page already sits beside the editor, and still never changes
  the mode a double-click landed in.

## [0.1.0] — 2026-11-25

First public release.

### Added

- **Right sidebar tab**: claims `.tex` / `.latex` / `.ltx`, compiles with the local TeX Live, and
  renders the page stack with fit-width, zoom to 300 %, page count, compile time and PDF download.
  Preview / Source / Side-by-side modes and an engine picker (`latexmk` by default with a
  `pdflatex` fallback, plus `xelatex` and `lualatex`).
- **Conversation view `LaTeX`**: an Outline rail (drag to resize, hideable, highlights the section
  the editor is in), a pure-black source editor, and an optional preview column that is hidden by
  default and does not compile while hidden. The view follows whichever document the right sidebar
  shows, and the shell's native composer sits underneath.
- **Editor**: LaTeX syntax highlighting, line numbers, find and replace, command completion,
  bracket and `\begin…\end` pairing, IME-safe input, `⌘S` save with a stale-version guard,
  `⌘=`/`⌘−`/`⌘0` type size, `⌘↩` compile, sticky section header, unsaved-changes dot, status pill.
- **SyncTeX inverse search**: double-click a rendered page to move the editor caret to that
  character, with context above it. The click is mapped over typeset characters only, so LaTeX
  markup does not shift it. A double-click never changes the browsing pane's mode or the layout.
- **Host routes**: `/render`, `/pdf`, `/files`, `/source`, `/synctex`, `POST /write` — loopback
  only, origin-guarded, confined to the workspace.
- Three test suites: `scripts/smoke-host.mjs`, `scripts/smoke-client.mjs`,
  `scripts/check-pairing.mjs`.

### Fixed during development

The regressions that shaped the architecture are documented in `POSTMORTEM.md`; the rules that
prevent them from returning are in `CLAUDE.md`.

[Unreleased]: https://github.com/Kevoyuan/prism-latex/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Kevoyuan/prism-latex/releases/tag/v0.2.1
[0.2.0]: https://github.com/Kevoyuan/prism-latex/releases/tag/v0.2.0
[0.1.1]: https://github.com/Kevoyuan/prism-latex/releases/tag/v0.1.1
[0.1.0]: https://github.com/Kevoyuan/prism-latex/releases/tag/v0.1.0
