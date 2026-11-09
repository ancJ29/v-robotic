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

## 8. The seed and five prose pages are sample data and a ribbon says so

Opened by P1b on 2026-11-09, closing the earlier item 8 (seed smaller than the screens). Everything in
the seed except the names read off the client's screens is invented (records with `"sample_data": true`;
the strings in `web/src/copy/*.ts` carry a `SAMPLE-DATA` header). `SAMPLE_CONTENT` in `web/src/lib/site.ts`
draws a red ribbon on every page while true.

**What closes it:** the client's content replaces the records (their `sample_data` goes false), the copy
files are rewritten, then `SAMPLE_CONTENT` is set to false. It must be off before launch. Find the rest
with `grep -rn '"sample_data": true' content/seed` and `grep -rln SAMPLE-DATA web/src/copy`.

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

## 11. An untested command in a note reached a real server

Opened by the orchestrator on 2026-11-08. S0a's note gave the command to start the packaged Strapi
app and said, in the same report, that it had never run it. The orchestrator relayed it into S0b's
brief as fact. It was wrong — `node_modules/.bin/strapi` is a shell shim in a pnpm tree — and the
error was only found on a live, billing Lightsail box after 132 crash-restarts.

This is a process item, not a code one. The pattern that failed: a piece reports a command it could
not run, names that honestly, and the honesty is lost at the next hand-off.

**P6 obeyed it (2026-11-09):** every script header, `docs/conventions/box.md` and `reports/p6.md` mark each command as run here or never run anywhere, and the paste-ready script says so in its first lines and again at start. Whether the rule survives the orchestrator's relay is the part this file cannot show.

**What closes it:** nothing in code. A brief that passes on a command should say whether the piece
that wrote it ran it, and an unrun command should be marked as unrun wherever it travels. Worth
carrying to the freelance kit, since it holds in every project.

## 12. The lead schema is a folder, not a workspace member

Opened by P3 on 2026-11-08. The lead record's definition lives in `packages/lead-schema/src/index.ts`
and is imported by relative path. Making it a real pnpm workspace member changed the lockfile, which
made pnpm try to fetch registry metadata for its supply-chain check; that failed offline with
`ERR_PNPM_NO_OFFLINE_META`, so the lockfile was reverted. Nothing is broken — the module is shared
and type-checked — but a relative import across package boundaries works until someone moves a file.

**What closes it:** add it to `pnpm-workspace.yaml`, run `pnpm install` with the network available,
then switch the imports to the package name.

## 13. No rate limit on the lead endpoint, and none is possible until there is a custom domain

Opened by P3 on 2026-11-08. The lead endpoint has Turnstile and a honeypot but no per-address rate
limit, because a Pages Function has no counter without KV or a Durable Object. P3's recommendation
was a Cloudflare dashboard rate-limiting rule on that path, "which is a setting rather than code".

