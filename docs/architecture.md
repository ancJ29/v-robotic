# V-ROBOTICS — architecture

Written 2026-11-07, alongside [plan.md](plan.md). Diagrams are Mermaid; VS Code's markdown preview
and GitHub both render them.

The 13 reference screens this is drawn from stay out of the repo, in `notes.local/` on Hau's
machine, because they are the client's material. This file is the committed record of what was
read from them.

---

## The one idea worth holding

**Visitors never reach the server.** Everything a visitor loads is a static file on Cloudflare's
edge. The server exists so that *editors* can change content, and its output is a build, not a
request. Only two things happen at run time — sending a lead, and uploading a photo to a support
ticket — and both are handled by small Cloudflare Functions that never touch Lightsail.

That split is what keeps a 512 MB box viable, keeps the bill near nothing, and means that if the
server falls over at 3am the public site doesn't notice.

Two kinds of time, then, and most confusion about this system comes from mixing them up:

| | Build time | Run time |
|---|---|---|
| **Who triggers it** | An editor publishing, or a push | A visitor submitting a form |
| **What runs** | GitHub Actions, Astro, Strapi's read API | A Cloudflare Function |
| **How often** | A few times a day | A few times a day |
| **If it breaks** | Content goes stale, site stays up | Leads stop; site stays up |

---

## The whole system

```mermaid
flowchart LR
    subgraph Editors["Editors"]
        E["Editor"]
    end

    subgraph Visitors["Visitors"]
        V["Browser"]
    end

    subgraph Lightsail["AWS Lightsail · 512MB · Singapore · Phase 2"]
        CD["Caddy :80 :443<br/>Let's Encrypt · sslip.io"]
        ST["Strapi 5<br/>:1337 · closed to internet"]
        DB[("SQLite<br/>outside deploy dir")]
        PM["pm2 · restarts on crash/reboot"]
    end

    subgraph GH["GitHub"]
        REPO["Monorepo<br/>web/ · cms/ · content/"]
        GA["GitHub Actions<br/>builds Astro + Strapi admin"]
    end

    subgraph CF["Cloudflare"]
        PAGES["Pages<br/>static site on the edge"]
        FN["Pages Functions<br/>/api/lead · /api/rebuild"]
        TS["Turnstile"]
        R2[("R2 · two buckets<br/>media (public)<br/>private: lead copies · backups")]
    end

    MAIL["Slack webhook<br/>best-effort notice"]

    E -->|"edits content"| CD
    CD --> ST
    ST --- PM
    ST --> DB
    ST -->|"media uploads"| R2
    ST -->|"webhook on publish"| GA

    REPO --> GA
    GA -->|"fetch content at build"| ST
    GA -->|"deploy"| PAGES

    V -->|"loads pages"| PAGES
    V -->|"loads images"| R2
    V -->|"submits a form"| FN
    FN --> TS
    FN -->|"lead JSON"| R2
    FN --> MAIL
    FN -.->|"Phase 2 only"| CD

    PM -->|"nightly cron · sqlite3 .backup"| R2
```

Read it as three loops that barely touch each other:

- **The content loop** (editor → Strapi → webhook → Actions → Pages). Slow, occasional, and entirely
  invisible to visitors.
- **The visitor loop** (browser → Pages + R2). Pure static delivery. No server, no database.
- **The lead loop** (browser → Function → R2, then a Slack notice, and in Phase 2 also → Strapi). The only
  writing path from the public internet, and it goes through one door we control.

---

## The order it gets stood up

Everything above is in the MVP — the client edits content at launch, so Strapi is launch-blocking,
not a later phase. What survives from the earlier two-phase plan is the **order**, because building
pages against a live CMS is slower than building them against a file, and because a site that's
already live is a site you can judge.

