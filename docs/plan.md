# V-ROBOTICS website — the plan to an MVP

Written 2026-11-07, from the client brief and the 13 reference screens. Those stay out of the repo,
in `notes.local/` on Hau's machine, because they are the client's material; this file and
[architecture.md](architecture.md) are the committed record of what was decided from them.

Target: a live site people can look at, as soon as possible. Tests, walks and the full four-stage
check are deliberately skipped — see "What we are giving up" at the end.

---

## What the screens actually ask for

The brief described the catalog page. The 13 screens describe a good deal more. Laid out, the site
is 14 pages:

| # | Screen | Page | What it needs |
|---|---|---|---|
| 01 | Danh mục sản phẩm | `/san-pham` | Sidebar filter, search, industry filter, card grid |
| 02 | Chi tiết sản phẩm | `/san-pham/[slug]` | Gallery, status badges, 4 info blocks, 2 CTAs, 6 tabs |
| 03 | Giải pháp theo ngành | `/giai-phap` | 12 industry cards |
| 04 | Chi tiết giải pháp | `/giai-phap/[slug]` | Hero, 4-step journey, caveat bar, CTA |
| 05 | Dịch vụ | `/dich-vu` | 4 service cards, each sending a request |
| 06 | Công nghệ AI | `/cong-nghe-ai` | 6 capability cards, static copy |
| 07 | Showroom | `/showroom` | 5 city tabs, showroom card, booking panel |
| 08 | Hợp tác | `/hop-tac` | 6 partner types, each sending a proposal |
| 09 | Về chúng tôi | `/ve-chung-toi` | Logo, 3 principles, static copy |
| 10 | Trợ lý AI | `/tro-ly-ai` | **A live chat with handoff. Not static.** |
| 11 | Đặt lịch showroom | `/showroom/dat-lich` | 4-step booking form |
| 12 | Bảo hành / sửa chữa | `/dich-vu/bao-hanh` | Ticket form **with photo/video upload** |
| 13 | Liên hệ B2B | `/lien-he` | Contact form, phone, consent checkbox |

