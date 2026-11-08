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

## 4. Catalog search is a client-side filter, not a build-time index

Opened by P2a on 2026-11-08. `docs/plan.md`'s P2a row says the catalog search uses a build-time
index. P2a built a progressive inline script filtering over data attributes instead: with JavaScript
off, all 20 products show. At 20 products that is the cheaper and more robust choice, and nothing is
lost. It is recorded because the plan and the code disagree, and because the decision stops being
right somewhere above a few hundred products.

**What closes it:** either correct the plan row to match, or build the index when the catalogue
outgrows a client-side filter. Recorded in `docs/conventions/site-shell.md`.

## 5. The four numbered chips on the product page are a guess

Opened by P2a on 2026-11-08. Reference screen 02 shows four numbered chips, 01 to 04, and their
meaning is not in the data or anywhere in the memos. P2a mapped them to applications, specs, related
products and documents, as anchors. It is a reasonable reading and it is not a verified one.

**What closes it:** the human reads screen 02 and says what the four chips were meant to be, or
confirms the mapping. Cheap to change — they are four labels and four anchor targets.

## 6. Page prose lives in `web/src/copy/`, not `content/*.json`

Opened by P2b on 2026-11-08. The plan has the hard-coded page prose for services, AI technology,
partnership, about and contact sitting in `content/*.json`. P2b put it in typed objects under
`web/src/copy/<page>.ts` instead, shaped like Strapi single types, with a README. The reason is
sound: the seed validator checks **every** JSON file in `content/` against a Strapi schema, and
these five pages have no content type behind them on purpose, so JSON there would either fail the
check or force five schemas nobody wants.

**What closes it:** correct the plan row to match, or give those pages real Strapi single types if
the client turns out to want to edit that prose. The objects are already shaped for the second
outcome. Recorded in `docs/conventions/remaining-pages.md`.

## 7. Three routes are linked but not built until P3

Opened by P2b on 2026-11-08. `/showroom/dat-lich` (showroom booking), `/dich-vu/bao-hanh` (warranty)
and `/tro-ly-ai` (the AI assistant) are linked from built pages and 404. None is a header or footer
link, so the navigation is whole; but `/showroom/dat-lich` is linked from 20 product pages as well
as the showroom page, so it is the most visible of the three.

**What closes it:** P3 builds all three as form flows. Until then they are dead links on a site that
is noindex and not public.

## 8. The seed has fewer industries and showrooms than the screens

Opened by P2b on 2026-11-08. The reference screens show 11 industries and 5 showrooms; the seed has 4
and 3. The pages count from the data rather than hard-coding, so nothing breaks and the counts
update themselves when real content arrives. It is recorded because a page laid out against 4 cards
may read differently with 11.

**What closes it:** the client's real content, or a decision to extend the seed before launch if the
layout needs proving at full size.

## 10. The hero headline ships filled, not empty

Opened by the orchestrator on 2026-11-08, correcting its own brief. P2c was told the seed ships the
hero headline empty; it does not — `content/seed/vi/site-settings.json` has "Tiêu đề trang chủ tạm
thời" and a matching sub-line. The fallback for the empty case exists and was proved separately by
blanking the settings and rebuilding, so nothing is wrong with the page. What is wrong is the claim,
and it matters because "every `site_settings` field may be empty" is a design promise several
pieces rest on, and the seed does not actually exercise it for these two fields.

**What closes it:** decide whether the seed should ship these two empty, so the promise is exercised
by the data rather than only by a test. The counter-argument is that a visibly temporary headline is
more useful to a client reviewing the site than a generic fallback.