```mermaid
flowchart LR
    subgraph A["First — site live, seed data"]
        direction LR
        SEED["content/*.json<br/>in the repo"] --> GA1["GitHub Actions"]
        GA1 --> PG1["Cloudflare Pages"]
        FN1["Worker"] --> R21[("R2")]
    end

    subgraph B["Then — CMS behind it · launch"]
        direction LR
        STR["Strapi on Lightsail"] --> GA2["GitHub Actions"]
        GA2 --> PG2["Cloudflare Pages"]
        FN2["Worker"] --> STR
        FN2 --> R22[("R2")]
    end

    A ==>|"swap one adapter"| B
```

The thing that makes the swap cheap is the **content adapter**: the Astro site asks one module for
"all products", "this industry", "the showrooms". At first that module reads JSON from the repo;
later it reads Strapi's API. The 15 page templates never change. Swapping is one file, not a
rewrite — which is exactly why the content shape gets settled in P1, before any page is built.

**What changes now that Strapi is launch-blocking:** its riskiest assumption has to be tested first.
If Strapi won't run usably on 512 MB, that's a hosting decision affecting everything downstream, and
it is far cheaper to learn in the first hour than the sixth. Hence the spike at the top of the
plan — stand the box up, run Strapi, open the admin, measure. One answer, before anything depends
on it.

---

## Sending a lead

All five forms — contact, showroom booking, service request, partnership proposal, warranty ticket —
walk this same path. One record, one door, one spam defence.

```mermaid
sequenceDiagram
    participant V as Visitor
    participant P as Pages (static)
    participant T as Turnstile
    participant F as Function /api/lead
    participant R as R2
    participant M as Slack
    participant S as Strapi (Phase 2)

    V->>P: opens a form page
    P->>T: renders widget
    T-->>V: token
    V->>F: POST lead + token
    F->>T: verify token
    T-->>F: ok
    F->>F: validate · rate limit by IP
    F->>R: write lead JSON (the record of truth)
    F->>M: notify (Slack webhook, after the R2 write)
    opt Phase 2
        F->>S: create lead record
    end
    F-->>V: thank-you state
```

**Two things this flow needs that an earlier draft left as gestures.**

*The notification is a Slack incoming webhook, sent after the lead is safe.* A Worker cannot speak SMTP, and an email
API needs a verified sender or domain this plan does not have, so the email provider question was parked on the
human's call. The notification is one `POST` to `SLACK_WEBHOOK_URL`, best effort, and absent until the human supplies
it. R2 is the record of truth; the message is minimal and carries no contact details. See `docs/conventions/lead-path.md`.

*There is no notification address in the CMS.* An earlier draft put `lead_notify_email` in `site_settings`; the
Function never calls Strapi and holds no read token, so it could not read it. Dropped, not rescued.

Why a Function at all, and not the brief's "post straight to Strapi": that version lets the open
internet write to the database and puts the server's address in the page source. Here the server stays unlisted, spam
is stopped at the edge before it costs anything, and in Phase 1 the whole thing works with no server
at all. R2 holds every lead; the notification only says one arrived.

**Lead kinds** carried by one record:

| kind | Extra fields it fills | From screen |
|---|---|---|
| `contact` | need group | 13 |
| `consult` | product of interest | 02, any "Tư vấn" |
| `showroom_booking` | city, robot line, preferred date | 07, 11 |
| `service` | service type (rent / finance / deploy) | 05 |
| `partnership` | partner type | 08 |
| `warranty` | robot serial, fault description | 12 |
| `ai_assist` | industry, need, stage | 10 |

---

## Photo attachments: deferred

Dropped on your call, after weighing who would actually be able to open a support photo. **The
warranty form still ships** — serial number, unit, contact, fault description — it simply doesn't
take a file. It says a technician will ask for photos when they make contact, which is honest and
costs nothing.

### What this removes, which is more than a file picker

- The private attachments bucket, and its CORS rule.
- The `/api/upload-url` endpoint, and with it the whole presigning apparatus: the R2 S3 access key
  and secret, the signing library, the `pending/` → `tickets/` copy, the lifecycle rule, and the
  HMAC that let one endpoint trust a key issued by another.