**There is no home page in the screens**, and no "Trang chủ" in the nav. One is now designed — eight
bands, laid out in [architecture.md](architecture.md#the-homepage) — built entirely from components
the other pages already need, which is why it costs about half an hour rather than a piece of its
own.

Two things in that list are much heavier than they look: the AI chat (10) and five separate form
flows. They are where an "MVP asap" quietly turns into a month. The plan below cuts both down. The
file upload on the warranty ticket (12) stays in, via R2.

---

## The four cuts that make this an MVP

**1. Five forms become one.** Contact, showroom booking, service request, partnership proposal and
warranty ticket are the same act: someone tells us who they are and what they want. One `lead`
record with a `kind` field and a few optional extras carries all five. Five page layouts, one
back end, one spam defence, one inbox. This is the single biggest saving in the plan.

**2. The AI chat becomes a form, for now.** Screen 10 needs a language model, a conversation store,
a handoff rule and a staffed inbox — that is its own project. For the MVP, `/tro-ly-ai` keeps the
layout and the quick-choice buttons, but choosing one fills in a short "tell us your need" form
instead of starting a conversation. Nothing is lost that we can't add later, and the page still does
its job: it captures the lead.

**3. Page prose is in the code; facts the client owns are in the CMS.** About, Công nghệ AI, Dịch vụ
and Hợp tác are fixed copy that changes twice a year, and putting them in Strapi roughly doubles the
CMS work for no near-term gain. But **brand and contact are not prose, they're facts** — the logo,
the brand name, the tagline, the phone number, the Zalo and WhatsApp handles, and the email, address
and legal entity that screen 13 says are still being verified. Those go in a `site_settings` single
type the client controls, along with a switch for the "BẢN MẪU THIẾT KẾ" band so they can take it
down themselves at launch. Costs about twenty minutes, folded into P1 and P2a. Any page prose can be
promoted into the CMS later in an afternoon if it turns out to move more than expected.

**4. Photo attachments are out.** They were a cut, then R2 looked cheap enough to put them back, and
they are now out again — on a closer look at who could actually open a support photo once it was
stored. The warranty form still ships; it just doesn't take a file, and says a technician will ask
for photos when they make contact.

This turned out to be the largest cut of the four. It removes a bucket, a CORS rule, an endpoint, a
storage credential, a signing library, a lifecycle rule, the size-check-after-upload problem, the
single-use-Turnstile problem, and an entire piece for the admin viewer — about 100 minutes of build
and two of this design's four standing risks.
[architecture.md](architecture.md#photo-attachments-deferred) keeps the reasoning and the shape to
rebuild from, so the decision can be reversed without being re-derived.

---

## The order of work, and why it is this order

The client edits content at launch, so **Strapi is in the MVP, not a later phase**. That changes one
thing sharply: the riskiest assumption in the whole brief — that Strapi runs usably on a 512 MB box
— can now hold up the launch. So it gets tested first, before anything is built on top of it.

**The spike goes at the front.** Stand the box up, run Strapi, open the admin, measure. An hour,
and it either confirms the hosting plan or changes it while changing it is still free. Finding this
out at the end, with 15 pages already written against it, is how a week disappears.

Two things survive from the earlier plan. The **site still goes live early**, on seed data, before
the CMS is behind it — partly because building pages against a file is faster than against a live
API, mostly because a site that's already live is a site you can judge. And the **shape of the
content is settled first**: the Astro site is written against one content shape, filled by seed JSON
at first and Strapi later, so swapping the source is a one-file change rather than a rewrite.

### The spike — answer the hosting question

| | Piece | What it ends with | Est. |
|---|---|---|---|
| S0a | A Strapi build that can reach the box | `cms-build.yml` on Actions (ubuntu x64): install, `strapi build`, tar the artifact, plus the step that puts it on Lightsail. P6 reuses it unchanged | ~40 min |
| S0b | Strapi on 512 MB, for real | A box with swap, that artifact running, the admin opened and timed, memory measured under load — a yes or no on the 512 MB plan | ~45 min + your console steps |

**S0 was one piece and is now two, because as written it could not start.** "Stand the box up, run
Strapi" needs a *built* Strapi, and nothing in the plan produced one. Building it on your Mac does
not transfer: your machine is arm64, the box is x86-64, and `better-sqlite3` is a native module —
the brief said so and an earlier draft of this plan dropped it. A slice of P6 was hiding inside the
spike; better to name it than to meet it.

Two consequences. My claim that you run the spike while I build P0 and P1 holds only for S0b — S0a
is on the spike's own critical path. And S0b's number is a **floor**: it runs a bare Strapi, while
the live one also carries i18n, the R2 provider and sharp. If the floor is uncomfortable, the
ceiling is worse. Node version gets pinned identically on the box, in CI and on your Mac.

I can't run the AWS CLI in my sandbox, so the console and `aws` steps come to you as commands to
paste.

### Then — the site, on seed data

| | Piece | What it ends with | Est. |
|---|---|---|---|
| P0 | Monorepo scaffold: `cms/`, `web/`, conventions | `pnpm dev` runs an empty Astro site; the Functions folder shape and deploy command decided | ~30 min |
| P1 | The content contract | `web/src/content/types.ts` first — the adapter's output types — then Strapi schemas and seed JSON that both conform to it. Rich text is Markdown | ~60 min |
| P2a | Site shell + catalog | Nav, footer, design tokens, `/san-pham` with client-side filter and search over a build-time index, `/san-pham/[slug]`. Every string through `t()` over `vi.json` | ~60 min |
| P2b | The remaining pages | Industries, services, AI tech, showroom, partnership, about, contact. The four code-side lists live in `content/*.json`, not in templates | ~60 min |
| P2c | Homepage | The eight bands, from P2a/P2b components | ~30 min |
| P3 | The lead path | `packages/lead-schema` — kinds, fields, validation — imported by both the forms and the Worker. Turnstile, the email provider, `_site/settings.json` | ~50 min |
| P4 | Site live | Cloudflare Pages + GitHub Actions, with noindex on until launch | ~30 min |

**At the end of P4 the site is on the internet, in Vietnamese, with placeholder catalog data, a
homepage, and every form delivering a lead to your inbox.** Not launch — the client can't edit yet.
But it's real, and you can judge it.

### Then — the CMS behind it, which is launch

| | Piece | What it ends with | Est. |
|---|---|---|---|
| P5 | Strapi locally | Types created, seed imported, the adapter mapping Strapi's REST shape into the P1 types | ~50 min |
| P6 | Lightsail, for keeps | The deploy recipe as parameterised scripts: artifact transfer, prod install with Strapi stopped, SQLite path outside the deploy dir, systemd unit, Caddyfile and sslip.io hostname, swap and swappiness persisted, SSH restricted, R2 media provider, client accounts | ~90 min + your console work |
| P7 | The loop closes | `/api/rebuild` relaying Strapi's webhook to Actions, a concurrency group on the build, nightly `sqlite3 .backup` by cron **on the box** | ~40 min |

**At the end of P7 the client logs in, changes a product, and sees it live two minutes later.**
That is launch. Roughly 8.5 hours of machine work, plus your console steps and review passes.

P6 went from 60 to 90 minutes because "Actions builds, the box only serves" was a principle with no
procedure under it, and P7's backup moved from Actions to a cron on the box — Actions cannot reach a
SQLite file on Lightsail. Writing P6 as scripts taking name, port, domain and bucket as variables
costs nothing now and is the whole difference between a second client being a copy and a
re-derivation.

### After launch

| | Piece | What it ends with | Est. |
|---|---|---|---|
| P8 | English | `en.json` filled, Strapi localization populated, switcher shown | ~60 min |

I'd ship Vietnamese only at MVP and hide the language switcher, with routes already built to take
`/en/`. The estimate rose because an earlier draft priced it as a translation job; it is only that
if the strings are already in a dictionary, which is why P2a puts them there from the first page.
Two things to settle at P5, not now: whether route segments are translated (`/en/san-pham` or
`/en/products`), and whether Strapi carries relations across locales or needs them re-linked.

---

## Three places I'd change the brief

**Media should go to R2, not the instance disk.** The brief stores Strapi uploads on the Lightsail
disk and copies them to R2 nightly. Pointing Strapi's upload provider at R2 directly is better on
every axis: images serve from Cloudflare with no egress charge instead of from a 512 MB box in
Singapore, the 20 GB disk stops being a ceiling, and the nightly uploads backup disappears because
the uploads already live where that backup was going. Only SQLite then needs backing up. We're
standing R2 up for the durable lead copies and the nightly backups anyway, so this costs nothing
extra.

**Leads should not post to Strapi directly.** The brief has the public site calling Strapi's public
create endpoint. That means the open internet can write to the database, and it puts the server's
address in the page source. Instead, the form posts to a small Cloudflare Function, which checks a
Turnstile token and forwards it on. Free, hides the server, gives us rate limiting and spam defence
in one place — and in Phase 1 it can simply email the lead, with no server in the picture at all.

**Build Strapi's admin panel off the box, always.** Strapi's admin is a front-end build, and it is
the single hungriest thing that will ever run on a 512 MB instance. CI builds it, the box only ever
serves it. The brief says never build on the instance; this is the specific trap it protects against.

And one thing to go in with eyes open: **Strapi on 512 MB is the main technical risk**, as the brief
says — and now that the client edits at launch, it's a risk that can hold up the launch. 2 GB of
swap and a capped heap should hold it, but the admin panel may feel slow, and "slow enough that the
client stops using it" is a failure even if nothing crashes. That's the bar S0 measures against, and
it measures it before anything is built on top. If it fails, the answer is the 1 GB plan — a few
dollars more, not a redesign.

---

## What is actually on the critical path

Not the code. **Photographs.** The reference images are crops from posters with text cut off at the
edges, and some captions don't match their cards. No amount of good layout survives bad product
images, and they are the one thing I can't produce.

Usefully, the designer already planned for this: screen 02 carries "TÊN MODEL TẠM" and "CHỜ HỒ SƠ
KỸ THUẬT" badges. The MVP keeps those badges and ships honestly — a catalog that says which models
are still provisional is better than one that pretends. But the real photos and the 35-model
specification list are what turn this from a demo into a site, and gathering them should start now,
in parallel with everything above.

One thing has just come **off** this path: brand. Logo, name, tagline and contact details are now
client-editable fields rather than code, so a placeholder logo at launch costs an upload to fix
rather than a release. Worth knowing when you're deciding what to chase first — chase photographs.

---

## Decisions taken, so nobody has to re-ask

Settled, each reversible, each written here so the next session doesn't reopen it:

| | Decision | Why |
|---|---|---|
| Framework | Astro | Static site; ships less, costs nothing to run |
| Forms | One `lead` record, seven kinds | Five flows are one act with different fields |
| AI chat | A form at MVP, keeping its layout | A real chat is its own project |
| Uploads | Direct browser → private R2, Cloudflare Worker issues the slip | No size ceiling, no server, bucket stays private |
| Downloads | Strapi presigns behind its own login; the Worker never presigns a read | Identity check, not a bearer link |
| Worker vs Lambda | Worker, as a Pages Function | Native R2 binding, one deploy, no cross-cloud keys |
| Brand & contact | `site_settings` single type, every field optional | Client-editable; screen 13 says they're pending anyway |
| Hero headline & sub | In `site_settings` too | Near-free, and exactly what a client fiddles with |
| Lead destination | A `lead_notify_email` field, seeded to Hau's address | Makes the open question a field the client can change |
| Page prose | Stays in code | Changes twice a year; promotable in an afternoon |
| Localization | Every customer-facing field localized from the start, VI filled only | Free while empty, a migration once it isn't |
| Catalog data | Placeholders carrying the designer's own badges | Ships honestly; real data swaps in as it arrives |
| Spike pass mark | Admin under 3s, save under 2s, no OOM restart in 10 min | Miss it and we take the 1 GB plan ($5 → $7) |

### Added after review

Two independent reviews on a different model read both documents before any code was written. They
left the architecture alone and took the contracts apart; these came out of it:

| | Decision | Why |
|---|---|---|
| Rate limit | Dropped | Pages Functions are stateless and pages.dev has no WAF; Turnstile carries it |
| Rebuild | A third Function relays Strapi's webhook | `repository_dispatch` needs an `event_type` Strapi can't send; direct = 422 |
| Backup | A cron on the box | Actions cannot reach SQLite on Lightsail |
| Notify address | Build writes `_site/settings.json`; Worker reads that | The Worker never calls Strapi, so it can't read `site_settings` |
| Email | A single-sender-verified provider, named | No custom domain, so domain-verified senders won't send |
| Catalog types | One `product` with `kind`, not three collections | Screen 01 shows them in one grid; software had no type at all |
| Badges | Two booleans, not one enum | Screen 02 shows both at once; `published` collided with Strapi's own |
| Specs | A repeatable component | A JSON blob blocks filtering, comparison and any calculator |
| Lead refs | Slugs + `details` + `schema_version`, not relations | The Worker has no Strapi at first, and R2 copies have no migration |
| SEO | A `seo` component, and noindex until launch | P4 publishes placeholder slugs to a public URL Google will index |
| Strings | A `t()` dictionary from P2a | Otherwise P8 is half a day of extraction, not a translation |
| Reuse | `packages/lead-schema`; P6 as parameterised scripts | The only parts worth lifting to a next client, free if built that way |
| Multi-tenant | No, deliberately | Strapi CE has no per-row admin permissions; two clients would see each other |

Nothing is open. The attachment question that was the last one standing was answered by dropping
the feature, which removed the question rather than settling it — the cheapest kind of answer, and
worth noticing as a pattern: two of the four cuts in this plan came from asking what a feature
really costs rather than how to build it well.

## What we are giving up

You asked to skip tests and walks, so this is stated rather than argued:

- No test suite, and no local verification stage. The first real check of each piece is you looking
  at it.
- That makes the **visual check the only safety net**, so it matters that it happens — one pass over
  the live Pages URL at the end of P4, and again at the end of P7.
- Browsers can't run in my sandbox, so screenshots have to come from your terminal.
- The AWS CLI can't run in my sandbox either. P6's Lightsail steps come to you as commands to paste.
- Technical debt we are knowingly taking on: no AI chat, no English, marketing copy in code, and
  placeholder catalog data. Each is written above with the way back.
