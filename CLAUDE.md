# dsh-openprism-latex

DSH bundle: a LaTeX preview for DeepSeek Harness. Host half is a Cordis plugin (`src/host.js`),
client half is a single classic script loaded by the DSH module loader (`src/client.js`).
No build step; the only runtime dependency is the user's own TeX Live.

Read `POSTMORTEM.md` before touching the right sidebar. It lists the eight regressions this
project already paid for, with the exact code that caused each one. `README.md` and
`README_CN.md` are the same document in two languages: change both or neither.

## Facts that decide the design

- **Client changes need a full relaunch.** DSH serves client bundles as immutable per launch, so
  `Cmd + R` keeps the old bytes. A client change is unverified until the app is quit and reopened.
- The client bundle may only `require('react')`. No JSX, no `@deepseek-ai/*` imports, no eval.
- **The tab type does claim `.tex` files** (`canOpen: address => isLatexAddress(address)`, suffix
  only — never refuse a matched address). That claim is what puts this plugin's preview in the
  right sidebar, which the user relies on. The early "the pane closes when this type wins"
  regressions were a misplaced React cleanup and a refused address, not the claim itself; see
  `POSTMORTEM.md` §1 and §3.
- **Two READMEs, one document.** `README.md` is English, `README_CN.md` is Chinese; each links to
  the other and they must describe the same behaviour. Screenshots live in `docs/`.
- **One entry point: the `conversation.view` named LaTeX.** The left-rail icon and the `main`
  panel were removed. The view is the *editor*: an Outline column on the left (drag-resize
  140–360px, hideable) and the source editor filling the rest; its own preview column is hidden
  by default behind an eye toggle and, while hidden, does not compile at all. The shell's native
  composer sits underneath.
- **The view's document comes from the right sidebar.** `LatexTab` publishes its address through
  the module-level `publishDocument` channel; the view adopts that path and session. There is no
  file list in the view, by the user's decision: files are opened from the right sidebar tabs.
- **A page double-click never changes the layout.** It publishes
  `publishJump({line, column, path, sessionId})` for the view's caret, and when the sidebar already
  shows the page beside its editor (`mode === 'split'`) it moves that editor's caret too through
  local `jump` state. Nothing in that path may call `setMode` or `jumpToSourceLine`, so the preview
  pane keeps whatever mode the user chose.
- Host routes are loopback-only and origin-guarded: `/render`, `/pdf`, `/files`, `/source`,
  `/synctex`, `POST /write`. Anything new repeats those guards.
- Compile with the local engine (`/Library/TeX/texbin`). Never ship a TeX engine.

## Hard rules (each one is a bug that already happened)

1. **An effect that touches a ref lives in the component that declares that ref.** A cleanup in
   the wrong component throws `ReferenceError` on unmount, which unmounts the pane.
2. **Never refuse an address your patterns matched.** DSH's `claim()` throws on refusal and the
   open flow aborts half-way. `canOpen` may only re-check the suffix.
3. **Never dispose a registration unconditionally.** Re-apply registers again by id; an old
   cleanup that disposes the current entry leaves a kind with no type.
4. **Do not call `openTab` while the dock has no mounted surface.** Show the panel with
   `layout.openRightbar` first, then retry.
5. **Do not port code without its dependencies.** After any cherry-pick or block copy, grep every
   new identifier for a definition in the *current* tree. `lineStartOffset` and `reportDiagnostic`
   were both missing and both blanked the pane.
6. **A patch script is a loaded gun.** Replace on explicit `start`/`end` slices, not on a marker
   whose boundary may contain other code. Run `git diff --stat` and `node --check` before tests,
   and `git tag` before a large edit.
7. **Green suites are not evidence for dock behaviour.** The three suites run against a stand-in
   context; they cannot see `claim()` throwing, a missing surface, or a stale registration.
   Anything touching tabs needs one real relaunch check, and only one feature per step.
8. **Do not change the architecture while debugging.** Claim → yield → owned tab → claim rotated
   the symptom and cost five rounds. Fix the smallest thing, keep the other variables fixed,
   and tag the last known-good state before an experiment.

## Checks before claiming anything is done

```bash
node --check src/host.js && node --check src/client.js
node scripts/smoke-host.mjs
OPRILX_REACT_PATH="$DSH_PROFILE_DIR/node_modules/react" node scripts/smoke-client.mjs
node scripts/check-pairing.mjs
git diff --stat
```

Then one real page check: relaunch, open a rendered document, switch tabs, confirm the right
sidebar survives. Report what you verified and what you did not.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to
skills in the session's available-skills list; answer directly for quick questions or small
scoped edits.

- Product ideas/brainstorming → `/office-hours`
- Strategy/scope → `/plan-ceo-review`
- Architecture/plan review → `/plan-eng-review` or `/autoplan`
- Bugs/errors → fix directly: one read-only check of the cause first, then the fix and its test
- QA/testing → `/qa` or `/qa-only`
- Code review → `/review`
- Visual polish → `/design-review`
- Ship/PR → `/ship`
