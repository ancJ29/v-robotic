# The homepage (piece P2c)

Decisions a later session should not re-derive. Each is reversible. The page is `web/src/pages/index.astro`; its prose is `web/src/copy/home.ts`.

- **Eight bands, in the architecture memo's order, tones alternating: dark hero, light, panel, light, panel, light, dark, panel.** The memo fixed the order; tone alternation keeps neighbours apart and puts the two dark bands (hero, AI) at the ends of the page's middle.
- **Every band is a `Band`; no section wrapper is hand-written. `Band.astro` was not extended.** Its `actions` and `aside` slots covered the hero and the "see all" buttons.
- **The hero's headline and sub-headline come from `site_settings`, falling back to `copy/home.ts` when empty or blank.** A fallback in the string file reads as deliberate; the fallback headline reuses the brand line the About screen prints. Provisional until the client supplies the real one.
- **The hero picture is the first featured product's visual, else the first robot's, in the shared `ProductVisual` (a neutral well today).** No lineup image exists; this shows a real product when the CMS has pictures and never a broken image.
- **Product lines band: the first robot of each line, as a `ProductCard` whose subtitle is the line name; lines without a robot are skipped.** Reuses the catalogue card instead of a new line card; the seed's 7 lines give 7 cards.
- **Industries band: the first 6 by `order` (the memo says 6 of 12); the seed has 4, so 4 show.** Uses `IndustryCard` as the listing does.
- **Why-us band: the three principles of the About copy, via `InfoCard`.** One source for the wording, so the two pages cannot drift.
- **Services band: the four services as `InfoCard`s, all linking to `/dich-vu`, not to the form each service has there.** Keeps the homepage free of `/dich-vu/bao-hanh` and `/lien-he` duplicates; the services page owns the routing.
- **Showroom band: one `InfoCard` per showroom (city, status word, link to `/showroom`). Never an address or hours.** The cards must not leak what `details_confirmed` hides.
- **AI band: three of the six capabilities of the AI page copy, dark band, button to `/cong-nghe-ai`.** A teaser, as the memo says.
- **Lead band: title, sub-line and one red button to `/lien-he`; no form.** The contact form is P3's; the page links to the existing route. The homepage links to none of the three P3 routes.
- **New strings: page prose in `copy/home.ts`; five shared labels (`home.*`) in `vi.json`.** Same split P2b set.
- **Bands whose data is empty are omitted (lines, industries, showrooms)**, so an empty CMS leaves a shorter page, not empty headings.
- **New CSS: one 4-line grid helper in the page (`g2`, `g3`, `g4`) at the shell's breakpoints.** Four other pages hold the same grid rule locally; a shared `CardGrid` component would remove them, noted for a later tidy, not done here.
