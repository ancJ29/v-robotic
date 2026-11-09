# Strapi locally, the seed imported, the site reading it (piece P5)

Decisions a later session should not re-derive. Each is reversible. This is the piece that proved P1's
contract against the real CMS: the adapter's output equals the seed, field for field, for all 5 types.

## How to reproduce the box

- **Throwaway local values, not the human's credentials, never for a real box.** `cms/.env` (git-ignored): `HOST=127.0.0.1`, `PORT=1337`, `APP_KEYS=p5localkeyA,p5localkeyB,p5localkeyC,p5localkeyD`, `API_TOKEN_SALT=p5localapitokensalt`, `ADMIN_JWT_SECRET=p5localadminjwtsecret`, `TRANSFER_TOKEN_SALT=p5localtransfersalt`, `JWT_SECRET=p5localjwtsecret`, `ENCRYPTION_KEY=p5localencryptionkey`, `STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE=vi`, `STRAPI_TELEMETRY_DISABLED=true`. Admin: `admin@vrobotic.test` / `LocalAdmin#2026`.
- **Order:** `pnpm install --offline --frozen-lockfile` (worked from the local store, no registry host refused), `pnpm --filter cms build` (about 15 s; prints the usual `EPERM ~/Library/Preferences/com.strapi`), then `content/scripts/local-box.sh` with `LOGDIR=<scratch>` and `BUILD=1`.
- **`local-box.sh` is one invocation on purpose:** fresh database, `strapi start` in the background, wait for `/_health`, bootstrap, import twice, compare with the seed, optional site build from Strapi, then it kills the server it started. A sandboxed session cannot signal a Strapi an earlier command left running. Strapi was up in about 4 s from an empty database.
- **`strapi start` (the built `dist/`), not `strapi develop`,** so what runs is what the box will run; `develop` also leaves a worker behind when killed (scaffold note). The schemas must be built first (`dist/` has them, see content.md's build quirk).

## The scripts

- **`content/scripts/strapi-bootstrap.mjs`** creates the first admin when none exists (`/admin/register-admin`), else logs in, then recreates two API tokens through the admin API: `import` (full access) and `site` (read-only), written to `cms/.env.tokens` (mode 600, git-ignored by `.env.*`). It prints no key. A token key is shown by Strapi only once, so it deletes and recreates by name instead of looking for the old key.
- **`content/scripts/import-seed.mjs <locale>`** imports `content/seed/<locale>/*.json` through the REST API, not in-process, so P6 runs the same script against the real box with a URL and a token. Order: site settings, lines, industries, showrooms, products without relations, then every relation (slugs looked up to `documentId`s, same locale). It finds records by slug and updates, so a second run duplicates nothing (proved: 20 products after two runs).
- **REST create/update with `status=published`** publishes at once, so the read-only token (published only) sees the content. The import never leaves a draft behind.
- **`web/scripts/compare-with-seed.mjs`** reads a running Strapi through the site's own adapter and `deepStrictEqual`s each type against the seed. This is the machine proof of the contract; run it after any schema or adapter change.

## The switch

- **`CONTENT_SOURCE` = `seed` (default, also when unset) or `strapi`, read in `web/src/content/load.ts` only.** The default is the seed so the finished deploy (P4) keeps working with no Strapi. Anything else throws. Settings: `STRAPI_URL` (default `http://127.0.0.1:1337`), `STRAPI_TOKEN` (the read-only key), `STRAPI_PUBLIC_URL` (prefix for relative media paths when the build reaches Strapi by a different address than visitors do).
- **`strapi` with no Strapi reachable fails the build** (`fetch failed`, measured), it never falls back to the seed by itself: a silent fallback would publish stale content and nobody would see it. The fallback is a decision made by whoever sets the variable (P7's workflow).
- **Top-level `await` in `load.ts` keeps `getContent()` synchronous,** so not one page or component changed. If the loader ever moves out of the build, the cost is an `await` in each page's frontmatter.
- **The adapter is `web/src/content/strapi.ts`:** `mapContent` is pure and tested (`web/test/strapi-adapter.test.mjs`), `fetchContent` is the only network part. It reads every page of each collection (Strapi caps a page at 100) and any non-200 answer throws, so a half-read catalogue cannot build. Relations are asked for as `fields=slug` only; components and media in full.
- **Catalogue order is creation order (`sort=createdAt,id`),** the seed's order. Not `id`: measured, an edit in the admin re-publishes the row under a new id and moved the product to the end of the list. A client who reorders products needs an `order` field, which does not exist yet (flagged in the report).
- **A product edit changes `id` but not `documentId`;** nothing in the contract uses `id`.

## Result

The site built from Strapi and the site built from the seed are byte-identical (`diff -r` of the two output folders: no difference), 36 pages, 49 files.

## The two questions `docs/plan.md#L159` left to P5

1. **Are route segments translated (`/en/san-pham` or `/en/products`)? Decision: not translated; `/en/` is a prefix on the same Vietnamese tree.** Reasons: slugs are not localized and are Vietnamese (`model-tam-1-1`, `nganh-tam-y-te`), so `/en/products/nganh-tam-y-te` would be half translated anyway; one page tree serves both languages, with no second set of page files; `hreflang` pairs differ only by prefix. Reversible because `web/src/lib/routes.ts` is the only URL builder: a translated segment is a lookup there plus page files per language. The human can overrule when the English wording is known.
2. **Does Strapi carry relations across locales, or are they re-linked?** Decision: re-link, by slug, per locale, in the import. Every relation field here has no per-locale sharing setting and a relation in Strapi 5 points at one document in one locale, so an English product cannot be assumed to inherit the Vietnamese product's links. `import-seed.mjs <locale>` already links by slug inside the locale it imports, and slugs are the same in every locale, so P8 runs it with `en` and the links come out right with no dependence on Strapi's behaviour. Not tested against an `en` locale (none exists yet); P8 must check that its first English import links as expected.