- The size-cap problem entirely — there is no longer an upload whose real size has to be checked
  after the fact, because a presigned URL cannot enforce the size it was issued for.
- The Turnstile single-use problem — a form is now one gated call, not four, so there is no signed
  session to carry between them.
- The attachment viewer piece, and the custom Strapi route and admin-panel customisation under it.

**The Worker now needs no R2 credentials at all.** It writes the durable lead copy through R2's
native binding, which can `put` perfectly well — it only ever needed an S3 token because *presigning*
requires one. The single largest piece of fiddly, failure-prone surface in this design goes with the
feature, which is worth knowing: this was not a small cut.

### Why it was a decision and not just a feature

Worth recording, because it is the part that would be forgotten if the feature ever comes back.
Private storage hands out temporary links, and **a temporary link is a key, not an identity check**
— like a hotel key card, whoever holds it gets in. It cannot tell a technician from whoever an email
was forwarded to. So "put the photo somewhere private" does not settle anything; the real question
is who is handed a key and for how long, and every answer to that costs either work or safety.

These particular photos would show a broken robot *where it works* — inside a hospital ward, a bank
branch, a factory floor. That is the client's customer's premises, sent to get help rather than to
circulate, which is what made the cheap answer unattractive and the safe answer an hour of work.

### If it comes back

The shape to build, and the reasoning behind it, are in this file's history (453501d): the browser
PUTs straight to a private bucket using a five-minute slip from the Worker; the Worker never signs a
read; Strapi presigns downloads behind its own login with a five-minute expiry; notification emails
carry no links at all. Reckon about an hour for the upload path and an hour for the admin viewer.

---

## The Worker

### Not Lambda

A Cloudflare Worker, for proximity and one deploy: it ships with the site's build, shares its
secrets, and sits in the same network as the bucket it writes to. A Lambda would mean a second
provider, a second deploy and a cold start between a visitor and their form, for nothing gained —
the rest of the stack isn't AWS; Lightsail only serves the admin panel.

With attachments gone it uses R2's **native binding**, and holds no storage credentials. (An earlier
draft claimed the binding was reason enough even with presigning, which was wrong — the binding
cannot presign. That correction is now moot rather than resolved, which is a different thing and
worth saying plainly: if presigning ever returns, so does the S3 token.)

It deploys as a **Pages Function**, which *is* a Worker, just one that ships with the site's build
rather than on its own. Same runtime, one deploy, one place to set secrets.

### The two endpoints, and what they promise

```
POST /api/lead                public · Turnstile-gated
  in   { kind, name, phone, company, message, ...per-kind extras }
  checks  token valid · required fields by kind · field lengths
  does    env.LEADS.put(...)  durable JSON copy, via the native binding
          sends the Slack notification (after the write; best effort)
          (from P6 onward) forwards to Strapi
  out  { ok }

POST /api/rebuild             Strapi's webhook target · shared-secret header
  checks  header matches REBUILD_SECRET
  does    calls GitHub repository_dispatch with an event_type
  out  { ok }
```

Secrets in Pages' encrypted environment: the Turnstile secret, the Slack webhook URL,
`REBUILD_SECRET`, and a fine-grained GitHub token for the dispatch. No storage credentials.

## Publishing content

```mermaid
sequenceDiagram
    participant E as Editor
    participant S as Strapi
    participant G as GitHub Actions
    participant P as Cloudflare Pages

    E->>S: edit and publish
    S->>W: webhook · fixed payload + secret header
    W->>G: repository_dispatch with an event_type
    G->>S: fetch all content (read API, with a read token)
    G->>G: astro build
    G->>P: deploy
    P-->>E: live, ~2 min later
```

