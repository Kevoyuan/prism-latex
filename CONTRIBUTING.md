# Contributing

Thanks for looking. This is a small bundle with unusually strict rules — most of them exist
because the same mistake shipped twice.

## Read first

| File | Why |
|---|---|
| `CLAUDE.md` | Eight hard rules, each one a real regression. The checklist at the bottom is the definition of "done". |
| `POSTMORTEM.md` | The eight failures behind those rules, with the exact code that caused each one. |
| `SPEC.md` | Design notes for the compile pipeline and the editor. |
| `README.md` / `README_CN.md` | The user-facing description. They are one document in two languages: change both or neither. |

## Before you claim a change works

```bash
node --check src/host.js && node --check src/client.js
node scripts/smoke-host.mjs
OPRILX_REACT_PATH="$DSH_PROFILE_DIR/node_modules/react" node scripts/smoke-client.mjs
node scripts/check-pairing.mjs
git status --short
```

All three suites must pass. They run against stand-in DSH contexts, so they prove the plugin — not
the dock. **Anything that touches tabs, the conversation view or scrolling needs one real relaunch
check as well:** client bundles are served once per launch, so quit and reopen DSH (`⌘R` keeps the
old bytes), then report what you verified and what you did not.

## Ground rules

1. One feature per step; one commit per concern. Revert the single commit when a real-page check
   fails instead of stacking another guess on top.
2. Never let `canOpen` refuse an address the patterns matched (DSH throws on refusal).
3. An effect that touches a ref lives in the component that declares that ref.
4. Markup and its CSS land together — the suites check that every `oprilx-*` class has a rule.
5. No build step, no dependencies: the client half may only `require('react')`, and
   `src/host.js` runs on the host's Node with the modules it already ships.

## Style

English UI copy, terse. Comments explain *why* a thing is the way it is, especially where the
obvious implementation was wrong. No JSX, no eval, no `@deepseek-ai/*` imports in the client half.

## Reporting a bug

Include the DSH version, the engine used, and the diagnostic report at
`$TMPDIR/dsh-openprism-latex-diag.json` when the pane misbehaves — it carries the tab-type state,
the scroll chain and the last jump trace.
