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

## The three cuts that make this an MVP

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

**File upload is no longer a cut.** It was, until R2 made it cheap: the browser uploads straight to
a private R2 bucket with a short-lived permission slip from a Cloudflare Function, so the file never
passes through a Worker and nothing needs a server. It ships in the MVP, and the upload path stands
up before Lightsail does. The flow — and the answer to who can read an attachment — is drawn in
[architecture.md](architecture.md#uploading-a-photo-to-a-support-ticket).

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
| S0 | Strapi on 512 MB, for real | A Lightsail box with swap, Strapi running, the admin opened and timed, memory measured under load — and a yes or no on the 512 MB plan | ~45 min + your console steps |

I can't run the AWS CLI in my sandbox, so the console and `aws` steps come to you as commands to
paste. While you're doing those, I build P0 and P1 — they don't depend on the answer.

### Then — the site, on seed data

| | Piece | What it ends with | Est. |
|---|---|---|---|
| P0 | Monorepo scaffold: `cms/`, `web/`, conventions | `pnpm dev` runs an empty Astro site | ~30 min |
| P1 | The content contract | Strapi schema files **and** a matching folder of seed JSON: 7 lines, 35 placeholder models, 12 industries, 5 showrooms | ~50 min |
| P2a | Site shell + catalog | Nav, footer, design tokens, `/san-pham` with working filter and search, `/san-pham/[slug]` | ~60 min |
| P2b | The remaining pages | Industries, services, AI tech, showroom, partnership, about, contact | ~60 min |
| P2c | Homepage | The eight bands, from P2a/P2b components | ~30 min |
| P3 | The lead path | One `lead` shape, six form layouts, Turnstile, a Cloudflare Worker that takes the post | ~40 min |
| P3b | Attachments | Private R2 bucket, the presigned-upload Worker, a lifecycle rule, the warranty ticket's file picker | ~30 min |
| P4 | Site live | Cloudflare Pages + GitHub Actions build | ~30 min |

**At the end of P4 the site is on the internet, in Vietnamese, with placeholder catalog data, a
homepage, and leads and support tickets arriving with photos attached.** Not launch yet — the client
can't edit. But it's real, and you can judge it.

### Then — the CMS behind it, which is launch

| | Piece | What it ends with | Est. |
|---|---|---|---|
| P5 | Strapi locally | Types created, seed imported, the site builds from Strapi instead of JSON | ~50 min |
| P6 | Lightsail, for keeps | Caddy, process manager, R2 media provider, admin accounts for the client | ~60 min + your console work |
| P7 | The loop closes | Publish in Strapi → webhook → Pages rebuilds; nightly SQLite backup to R2 | ~30 min |

**At the end of P7 the client logs in, changes a product, and sees it live two minutes later.**
That is launch. Roughly 8 hours of machine work in total, plus your console steps and review passes.

### After launch

| | Piece | What it ends with | Est. |
|---|---|---|---|
| P8 | English | Strapi localization on, EN routes filled, switcher shown | ~40 min |

I'd ship Vietnamese only at MVP and hide the language switcher, with the routes already built to
take `/en/`. Writing and checking a second language of marketing copy is a real cost and it buys
nothing until a foreign customer is actually looking.

---

## Three places I'd change the brief

**Media should go to R2, not the instance disk.** The brief stores Strapi uploads on the Lightsail
disk and copies them to R2 nightly. Pointing Strapi's upload provider at R2 directly is better on
every axis: images serve from Cloudflare with no egress charge instead of from a 512 MB box in
Singapore, the 20 GB disk stops being a ceiling, and the nightly uploads backup disappears because
the uploads already live where that backup was going. Only SQLite then needs backing up. We're
standing R2 up for ticket attachments anyway, so this costs nothing extra.

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
| Spike pass mark | Admin under 3s, save under 2s, no OOM restart in 10 min | Miss it and we take the 1 GB plan |

That is every open question closed. Nothing is waiting on you except go.

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
