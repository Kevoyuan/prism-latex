# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- **The view's editor is as black as the sidebar's**: the editor pane still carried One Dark's
  `#282c34` while the sidebar's source pane has been `#0f1113` since the near-black surface
  landed. They now match, so the code surface reads as one black island in both places.

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

[Unreleased]: https://github.com/Kevoyuan/dsh-openprism-latex/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Kevoyuan/dsh-openprism-latex/releases/tag/v0.1.0