**Why the Worker is in the middle, and not a straight webhook.** An earlier draft had Strapi call
GitHub directly. That returns 422 and nothing ever rebuilds: GitHub's `repository_dispatch` requires
an `event_type` in the body, and Strapi's webhook payload is fixed at `{event, createdAt, model,
entry}` — only headers can be customised. So `/api/rebuild` takes Strapi's call, checks a shared
secret in a header, and makes the dispatch GitHub will accept. The GitHub token lives in Pages, not
on the box.

**And a concurrency group on the build**, or publishing goes badly wrong: one save in the admin
fires `entry.update` then `entry.publish`, so publishing ten products fires twenty webhooks and,
without `concurrency: { group: site-build, cancel-in-progress: true }`, twenty builds. The webhook
is subscribed to `entry.publish`, `entry.unpublish`, `entry.delete` and the media events.

**The build must fail loudly if Strapi is unreachable.** Otherwise a box that is down deploys an
empty catalog over a good one — the opposite of the "content goes stale, site stays up" property
this design is for.

Two rules this picture enforces. **Nothing is ever built on the instance** — Actions builds both the
site and Strapi's admin panel, and the box only serves what it is handed. Strapi's admin is a
front-end build and the hungriest thing that would ever run on 512 MB; this is the specific trap
the brief's "never build on the instance" line is protecting against. And **media goes to R2, not
the instance disk** — a change from the brief, below.

---

## The content model

The line between CMS and code is **facts the client owns** versus **prose that rarely moves**:

| In the CMS | In the code |
|---|---|
| Products, lines, industries, showrooms, accessories | The four service descriptions (screen 05) |
| **Brand: name, logo, mark, tagline, share image, favicon** | The six partner types (screen 08) |
| **Contact: phone, Zalo/WhatsApp, email, address, legal entity** | About's three principles (screen 09) |
| **The demo banner toggle** | The six AI capability cards (screen 06) |

Brand and contact move to the CMS on your call, and the screens themselves argue for it — screen 13
says outright that email, address and legal entity are *"bổ sung sau khi xác minh"*, which is a
field waiting to be filled, not a constant. Same for the phone number, which appears on the contact
page and in the footer of every page.

It costs a single type and about twenty minutes, so it folds into P1 and P2a rather than becoming a
piece. **"Etc" is doing some work in your message** — the list below is what I've put in. If
something you'd want to change without calling me isn't there, say so now while it's free.

```mermaid
erDiagram
    SITE_SETTINGS ||--o{ MEDIA : "logo · mark · share image"
    SITE_SETTINGS ||--|| SEO : has
    PRODUCT_LINE ||--o{ PRODUCT : "groups (robots only)"
    PRODUCT }o--o{ INDUSTRY : "applies to"
    PRODUCT ||--o{ MEDIA : "gallery · documents"
    PRODUCT ||--o{ SPEC : "has many"
    PRODUCT ||--|| SEO : has
    PRODUCT }o--o{ PRODUCT : "related · compatible_with"
    INDUSTRY ||--o{ JOURNEY_STEP : "has (no fixed count)"
    INDUSTRY ||--|| SEO : has
    SHOWROOM ||--o{ MEDIA : shows

    SITE_SETTINGS {
        string brand_name
        string tagline
        string hero_headline
        text hero_sub
        string phone
        string zalo
        string whatsapp
        string email
        text address
        text legal_entity
        bool show_demo_banner
    }
    PRODUCT_LINE {
        string name
        string slug
        text summary
        int order
    }
    PRODUCT {
        enum kind "robot|accessory|software"
        string model
        string slug
        text summary
        markdown description
        bool name_provisional
        bool spec_pending
        bool featured
        enum badge "new|hot|none"
        string video_url
    }
    SPEC {
        string group
        string label
        string value
        string unit
    }
    SEO {
        string meta_title
        text meta_description
        bool noindex
    }
    INDUSTRY {
        string name
        string slug
        string tagline
        markdown problem
        media hero_image
    }
    JOURNEY_STEP {
        int order
        string title
        text detail
    }
    SHOWROOM {
        string city
        string name
        enum opening_status "open|fitting_out|planned"
        string address
        string hours
        bool details_confirmed
    }
    LEAD {
        enum kind
        int schema_version
        string name
        string phone
        string email
        string company
        text message
        string product_slug
        string line_slug
        string industry_slug
        string showroom_slug
        json details
        string source_page
        string locale
        datetime created
    }
```

Six notes on shape, four of them corrections to an earlier draft that was drawn from the *list* of
pages rather than from each page.

**One `product` collection with a `kind`, not three collections.** Screen 01's sidebar runs the
seven robot lines, then "Phụ kiện", then "Phần mềm / kho Agent", under one heading with one search
box and one card grid — and its own subtitle says "7 dòng robot • 35 model • Phụ kiện • Phần mềm /
Agent". An earlier draft had a separate `accessory` type and no software type at all, which would
have meant three card templates, three detail templates and three search indexes. One collection
means a new catalog kind is a new enum value. `line` is required for robots only, which Strapi
cannot enforce natively — validate it in the seed and accept a soft rule in the admin.

**Two booleans, not one status enum.** Screen 02 shows "TÊN MODEL TẠM" *and* "CHỜ HỒ SƠ KỸ THUẬT" on
the same product at the same time; a single enum can hold only one of them. `name_provisional` and
`spec_pending` are independent, and Strapi's own draft/publish covers the third state — which is
also why the old `published` value had to go, since it collided with `publishedAt`.

**Specs are a repeatable component, not a JSON blob.** A blob renders the spec tab and does nothing
else. "Filter robots over 50 kg payload", a comparison table, or any quote calculator all need a
key, a value and a unit that are consistent across products. The cost of discovering this later is
not the schema change, it is that the client will by then have typed 35 specs in 35 different
shapes.

**The lead carries slugs, not relations.** An earlier draft drew `LEAD }o--o| PRODUCT`. That cannot
work: the Worker creates leads, and it has no Strapi at all before P6 — it writes JSON to R2 — while
setting a Strapi relation needs a documentId lookup and a read token the Worker otherwise never
wants. Strings also survive the client renaming or deleting a product, where a relation would null
out. `details` carries the per-kind extras (need group, service type, partner type, serial,
preferred date, stage), and `schema_version` is there because **the R2 lead copy is the one shape in
this system with no migration path** — it is files written on the day — so it is versioned from the
first write.

Unchanged and still right: `opening_status` and `details_confirmed` (first drawn as `published`, renamed to avoid Strapi's own draft/publish; `status` became `opening_status` for the same reason, since Strapi reserves `status` as a query parameter while draft/publish is on) on **showroom** reflect screen 07's own caveat,
that addresses and hours aren't shown until the project owner confirms them. **lead** is read-only
to the public role — the Worker creates them, nobody on the internet can list them.

And **site_settings** is a single type with a rule attached: every field in it is allowed to be
empty, and the site renders correctly when it is. An empty address hides the address block rather
than printing a blank label. (The fields lost their `_pending` suffixes: the emptiness is the
behaviour, and baking a transient state into a field name keeps it there forever.) That rule is what
makes brand genuinely "uploadable later": the site ships with placeholder brand, the client replaces
it whenever they're ready, and nothing has to be rebuilt by hand. The
logo is fetched and optimized at build time rather than hotlinked, so it stays fast in the nav of
every page, and `show_demo_banner` lets the client switch off the "BẢN MẪU THIẾT KẾ" band
themselves at launch.

---

## Is the skeleton strong enough to customise later?

Mostly yes, and it's worth being precise about where that holds and where it doesn't — because the
answer is what lets us stop guessing at requirements nobody has yet.

**Cheap to change later — don't spend thought on these now:**

| Change | Cost |
|---|---|
| Add a field to any type | Minutes |
| Move a page's prose from code into the CMS | An afternoon |
| Add a page, a section, a band on the homepage | Under an hour |
| Change any copy, image, logo, phone number | An upload, by the client |
| Add a product attribute, a badge, a filter | Under an hour |

This is the whole reason the brand decision was easy to absorb: adding fields is near-free, so an
unknown field is not a risk, it's a Tuesday.

**Expensive to change later — these are the ones worth getting right now:**

| Change | Why it hurts |
|---|---|
| **Shapes already written into R2** | The lead JSON copies are files written on the day; there is no migration to run over them. Hence `schema_version` from the first write. **This is the one with no way back.** |
| **Free-form JSON that must later be queried** | Specs typed 35 different ways cannot be filtered, compared or calculated over until someone normalises them by hand. Hence the spec component. |
| **Slugs, once Google has indexed them** | And the site *will* be indexed: P4 puts it on a public pages.dev URL carrying placeholder slugs the plan already expects to rename. Hence noindex until launch. |
| **Strings scattered across 15 templates** | Extracting microcopy from every page is the difference between a 40-minute second language and a half-day one. Hence a dictionary from P2a. |
| **Which fields are localized** | Strapi sets localization per field; turning it on for a field that already holds data is a migration, not a toggle. |
| **The 512 MB hosting call** | Which is why it's a spike at the front rather than a discovery at the end. |

**An earlier draft of this table named relationships as the one costly class and missed all of the
above.** That was wrong in both directions. At 35 products, 7 lines and 12 industries, behind a
content adapter that every template reads through, reshaping a relation is a schema edit, a script
over a few dozen rows and an adapter change — templates barely notice. What actually hurts is the
list above: things already written down somewhere nobody can rewrite, and things scattered too
widely to gather up later.

For localization the safe side is cheap: **every customer-facing text field is localized from the
start**, even though only Vietnamese gets filled. Free while empty, a migration once it isn't. (No
reason to localize `slug` or `order`, though — that is over-applying the rule.)

So: build the skeleton, ship it, and let the client's actual requests drive the rest. A field they
ask for next month is cheap. A relationship we got wrong is not — and that's the part we've done
carefully.

## The homepage

There's no home screen in the 13 references and no "Trang chủ" in the nav, so this is built from the
design language of the rest rather than copied from a reference. Every band below reuses a component
built for another page, which is why it costs roughly half an hour rather than a piece of its own.

```mermaid
flowchart TD
    H1["1 · Hero<br/>headline, sub, 'Tư vấn' + 'Khám phá sản phẩm'<br/>robot lineup image"]
    H2["2 · 7 product lines<br/>card strip → /san-pham"]
    H3["3 · Solutions by industry<br/>6 of 12 cards → /giai-phap"]
    H4["4 · Why V-ROBOTICS<br/>the 3 principles from screen 09"]
    H5["5 · Services<br/>4 cards from screen 05 → /dich-vu"]
    H6["6 · Showroom<br/>5-city band → /showroom"]
    H7["7 · AI & software<br/>teaser → /cong-nghe-ai"]
    H8["8 · Lead band<br/>'Cùng xác định giải pháp robot phù hợp'"]

    H1 --> H2 --> H3 --> H4 --> H5 --> H6 --> H7 --> H8
```

It's a B2B catalog site, so the homepage has one job: get a visitor into the catalog or into a form
within one click. Hence products second and a lead band last.

---

## Routes

14 pages, plus the homepage. All Vietnamese at MVP; the `/en/` prefix is wired but unfilled, and the
switcher stays hidden until it is.

| Route | Source | Screen |
|---|---|---|
| `/` | code + CMS teasers | — new |
| `/san-pham` | CMS | 01 |
| `/san-pham/[slug]` | CMS | 02 |
| `/giai-phap` | CMS | 03 |
| `/giai-phap/[slug]` | CMS | 04 |
| `/dich-vu` | code | 05 |
| `/dich-vu/bao-hanh` | code + form | 12 |
| `/cong-nghe-ai` | code | 06 |
| `/showroom` | CMS | 07 |
| `/showroom/dat-lich` | code + form | 11 |
| `/hop-tac` | code + form | 08 |
| `/ve-chung-toi` | code | 09 |
| `/tro-ly-ai` | code + form | 10 |
| `/lien-he` | code + form | 13 |
| `/api/lead`, `/api/rebuild` | Functions | — |

---

## Three changes from the brief

**1. Media goes to R2, not the instance disk.** The brief stores Strapi uploads on the Lightsail
disk and copies them to R2 nightly. (Note the backup arrow in the system diagram is a **cron on the
box**, not GitHub Actions — an earlier draft drew it as Actions, which cannot reach a SQLite file
sitting on Lightsail.) Pointing Strapi's upload provider at R2 directly is better on
every axis: images serve from Cloudflare with no egress charge instead of from a 512 MB box in
Singapore, the 20 GB disk stops being a ceiling, and the nightly uploads backup disappears because
the uploads already live in the backup's destination. Only SQLite then needs backing up.

Five things Strapi's own R2 documentation requires that a first attempt usually misses: no `ACL` in
the provider params (R2 rejects ACLs), `region: 'auto'`, the `r2.cloudflarestorage.com` endpoint,
`baseUrl` pointed at the public bucket so stored URLs are servable, and the bucket host added to
`strapi::security`'s `img-src`/`media-src` — without that last one the media library shows no
thumbnails and simply looks broken. Two more worth knowing now: the free `pub-*.r2.dev` URL is
rate-limited and Cloudflare says plainly it is not for production, which pulls the custom domain
earlier than "later"; and sharp generating responsive breakpoints for a 10 MB photo on a 512 MB box
is a plausible out-of-memory, so breakpoints get turned down and the admin's upload size capped.

**2. Leads go through a Function, not straight to Strapi.** Reasoning in "Sending a lead" above.

**3. Visitor uploads are out of the MVP entirely.** The brief did not ask for them; they came in as
a reading of screen 12's "Thêm ảnh hoặc video lỗi", went in direct to R2, and have now come back out
on your call. R2 stays, for product media and for the durable lead copies and backups — the storage
was never the hard part. See "Photo attachments: deferred" above for what went with them, and for
the shape to rebuild if the client asks.

---

## What this costs

| | At launch |
|---|---|
| Cloudflare Pages | Free |
| Pages Functions (the Worker) | Free tier, 100k req/day |
| R2 | Free to 10 GB, no egress charge |
| Turnstile | Free |
| Email notify | Free tier |
| GitHub Actions | Free on a private repo's allowance |
| Lightsail 512 MB | ~$5/mo |
| **Total** | **~$5/mo** |

Figures from the brief and general knowledge — the Lightsail price and the free-tier limits get
checked against current documentation at the spike, before anything depends on them. If the spike
says 512 MB won't carry an admin the client can actually work in, the 1 GB plan is the answer: $5 to
$7, not the doubling an earlier draft claimed. That is small enough that the spike's verdict should
be taken at face value rather than argued with — but it is a spend, so it still comes to you.

---

## The risks this drawing makes visible

**Strapi on 512 MB — now launch-blocking.** It was always the main technical risk; the client
editing at launch means it can also hold up the launch, which is why it moves to a spike at the very
front. The architecture still contains the damage: visitors never touch the server, so if it dies
the site keeps serving and only editing stops. But "the admin panel is usable enough that a client
will actually use it" is a bar the brief's 512 MB plan has not yet cleared, and we should find out
before building on it. Worst case is the 1 GB plan — a few dollars, not a redesign.

**Two risks left with the attachments.** The Worker no longer holds any storage credential, because
without presigning the native binding is enough; and the public can no longer write to a bucket at
all, because nothing it sends is a file. Both were on this list a revision ago. Worth noting that
dropping one feature removed two of this design's four standing risks — a reminder that the cost of
a feature is not only the hours to build it.

**The Worker is still a public write path**, just a narrow one: a form post that becomes a small
JSON object and an email. Turnstile and per-kind field validation carry it, and the blast radius of
abuse is now storage measured in kilobytes rather than a bucket of strangers' files.

**The build becomes the single point of failure for content.** If Actions breaks, content freezes —
the site stays up, but stale. Acceptable, and worth knowing.

**Nothing here is a test.** Per your call to skip them, the first check of each piece is you looking
at the live URL.
