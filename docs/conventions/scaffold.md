# Scaffold conventions (piece P0)

Decisions a later session should not re-derive. Each is reversible.

- **Layout:** `cms/` (Strapi 5, TypeScript, SQLite) and `web/` (Astro, TypeScript strict), listed in `pnpm-workspace.yaml`. Later pieces add `content/` and `packages/lead-schema` to the globs when they exist.
- **Package manager:** pnpm 12, pinned by `packageManager` in the root `package.json`. One lockfile at the root.
- **Node:** `.nvmrc` says 24 (LTS). Both apps accept 22.23.4 or newer (Astro's floor; Strapi allows up to 26); `engines` says `>=22.23.4 <27`. CI and the box pin the same major.
- **Ports:** Strapi 1337 and Astro 5173, both fixed. Astro runs with `--strictPort`, so it fails rather than taking another port. Astro binds 127.0.0.1.
- **Scripts:** root `pnpm dev` runs both apps; `pnpm dev:cms`, `pnpm dev:web` run one; `pnpm build`, `pnpm check` run in both. In `web`, `check` is `astro check`; in `cms`, `tsc --noEmit`.
- **Env:** `cms/.env.example` holds placeholders only; copy to `cms/.env`. `.env` is git-ignored. Generate real secrets with `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`.
- **Strapi database:** SQLite at `cms/.tmp/data.db`; `DATABASE_FILENAME` moves it (the box keeps it outside the deploy dir, piece P6).
- **Noindex:** both apps serve `robots.txt` disallowing all, and the page carries `noindex`, until launch (plan: SEO row).
- **No lint/format tool yet:** nothing calls one. Added when a piece needs it.
- **Scaffolded by hand,** because `create-strapi-app` is interactive and `create-astro` fetches its template from GitHub, which the sandbox cannot reach.
- **Functions folder:** Pages Functions will live in `web/functions/` (Cloudflare Pages looks there next to the built site's project root); not created until P3.
- **Build scripts:** pnpm 12 runs no dependency install scripts unless named; `allowBuilds` in `pnpm-workspace.yaml` allows `@swc/core`, `esbuild` and `better-sqlite3`, and refuses `core-js-pure`.
- **Override:** `@emnapi/runtime` is pinned to 1.11.3 in `pnpm-workspace.yaml`; without it `astro check` crashes loading the compiler (a 2.0 beta runtime against emnapi core 1.x). Drop it once Astro's tree resolves cleanly.
- **Dev servers daemonize:** `astro dev` (v7) detaches itself, and `strapi develop` leaves a worker behind when its parent is killed. Stop Astro with `pnpm --filter web exec astro dev stop` from the shell that started it; Strapi by the PID listening on 1337. A sandboxed session cannot signal either afterwards.
- **Telemetry:** in the sandbox, Astro dies on `EPERM` creating `~/Library/Preferences/astro`; run it with `ASTRO_TELEMETRY_DISABLED=1`. Strapi: `STRAPI_TELEMETRY_DISABLED=true`.
- **A fresh worktree needs a root `pnpm install` before `pnpm check` means anything:** without it `cms` has no `node_modules`, `tsc` fails with TS2688 (no `@types/node`), and that failure aborts the `web` check too, so a green-looking refactor reads as broken code. `pnpm install --offline --frozen-lockfile` works from the local store with no network and changes no tracked file. Every piece's brief should say so.
