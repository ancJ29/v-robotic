# Open items

One line per thing deliberately left unresolved, with who opened it, why it is open, and what
closes it. The orchestrator's board points here; this file is the one home. An item is deleted
when it closes, and the closing is recorded on the board.

## 1. The `@emnapi/runtime` override in `pnpm-workspace.yaml`

Opened by P0, the scaffold, on 2026-11-08. `astro check` crashed loading the Astro compiler
because `@emnapi/runtime` resolved to a 2.0 beta against emnapi core 1.x. The override pins it to
1.11.3, which fixes the crash. It is a workaround for someone else's dependency tree, not a
decision, and an override that outlives its cause silently holds a package back.

**What closes it:** remove the override, run `pnpm install` and `pnpm check` in a worktree, and if
both pass, the pin is gone for good. Worth trying whenever Astro is upgraded. Recorded in
`docs/conventions/scaffold.md`.
