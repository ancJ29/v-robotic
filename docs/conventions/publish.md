# Publish rebuilds the site, and the box is backed up (piece P7)

Decisions a later session should not re-derive. Each is reversible. The deploy it reuses is `live-deploy.md`; the box is `box.md`; the content switch is `strapi-local.md`.

> **NEVER RUN against GitHub, Cloudflare or a real box.** Written in a sandbox with none of them. The section "Ran here, never ran anywhere" is the exact list. Do not relay any command in this note as "works".

## The chain, in one line

Client presses Publish in Strapi -> Strapi's webhook calls `https://<site>/api/rebuild` -> that Function checks a shared secret and asks GitHub to run `web-deploy.yml` with `content_source=strapi` -> the workflow reads the box, builds, deploys.

## Decisions

- **A relay Function, `/api/rebuild`, because Strapi cannot call GitHub directly.** A Strapi webhook sets the URL, headers and events but not the body; both GitHub dispatch endpoints demand a body field Strapi does not send (`event_type` / `ref`). The Function (`web/functions/api/rebuild.ts`, logic in `_lib/handle-rebuild.ts`) is the smallest thing that bridges that, and the plan already named `/api/rebuild`.
- **One deploy workflow, not two.** `web-deploy.yml` gained one input, `content_source` (`seed` | `strapi`, **default `seed`**). The Function dispatches it with `strapi`; a human pressing Run workflow gets `seed`. Reason: a second deploy workflow would drift from the first (noindex checks, key checks, pinned wrangler). The repository default stays `seed`; `CONTENT_SOURCE` is set from the input inside the workflow only.
- **Authentication, two layers.** Strapi to the Function: `Authorization: Bearer <REBUILD_HOOK_SECRET>`, compared through SHA-256 digests (no early exit on the first wrong character). Function to GitHub: a fine-grained token on this one repository with only *Actions: Read and write*, held as a Pages secret. Neither value is in the repository. With either missing the Function answers 503 and dispatches nothing.
- **Which events rebuild.** `entry.publish`, `entry.unpublish`, `entry.delete`, `media.create/update/delete`. Anything else (including Strapi's "Trigger" test button) is answered 200 and starts nothing.
- **Many publishes, one build.** The workflow's concurrency group `web-deploy` (`cancel-in-progress: false`) already runs one at a time; GitHub keeps only the newest *waiting* run, so ten quick edits cost one running build plus one queued. No debounce code.
- **A dead box fails the build, never the site.** A first step in a strapi run needs `STRAPI_URL` (https, not a local address) and `STRAPI_TOKEN`, and a `/_health` answer of 204; any miss stops the run before anything is built or deployed, so the live site keeps its last good state. The adapter already fails rather than fall back to the seed (`strapi-local.md`).
- **Item 17 closed the first way: `STRAPI_PUBLIC_URL` = the box's public https address.** In the workflow `STRAPI_URL` *is* that public address (the runner reaches the box the way a visitor does), and `STRAPI_PUBLIC_URL` is set to the same value explicitly. A "Verify the built site" assertion fails the run if any page contains `127.0.0.1` or `localhost` followed by `/uploads`. Not the R2 provider: that is a new provider, bucket, token and migration for no gain at 432 KB of images. **Cost of this choice, said plainly:** image files are served by the 512 MB box through Caddy, so if the box is down the pages stay up (they are static) but their images break. Mirroring uploads into the build is the fix if that matters; it is not built.
- **Backup: a systemd timer, not cron.** Same reason as the service (box.md): the box runs systemd, logs go to `journalctl -u strapi-backup`, and `Persistent=true` makes a missed night happen at next boot. The plan said cron; the intent (nightly, on the box) is unchanged. 03:30 box time (UTC on Lightsail Ubuntu), up to 5 minutes random delay.
- **What a backup is.** `ops/box/backup.sh`: `sqlite3 .backup` of the live database (a consistent snapshot while Strapi writes, waiting out a lock for up to 30 s; a plain `cp` can be torn), checked with `PRAGMA integrity_check` and a table count, gzipped, with a SHA256SUMS file, into `/var/backups/strapi/strapi-YYYYmmdd-HHMMSS/`. The uploaded files are kept as **one rsync mirror** (`uploads-mirror/`), not 14 copies; it never deletes, so an image removed in Strapi stays in the mirror (the folder only grows).
- **Rotation: keep the newest 14 sets (`BACKUP_KEEP`), delete older ones only after a new set is verified and in place.** A failed or refused run never deletes anything. A full disk is refused up front (needs the larger of 500 MB and 3x the data) with exit 4 and keeps every old set; deleting old ones "to make room" would trade a backup for a backup.
- **Install is step `95-backup`** in `run-all.sh`, so a rebuilt box has it. For the box that already exists: run just that step (below). It installs `sqlite3` and `rsync`, takes one backup at once as proof, then the timer takes over.
- **An optional off-box hook, `OFFBOX_CMD`,** is run with the finished set's folder as its argument; empty by default, because copying off the box needs a credential that is the human's (an R2 or S3 key). A failure there exits 6 and keeps the local set.

## Ran here, never ran anywhere

Ran in the sandbox:
- `actionlint` on both workflows: clean. `pnpm check` (web type check and tests including 6 new for the relay, plus the seed validator): green. `shellcheck -S error` on `ops/box/*.sh`.
- The relay Function as plain functions against a fake GitHub (`web/test/rebuild-handler.test.mjs`): correct URL, body and headers on a publish; 401 on a wrong, missing or malformed secret with GitHub never called; 503 unconfigured; 200 and no dispatch for the test button; 400 on a bad body; 502 when GitHub refuses or is unreachable, without echoing GitHub's text.
- **Item 17, against a real local Strapi** (a fresh database, the seed imported, 36 images uploaded): a build with `CONTENT_SOURCE=strapi` and no public address wrote `http://127.0.0.1:1337/uploads/...` into the pages (144 references, the bug reproduced); the same build with `STRAPI_PUBLIC_URL=https://cms.example.test` wrote 144 references to `https://cms.example.test/uploads/...` and none local. Both builds 43 pages. A build from the seed with Strapi stopped: 43 pages. `compare-with-seed.mjs` (adapter output equals the seed) passed in the same run. `https://cms.example.test` is a stand-in; nothing opened it.
- `backup-selftest.sh` (also run by `selftest.sh`, 6 passes in a row): good run and restore of the copy; rotation keeps the newest 3 of 6; **full disk** (simulated by a test hook that reports 10 KB free) exits 4, deletes nothing, leaves no temp folder; **five backups taken while another process inserts rows in a loop** all verify; a corrupt source exits 5 and deletes nothing; missing database exits 3; `BACKUP_KEEP=0` refused; a failing off-box command exits 6 and keeps the set; the unit and timer text; the install step's dry run.

Never ran anywhere:
- Both workflows' runs on GitHub (the new input, the box-health step, the new verify assertions, `${{ }}` expressions beyond what actionlint checks).
- The Function on Cloudflare (Pages Functions routing of `rebuild.ts`, `vars` in `wrangler.jsonc` reaching `env`, `crypto.subtle` there, Cloudflare reaching `api.github.com`), and GitHub's answer (204) to the dispatch call; both are from documentation, not seen.
- Strapi's webhook sending the header and events as configured.
- The backup on Ubuntu: `95-backup.sh`, the systemd service and timer, `apt-get install`, running as root, the `Nice`/`IOSchedulingClass` settings, `df` on Linux (the script reads `df -Pk`, not tested there), a truly full disk (only the pre-check was simulated, not an `ENOSPC` mid-copy, though each write step ends in an exit-5 branch), the box's real database size.
- A restore. The restore steps below are the design, not an exercise.

## What the human does, in order

Prerequisites already on their list: the box exists (P6) and the site is deployed (P4). Replace nothing in angle brackets except where marked.

1. **Content on the box.** The box's database is empty until the seed is imported once; do it as `box.md` line 50 describes (ssh tunnel, real admin login). *Unrun, a P6 step.*
2. **Merge and run web-deploy once from Actions (content source `seed`)** so the `/api/rebuild` Function exists on the site. Actions tab > web-deploy > Run workflow > main > content_source: seed. You will see a green run.
3. **A read-only Strapi token.** In the Strapi admin (`https://<box address>/admin`): Settings > API Tokens > Create new API Token: name `site`, duration Unlimited, type **Read-only**. Copy the key shown once.
4. **GitHub repository settings** (Settings > Secrets and variables > Actions): Secret `STRAPI_TOKEN` = that key. Variable `STRAPI_URL` = the box's public address, for example `https://203-0-113-7.sslip.io` (https, no trailing path; the preflight-style check in the workflow refuses an http or local address).
5. **A GitHub token for the relay.** GitHub > Settings > Developer settings > Fine-grained tokens > Generate: repository access *Only select repositories* = this repo; permission *Repository > Actions: Read and write* (nothing else); expiry 1 year (put the date in your calendar; when it lapses, Publish silently does nothing until it is replaced).
6. **The shared secret, made on your machine.**

```
openssl rand -hex 32
```

You will see 64 hex characters. Keep them for the next step and for step 8.

7. **Give the Function its two secrets** (each prompts you to paste; nothing goes in a file). *Unrun.*

```
cd /Users/hau/projects/freelance/v-robotic/main/web && npx --yes wrangler@4.152.0 pages secret put REBUILD_HOOK_SECRET --project-name=v-robotic
```

```
cd /Users/hau/projects/freelance/v-robotic/main/web && npx --yes wrangler@4.152.0 pages secret put GITHUB_DISPATCH_TOKEN --project-name=v-robotic
```

For the first paste the 64 characters from step 6; for the second the token from step 5. You will see "Success! Uploaded secret ..." for each. (If your trunk checkout is elsewhere, change the folder.)
8. **The Strapi webhook.** Strapi admin > Settings > Webhooks > Create new webhook: Name `Publish site`; URL `https://v-robotic.pages.dev/api/rebuild` (use the real address from the preflight); Headers: key `Authorization`, value `Bearer ` followed by the 64 characters; Events: tick Entry > Publish, Unpublish, Delete, and Media > Create, Update, Delete. Save. Press **Trigger**: it should say it worked (HTTP 200) and no run starts, which proves the secret matches.
9. **Install the backup on the existing box.** `<box address>` is the static address from P6's output, `<key>` the key file P6 left in its key folder. *Unrun.*

Copy the three files, then install:

```
scp -i <key> /Users/hau/projects/freelance/v-robotic/main/ops/box/params.sh /Users/hau/projects/freelance/v-robotic/main/ops/box/backup.sh /Users/hau/projects/freelance/v-robotic/main/ops/box/95-backup.sh ubuntu@<box address>:/tmp/
```

```
ssh -i <key> ubuntu@<box address> 'sudo bash /tmp/95-backup.sh'
```

You will see the packages install, the timer enabled, and a line `BACKUP_OK /var/backups/strapi/strapi-... kept=1` from the journal. A new box built from `run-all.sh` already has this step.
10. **The real test.** In Strapi edit a product and press Publish. Within a minute the Actions tab shows a `web-deploy` run started by you (it shows as dispatched, content_source strapi); about two to four minutes later the live product shows the change. If no run appears, the Function's answer is in Cloudflare > Workers & Pages > v-robotic > Functions > Real-time logs.

Optional, recommended: in the Lightsail console enable **automatic snapshots** on the instance (Snapshots tab). It is the only thing here that survives the box being deleted; it costs about 5 US cents per GB-month of snapshot.

## Restore (the design, not exercised)

On the box, as root: `systemctl stop strapi`; `gzip -dc /var/backups/strapi/<set>/data.db.gz > /var/lib/strapi/data.db`; `chown strapi:strapi /var/lib/strapi/data.db`; if uploads are lost, `rsync -a /var/backups/strapi/uploads-mirror/ <app>/public/uploads/` and `chown -R strapi`; `systemctl start strapi`. If the box is gone: a new box (P6), then the same, from wherever a copy survived. The seed re-imports the starting content but not the client's edits.

## Likeliest first-run failures

1. The dispatch returns 404 or 403 (the relay logs `github_refused 404`): the token lacks *Actions: write*, is on the wrong repository, or `web-deploy.yml` is not on `main` yet.
2. Cloudflare does not route `/api/rebuild`: the Function was not in the deploy (step 2 skipped).
3. The run stops at the box-health step: `STRAPI_URL` wrong, certificate not issued, or the box is down. The live site is untouched.
4. A strapi build succeeds with the warning "no page uses an image from the box": the box has no uploads (step 1 not done), or images come from another address.
5. The backup unit fails on `df`/permissions: `journalctl -u strapi-backup`.