**Corrected on 2026-11-09, from Cloudflare's own documentation rather than memory: that setting is
not available to this site yet.** Rate limiting rules are **zone-scoped** — the docs' own next steps
are "Create a rate limiting rule in the dashboard for a zone" and "via API for a zone", and the only
account-level form is an Enterprise feature deployed to Enterprise zones
(https://developers.cloudflare.com/waf/rate-limiting-rules/). A `*.pages.dev` hostname is not a zone
on the account, so there is nothing to attach a rule to. The custom-domains page does not contradict
this; it only says an apex custom domain "must be a zone on the Cloudflare account"
(https://developers.cloudflare.com/pages/configuration/custom-domains/). Note that the docs do not
state the `pages.dev` case explicitly, so this follows from the zone model rather than from one
sentence.

Rate limiting itself needs no paid plan once a zone exists: the plan table gives Free 1 rule, Pro 2,
Business 5, with Free limited to a 10-second counting period.

**What closes it:** the client's custom domain added to the account as a zone, then one rate limiting
rule on `/api/lead`. Until then the endpoint's protection is Turnstile plus the honeypot, which is
what it has had all along. The alternative, if the domain is slow to arrive and abuse appears, is a
counter in KV or a Durable Object — code rather than a setting, and a bigger change than this item
assumed.

## 14. Cloudflare now points new projects at Workers, not Pages

Opened by P4 on 2026-11-08, from documentation read at the time rather than memory. The Pages
overview carries a banner, "Are you sure you want to use Pages?", saying Workers supports most Pages
use cases with a broader feature set and advising new projects to start with Workers. The migration
guide names the successor: Workers with Static Assets, an `assets.directory` in `wrangler.jsonc`
deployed with `wrangler deploy`, with a `functions/` folder moved by compiling it through
`wrangler pages functions build` and pointing `main` at the output.

P4 stayed on Pages, and the reasoning holds: the lead Function is already written in the Pages form
(`onRequestPost`), both the architecture memo and the lead-path note say Pages, and Pages is
supported today. Moving later is a config change plus one build step, not a rewrite.

**What closes it:** a deliberate decision, not a deadline. Revisit if Cloudflare announces an end
date for Pages, or when something is wanted that only Workers assets offer. Recorded in
`docs/conventions/live-deploy.md` with both source URLs.

## 15. The box scripts have never run against a real box

Opened by P6 on 2026-11-09. `ops/box/` and the paste-ready script were written in a sandbox with no AWS
access. Their text, parsers, refusals and a dry run were tested on a Mac; no step has run on Ubuntu, and
the Caddy apt lines, the strapi account's file permissions and the sslip.io certificate have never been
exercised anywhere. Listed in `docs/conventions/box.md`, "Never run anywhere".

**What closes it:** the human's first run of the one-off script ends green (box up, admin over https,
survived its reboot), or fails and the failing step is fixed in `ops/box/` and noted in `box.md`.

## 16. The seed no longer exercises the confirmed-showroom path

Opened by the orchestrator on 2026-11-09 from P1b's disclosure; the first half was closed by P1c the same
day. Strapi was run (`strapi build`, `ts:generate-types`, import, `compare-with-seed.mjs`): the showroom
`description` field exists in the CMS and round-trips, and regenerating the types changed one thing only,
the position of the `related` line in the product type (alphabetical in the generated file, one slot off in
P1b's hand edit; the meaning is identical). The regenerated file is committed. Details in
`docs/conventions/content.md`, P1c section.

What is left: P1b removed the one sample showroom that carried a placeholder address and opening hours, so
**the seed does not exercise the `details_confirmed = true` path**. The site's tests cover it, the data does
not (the same shape of gap as item 10's hero headline).

**What closes it:** a seed or test showroom with `details_confirmed` true, or the client's real showroom data
replacing the sample ones.

## 17. The box serves the site's images, so the box being down breaks the pictures

Opened by P1c on 2026-11-09 as "a site built from Strapi points its images at Strapi's own address",
and reduced to this by P7, which closed the original: the deploy workflow now sets
`STRAPI_PUBLIC_URL` to the box's public https address, and P7 proved it both ways against a local
Strapi — the build without it wrote 144 references to `http://127.0.0.1:1337/uploads/...`, and the
build with it wrote 144 to the public address and none local.

What is left is a consequence rather than a bug: the images are then served **by the box**. A site
built from Strapi keeps its pages up when the box is down, because the pages are static, but every
picture on them breaks. Today's placeholders are 0.4 MB; the client's photographs will not be.

**What closes it:** mirror the uploads into the build so the images ship with the site, or give Strapi
an object-storage provider (R2) whose URLs do not depend on the box. P7 chose neither, deliberately,
rather than add a provider and a migration for 0.4 MB of placeholders. Recorded in
`docs/conventions/publish.md`.

## 18. The GitHub token behind Publish expires, and Publish then stops quietly

Opened by the orchestrator on 2026-11-09, from P7's own flag. The client's Publish button reaches
GitHub through a fine-grained token the human creates. Those tokens expire. When it does, the relay
can no longer dispatch the build, so **pressing Publish stops rebuilding the site** — and the person
who notices is the client, who sees their edit never appear and has no way to tell why.

**What closes it:** two halves, and the second matters more than the first. The expiry date is written
down where it will be seen — `docs/conventions/publish.md` and the human's own calendar — when the
token is created. And a failed rebuild tells somebody: the relay already answers Strapi with an
error, but nobody reads Strapi's webhook log, so the fix is a notice to the Slack webhook this
project already uses for leads. That needs the webhook URL, which is the human's.

## 19. The backups live on the box they are backing up

Opened by the orchestrator on 2026-11-09, from P7's own flag. The nightly set is verified, rotated and
sound — `sqlite3 .backup` for a consistent copy while Strapi writes, `integrity_check`, a table count,
gzip, `SHA256SUMS`, fourteen nights in roughly 15 MB, and it refuses to start rather than fill the
disk. But it all sits on the same 512 MB box, so if the box is deleted or lost the backups go with it.
The static site survives either way; what is lost is the client's content edits since the last copy
that exists somewhere else.

**What closes it:** Lightsail automatic snapshots, or an off-box copy — P7 left a hook for an off-box
command, exit 6, which keeps the local set when it fails. Both need something of the human's: a
setting that bills, or a key.

**Not now, and for a reason:** automatic snapshots on a box that is created and destroyed every day
would leave snapshots behind every evening, and the teardown deliberately refuses to delete a
snapshot unless asked (`DELETE_SNAPSHOTS=1`), so each test day would quietly add a billing leftover.
This belongs to the box that is meant to live — the one that stands up in December — not to the test
boxes.
