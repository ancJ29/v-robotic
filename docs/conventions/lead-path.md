# The lead path (piece P3)

Decisions a later session should not re-derive. Each is reversible except where it says otherwise. The design is in `docs/architecture.md` ("Sending a lead", "The Worker"); this note is what was built and what was decided on top.

## The rule that matters most: which half may fail

**R2 is the record of truth; the notification is a best-effort extra. The order is fixed: validate, check Turnstile, write R2, and only then notify.**

- A failed or absent notification **never** fails a submission. The visitor sees success once the lead is stored. With no `SLACK_WEBHOOK_URL` the notifier logs and returns normally; a Slack error is caught, logged, and ignored.
- A failed R2 write (after one retry) **does** fail, loudly: HTTP 503, and the form says nothing was saved, keeps everything typed, offers a retry and, when `site_settings` has them, the phone and email. At that point the lead really is lost unless the visitor tries again. No notification is sent in that case, because there is no record to point at.
- P7 and whoever adds Slack for real: keep it this way round. Do not add a path where the notification gates the answer.

Code: `web/functions/_lib/handle-lead.ts` (`handleLead`), tested in `web/test/lead-handler.test.mjs`.

## Shape and files

- **One record, `LeadRecord`, seven kinds:** `contact`, `consult`, `service`, `showroom_booking`, `partnership`, `warranty`, `ai_assist`. **Five form pages** use them: `/lien-he` carries three kinds on one layout (`consult` when the address has `?product=<slug>`, `service` when it has `?service=rent|finance|deploy`, else `contact`); `/showroom/dat-lich`, `/dich-vu/bao-hanh`, `/tro-ly-ai` and the form on `/hop-tac` carry one each. The brief said six layouts; the screens give five distinct ones and the three contact kinds differ only in which fields show, so they share a layout rather than becoming three.
- **Field names follow the architecture memo's LEAD entity** plus `id`. Top-level: `schema_version, id, kind, created, locale, source_page, name, phone, email, company, message, product_slug, line_slug, industry_slug, showroom_slug`; per-kind extras in `details` (`need_group, service_type, partner_type, need, stage, serial, preferred_date, consent`). Missing optional values are `null`, never absent.
- **`schema_version` is 1 and is in the first write.** It is also written as R2 object metadata. Changing the shape means bumping it, never editing in place: R2 files cannot be migrated.
- **`packages/lead-schema/src/index.ts` is the single definition:** kinds, field lists per kind (control, required, max length, where it lands), `validateLead`, `buildRecord`. The browser and the Worker import the same functions, so they cannot disagree. Errors are machine codes (`required`, `invalid_phone`, ...), never words.
- **Required by kind** (see `FIELDS`): everyone needs name, phone and the data-notice checkbox; contact/consult add the need group; service adds the service type; booking adds showroom and date; partnership adds partner type and company; warranty adds robot serial and the fault description; AI adds industry, need and stage. Email is optional everywhere (screen 13 says "nếu có"). A consent checkbox is required on every form, not only on screen 13's, since every form collects a stranger's phone number.
- **`packages/lead-schema` is a plain folder, not a pnpm workspace member,** and is imported by relative path. A workspace package needs a lockfile change, and with the network filtered pnpm could not complete its supply-chain check on a changed lockfile (`ERR_PNPM_NO_OFFLINE_META`). Nothing is lost: promote it with `pnpm install` on a networked terminal when convenient. Its tests are run by `web`'s `test` script.
- **The Function:** `web/functions/api/lead.ts` (Cloudflare Pages Function, `POST /api/lead`) only forwards to `handleLead`. Helpers in `web/functions/_lib/`: `env.ts` (every environment name), `turnstile.ts`, `notify.ts`. Endpoint path is `/api/lead` (the memo's).
- **R2 object name:** `leads/<YYYY-MM-DD>/<kind>-<id>.json`, the date from the Worker's clock. `id` is the browser's per-submission UUID if valid, else generated, so a retry of one submission rewrites one object instead of making two.

## Spam and safety

- **Turnstile**, widget rendered by the page script, token checked by the Worker against Cloudflare's `siteverify`. Validation runs **before** the check so a typo does not spend the single-use token. A wrong or missing token is 400 `captcha`; **Cloudflare unreachable is 503, not 400** (the visitor is not at fault; fail closed rather than open).
- **Honeypot:** a hidden text field `website`; filled means a bot, answered with a fake success and nothing stored.
- **Also:** same-origin check (a different `Origin` is 403), 16 KB body cap, unknown fields dropped, control characters stripped.
- **Rate limiting by IP is not built.** The memo listed it; Pages Functions have no counter without KV or a Durable Object. Set a Cloudflare dashboard rate-limiting rule on `/api/lead` at P4 instead (a setting, no code). Turnstile and the honeypot are the defences until then.
- **Test keys only.** Site key `1x00000000000000000000AA` (the default when `PUBLIC_TURNSTILE_SITE_KEY` is unset) and secret `1x0000000000000000000000000000000AA` always pass; `2x0000000000000000000000000000000AA` always fails. Real keys arrive at P4. A page built with the test site key will fail verification against a real secret, which is the safe direction.

## Environment names

| Name | Where | What |
|---|---|---|
| `LEADS` | Pages binding (R2) | the private bucket; the only storage grant |
| `TURNSTILE_SECRET_KEY` | Pages secret | server-side spam check |
| `PUBLIC_TURNSTILE_SITE_KEY` | build-time variable | widget key, printed into the page |
| `SLACK_WEBHOOK_URL` | Pages secret | the notifier; absent or empty = no notification |

Placeholders: `web/.dev.vars.example`. `.dev.vars` and `web/.dev-leads/` are git-ignored. There is **no** notification address in the CMS and no email variable; `lead_notify_email` was removed from the schema, types, seed, generated types and memo.

## The notification: Slack, minimal on purpose

**Replace the notifier in `web/functions/_lib/notify.ts`, function `sendLeadNotification(env, record, fetchFn)`.** It is the only place a channel is named; the handler calls it and treats a throw as "log and carry on". Add any new environment name to `LeadEnv` in `env.ts`.

**The message carries the kind, the time, the company (else the given name, the last word of a Vietnamese name), a short reference and the R2 key; never phone, email, message text or surname.** A Slack channel is a third party with its own history and its own notifications for everyone in it, and these are a prospect's personal details; the full record is in R2 either way, and the key says where. The cost is one extra step to read a lead. Widening the message is a one-line change in `formatSlackMessage`, and should be a decision, not a drift.

## What a visitor sees

- **Success:** the form is replaced by "Đã nhận yêu cầu của bạn", a sentence specific to the kind (the booking says the date is not confirmed yet; the warranty says a technician will ask for photos), and a reference (first 8 characters of the id) and a button to send another.
- **Field errors:** inline under each field, in `vi.json` (`lead.error.*`), with a summary line and focus on the first; the same codes come back from the Worker if the browser check was bypassed.
- **Anything else wrong:** a box above the button that says what happened and that **nothing typed is lost**; the form is never cleared on failure. Cases: Worker unreachable or timed out after 15 s (network), 503 (nothing saved), captcha not solved or failed (the widget is reset, since tokens are single-use), spam widget script blocked (reported after 10 s). The box also offers the phone and email from `site_settings` when they exist; the form never depends on them.
- **JavaScript is required to send.** Turnstile needs it anyway, so a plain HTML post would only move the failure. Without JS the form shows a sentence telling the visitor to enable it or use the direct contact details.
- **No file upload, anywhere.** The warranty page says a technician asks for photos when they make contact (the screen's "add photo" button is deliberately not built).

## Strings

Every visible string is in `web/src/i18n/vi.json` under `lead.*` (field labels, option labels, errors, failure and success text, per-kind submit buttons, success sentences) or in page prose `web/src/copy/` (`booking.ts`, `warranty.ts`, `assistant.ts`, plus additions to `partners.ts`, `services.ts`). The only Vietnamese outside the lookup is the Slack message, which goes to staff, not visitors (`notify.ts`). `contact.formPending` was removed.

## Components and pages

- `LeadForm.astro` renders the fields the schema lists for the given kinds; `lib/lead-form.ts` is its browser script; `lib/lead-choices.ts` supplies showroom, line and industry choices and the fallback phone/email from the CMS content. `FormBand.astro` (card plus side panel grid) and `FormSteps.astro` (dark numbered panel) are shared by all four form pages and the partnership form.
- **Showrooms in the booking form:** all are choosable; one not yet open says "(đang hoàn thiện)" or "(dự kiến)" in its choice. No address or hours are printed, so `details_confirmed` cannot leak.
- **`/hop-tac`:** the partner cards link to `/hop-tac?type=<id>#dang-ky`, which preselects the partner type; the closing button goes to the form.
- **`/dich-vu`:** the rent, finance and deploy cards link to `/lien-he?service=<type>`.
- **Screen differences:** screen 10 is drawn as a chat; it is a form with the assistant's greeting above it, and the screen's side panel (a handover summary with "priority" and "owner" rows that imply automation) became a plain list of what is sent. Screen 11's four numbered tabs are not built (the form is one page); its five fixed cities become the CMS showrooms (three in the seed). Screen 12's "add photo or video" is replaced as above. Screen 13's phone number is not written anywhere in the repository.
- **Local look:** `astro dev` mounts the real handler at `/api/lead` through `web/dev/lead-api.mjs` and writes leads as files under `web/.dev-leads/`. Production never uses it.

## Verification, and what was not run

- `web/test/lead-handler.test.mjs` calls the real `handleLead` with in-memory fakes for R2, `siteverify` and Slack; `packages/lead-schema/test/` tests the schema. Both run in `pnpm check`.
- **The local Workers runtime was not run.** `wrangler` is not installed and cannot be fetched with the network filtered, so the Function was tested as plain functions, plus once through `astro dev`'s real handler against Cloudflare's real `siteverify` with its documented test secrets.
- **The browser script and the layouts have not been seen rendered or executed**; no browser starts in this sandbox. They are type-checked and bundled by the build.
