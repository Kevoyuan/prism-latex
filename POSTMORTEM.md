# Postmortem — the regressions this project already paid for

Every entry is a real failure from this repository's history: what the user saw, the exact code
that caused it, the fix, and the rule that now prevents it. Read this before touching the right
sidebar, the tab registry, or the editor's effects.

The rules are duplicated as a checklist in `CLAUDE.md`. Keep both in sync when a new failure is
added.

---

## 1. The pane disappeared when a tab was clicked

**Symptom.** Clicking a document tab closed the whole right sidebar. It started after the commit
that added character-level caret placement and did not stop until that commit was reverted.

**Cause.** An effect that touched `flashTimer` was inserted into `LatexTab`, but `flashTimer` is
declared in `SourceEditor`:

```js
// LatexTab — flashTimer does not exist here
useEffect(() => () => {
  if (flashTimer.current !== undefined) clearTimeout(flashTimer.current)
}, [])
```

The cleanup only runs on unmount, which is exactly what a tab switch does: React tore the old
body down, the cleanup threw `ReferenceError: flashTimer is not defined`, and the pane went with
it. The suites stayed green because they render a body once and never unmount it.

**Fix.** `4d0de48` moved the cleanup into `SourceEditor`, next to the ref it belongs to.

**Rule.** An effect that touches a ref lives in the component that declares that ref. When code
moves between components, grep the identifier and check which component declares it.

---

## 2. Ported code referenced helpers that did not exist

**Symptom.** Every render of the source pane blanked it. Twice.

**Cause.** Two separate ports copied callers without their callees:

```js
const start = lineStartOffset(text, flashLine)   // lineStartOffset lived in a reverted commit
```

and a watchdog called `reportDiagnostic()`, which also lived in a commit that had been rolled
back. The first threw on render, the second inside a `try` (so it silently never healed).

**Fix.** `4d0de48` restored `lineStartOffset` / `lineNumberAt` with unit checks in
`scripts/check-pairing.mjs`; the watchdog reference is gone.

**Rule.** After a cherry-pick or a block copy, grep every new identifier for a definition in the
*current* tree before running anything. See rule 5 in `CLAUDE.md`.

---

## 3. `canOpen` refused addresses its own patterns matched

**Symptom.** Opening a file made the pane vanish. The diagnostic recorded `claim: "latex"` and no
client error, which sent the investigation in the wrong direction for several rounds.

**Cause.** The patterns matched both file address forms, but the guard only accepted one:

```js
patterns: ['dsh-resource://file/**/*.tex', …]
canOpen: address => parseSessionAddress(address) !== undefined,   // session form only
```

DSH's registry throws when a definition refuses an address it was asked to claim:

```js
claim(address, kind) { …
  if (definition.canOpen !== void 0 && !definition.canOpen(address))
    throw new Error(`sidebarRight: tab type "${kind}" refuses "${address}"`) }
```

`placeResource` calls `claim` without a `try`, so the open flow aborted after the dock had
already handled the previous tab.

**Fix.** `canOpen` only re-checks the suffix (`isLatexAddress`), and both address forms parse.

**Rule.** Never refuse an address your patterns matched. `canOpen` is a suffix filter, nothing
more.

---

## 4. A stale cleanup disposed the live registration

**Symptom.** After the plugin was re-applied (live HMR while editing), clicking any file closed
the pane: the kind had no type in force.

**Cause.**

```js
ctx.effect(() => () => { if (typeof disposeTabType === 'function') disposeTabType() })
```

Re-applying registers the type again by id, then the previous instance's cleanup disposed the
*new* entry.

**Fix.** `91778f2` disposes only when the registry entry is still this instance's, and a watchdog
re-registers a lost type.

**Rule.** Never dispose a registration unconditionally.

---

## 5. `openTab` without a mounted surface

**Symptom.** "The right sidebar did not accept the tab: sidebarRight: no session surface is
mounted".

**Cause.** The dock's `openTab` starts with `require()`:

```js
require() {
  const sessionId = this.mounted.getSnapshot()
  const actions = sessionId === undefined ? undefined : this.actionsFor(sessionId)
  if (sessionId === undefined || actions === undefined)
    throw new Error('sidebarRight: no session surface is mounted')
}
```

With the panel collapsed nothing is mounted, so the first call always throws.

**Fix.** Show the panel with `layout.openRightbar(true, false)` first, then retry the request
while the surface mounts.

**Rule.** Do not call `openTab` while the dock has no mounted surface.

---

## 6. Green suites, broken page — five times

**Symptom.** Five builds reported "all checks green" and still broke in the real app.

**Cause.** `scripts/smoke-client.mjs` drives a stand-in context. It cannot observe `claim()`
throwing, a stale registration, a missing session surface, or React unmounting a body. Every
"green" statement was true of the plugin and silent about the dock.

**Fix / practice.** One real relaunch check per step; one feature per step; tag the last
known-good state (`git tag`) before an experiment; when a check fails, revert only the commit
that introduced it.

**Rule.** A suite result is evidence about the plugin, never about the dock.

---

## 7. Architecture churn instead of a fix

**Symptom.** Five consecutive "this is fixed" reports, each with a different failure: blank pane,
collapsing pane, unregistered type, refused tab.

**Cause.** The tab-entry model was replaced four times (claim → yield → plugin-owned tab → claim)
while the actual defects were two small ones: a throwing `canOpen` and a misplaced cleanup. Each
model change rotated the symptom, which read as "still the same bug".

**Rule.** While debugging, change one variable. Fix the smallest thing that explains the evidence,
then re-measure.

---

## 8. A layout was shipped without its stylesheet

**Symptom.** The "two-column workspace" had the right markup and still looked like a vertical
stack in the app.

**Cause.** The commit added `.oprilx-workspace` / `.oprilx-files` elements but no CSS rules for
them; the smoke suite only inspects the element tree, so nothing failed.

**Fix.** The CSS ships in the same commit as the markup from now on. A layout change is verified
on the real page, and the suite asserts only structure — never appearance.

**Rule.** Markup and its CSS land together; a green suite never proves a layout looks right.

---

## The final stable configuration

- The tab type **claims** `.tex` files again (`canOpen: isLatexAddress`), because that claim is
  what renders this plugin's preview in the right sidebar. The claim is only safe because
  `canOpen` never refuses a matched address and every effect that touches a ref lives in the
  component that declares it.
- One entry point remains: the `conversation.view` named **LaTeX** — Outline column (resizable,
  hideable) + source editor + optional preview column behind a toggle, with the shell's native
  composer underneath. The left-rail icon, the `main` panel and the in-view `.tex` file list are
  gone; the view follows the document the right sidebar is showing.
- A page double-click publishes a jump through a module-level channel and **never changes the
  preview pane's mode**; the conversation view's editor column takes the caret.
