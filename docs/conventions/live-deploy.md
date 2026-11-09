# The site live on Cloudflare (piece P4)

Decisions a later session should not re-derive. Each is reversible. The design is in `docs/architecture.md`; the lead endpoint's own note is `lead-path.md`; the Actions conventions are those of `cms-build.md`.

## Finding: Pages is not deprecated, but Cloudflare now points new projects at Workers

Read in the build session, not from memory:

- The Pages overview (https://developers.cloudflare.com/pages/) carries a banner "Are you sure you want to use Pages?" saying Workers "supports most Pages use cases and offers a broader feature set" and advising new projects to start with Workers. It does **not** call Pages deprecated or end-of-life.
- The migration guide (https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) names the successor: Workers with Static Assets, configured by `assets.directory` in `wrangler.jsonc` and deployed with `wrangler deploy`. A `functions/` folder moves by compiling it with `wrangler pages functions build --outdir=...` and pointing `main` at the output.
- **Decision: ship on Pages now, plan the move.** The Function is already written in the Pages form (`onRequestPost`), the architecture and `lead-path.md` say Pages, Pages is documented and supported today, and the move is a config change plus one build step, not a rewrite. The cost of waiting is that a later piece (not P7 unless it is convenient) repeats the deploy on Workers. Record it as an open item if the human wants the move before launch.

## Decisions

- **Mechanism:** Cloudflare Pages, **Direct Upload**: Actions builds, then `wrangler pages deploy dist` uploads. Reason: the build needs the Turnstile site key and (from P5) the Strapi URL, which Actions holds; Pages' own git build would need those too and would build on every push.
- **Trigger:** `workflow_dispatch` only, and the job runs only on `main`. Reason: "deliberate, not every commit". No `paths` filter, deliberately: with no push trigger a filter has nothing to filter. P7 added the CMS publish path: the same workflow now has a `content_source` input and the relay Function `/api/rebuild` runs it with `strapi` (`publish.md`); a by-hand run is still `seed`.
- **Project name:** `v-robotic` (`web/wrangler.jsonc` and the workflow's `--project-name`). Address `https://v-robotic.pages.dev`, or with a suffix if the name was taken; the preflight reads the real one.
- **Build:** `pnpm check` then `pnpm --filter web build`; output `web/dist`. Same installs as `cms-build.yml` (pnpm from `packageManager`, Node from `.nvmrc`, `--frozen-lockfile`).
- **Wrangler:** `npx --yes wrangler@4.152.0 pages deploy dist` from `web/`, with the token in the environment. **Not** `cloudflare/wrangler-action`: its documented inputs (v4.1.3 is the latest release, read from GitHub) install wrangler with the detected package manager into the working directory, which here is a pnpm 12 workspace that blocks dependency build scripts; that interaction could not be tested without Cloudflare, and `npx` has neither problem. Version 4.152.0 is 17 days old (the repo's habit is two weeks).
- **Build-time variable:** `PUBLIC_TURNSTILE_SITE_KEY` is a GitHub repository **Variable** (not a Secret: it is public), passed as `env` to the job. A first step fails the run if it is empty or is Cloudflare's test key; the verify step fails if the built output contains the test key or lacks the real one. Setting it only in the Cloudflare dashboard would do nothing: direct upload does not build there.
- **Runtime names:** `TURNSTILE_SECRET_KEY` and `SLACK_WEBHOOK_URL` are Pages **secrets** set with `wrangler pages secret put` (they never pass through GitHub or a file). `LEADS` is declared in `web/wrangler.jsonc` (`r2_buckets`), so it is in version control, not clicked in the dashboard. **Once `wrangler.jsonc` exists the dashboard shows these fields read-only** (docs); change them in the file.
- **Preview versus production:** one production deployment from `main`. **No pull-request previews.** Reason: the site is noindex and has one reader; a preview would bind the same R2 bucket (top-level `r2_buckets` apply to both environments) and could write real-looking leads to the production bucket; a preview needs its own Turnstile hostname too. Revisit when there is a second reader.
- **Token scope:** the Cloudflare API token needs only Account, Cloudflare Pages, Edit (docs). The workflow's `permissions` are `contents: read`, nothing wider, because no GitHub Deployments integration is used.
- **Concurrency:** group `web-deploy`, not cancelled in flight (a half-finished upload is worse than a queued one). Timeout 20 minutes; runner `ubuntu-24.04`; actions `checkout@v4`, `pnpm/action-setup@v4`, `setup-node@v4`, the same as `cms-build.yml`, which ran green.

## Noindex: what is guarded and what changes at launch

The workflow fails if the built site's `robots.txt` is not `Disallow: /` or `index.html` lacks `noindex`. Nothing in it turns noindex off. The preflight's `MODE=after` checks the same on the live site.

**At launch, undo it in four places, together:** `web/src/lib/site.ts` (`NOINDEX` to false), `web/public/robots.txt` (allow, add a sitemap), and delete the two `noindex` assertions in the "Verify the built site" step of `web-deploy.yml` and the noindex lines in the preflight (`MODE=after`). Not before the slugs are final: see `docs/open-items.md` and the plan's SEO row. Pages URLs already indexed under placeholder slugs are the cost of doing it early.

## What the human creates, in order (names are copied from the code; the preflight compares them)

1. A Cloudflare account with R2 turned on (R2 asks for it once, in the dashboard). *Account.*
2. `wrangler login` in the human's terminal. *A credential, local to the terminal.*
3. R2 bucket **`v-robotic-leads`** (private; no public access). Source of the name: `web/wrangler.jsonc`.
4. Pages project **`v-robotic`**, Direct Upload, production branch `main`.
5. A Turnstile widget (dashboard, Turnstile), hostname `v-robotic.pages.dev` (add the real domain at launch). It gives a **site key** (public) and a **secret key** (credential).
6. Pages secret **`TURNSTILE_SECRET_KEY`** = the widget's secret key. *Credential.* Optional later: **`SLACK_WEBHOOK_URL`**. *Credential.*
7. A Cloudflare API token, Account > Cloudflare Pages > Edit, and the account id. *Credentials.* Stored as GitHub **Secrets** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
8. GitHub **Variable** (not Secret) **`PUBLIC_TURNSTILE_SITE_KEY`** = the widget's site key.
9. Run the preflight (`MODE=before`), merge to `main`, run the workflow from the Actions tab, run the preflight again (`MODE=after`), then submit one test form by hand and see the object under `leads/<date>/` in the bucket.
10. Optional, a setting: a Cloudflare rate-limiting rule on `/api/lead` (`lead-path.md` deferred this to P4; the Function has no counter).

Placeholders for local runs stay in `web/.dev.vars.example`; nothing real is committed.

## Verification, and what could not be tested

- `actionlint` on both workflows; `pnpm check`; `pnpm --filter web build` (36 pages, unchanged), and the workflow's verify assertions run by hand on the build: all run in the sandbox.
- The preflight's logic was run against stub `wrangler` and `gh` programs (a green, a red, two refusals) and `MODE=after` against a local server serving `web/dist` with the real Function code. **Not run: any real Cloudflare or GitHub call, `act`, the Actions run itself, the deploy.**
- Claims read from documentation in this session: Pages overview banner and migration guide; wrangler `pages project create/list/deploy`, `pages secret put/list` flags; `pages project list --json`; `r2 bucket create/list`; the Pages wrangler-config rules (supported keys, `r2_buckets` non-inheritable, config as source of truth); the direct-upload workflow's token permission; the action's version and inputs.
- Claims from memory, to be confirmed on the first real run: `wrangler whoami`; the output format of `pages project list` (without `--json`) and `r2 bucket list`, which the preflight matches by name rather than by shape; `pages secret list` printing names; the `pages.dev` address being the project name or a suffixed form; a top-level `r2_buckets` applying to production; `--commit-message` containing spaces being accepted.
