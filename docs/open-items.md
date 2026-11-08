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

## 2. The plan says S0a deploys to Lightsail; it does not

Opened by S0a on 2026-11-08. `docs/plan.md` line 100 lists "the step that puts it on Lightsail"
inside S0a. S0a was deliberately scoped to build and publish an artifact only, because standing up
the box is P6 and had no caller. Nothing is broken; the plan line overstates what S0a delivers, and
a later session reading only the plan would look for a deploy step that is not there.

**What closes it:** correct that line when P6 is planned, so the two agree.

## 3. P6 should unpack, not install

Opened by S0a on 2026-11-08. `docs/plan.md` line 138 has P6 running a production install on the
box. S0a's artifact is instead a self-contained production tree — about 1.4 GB unpacked, 280 MB as
a tarball, with the Linux x86-64 SQLite binary already in place — so the box needs no install and no
network. Installing roughly 1,250 packages on a 512 MB box is the wrong place for that work.

**What closes it:** P6 decides. If it unpacks the artifact, the plan line is corrected to match; if
it installs on the box after all, this item records why that was chosen against the cheaper route.
