# Site shell, tokens, catalog and product detail (piece P2a)

Decisions a later session should not re-derive. Each is reversible.

- **Plain CSS with custom properties, no Tailwind or UI kit.** The site is static and small; Astro's scoped `<style>` keeps each component's rules with it, the output carries no framework, and the tokens stay readable by a non-coder. Global rules live in `web/src/styles/base.css` only.
- **Tokens: `web/src/styles/tokens.css`, the only place a raw colour, size or radius appears.** Names are role-based (`--color-navy`, `--color-brand`, `--color-cta`, `--color-panel`, `--text-3xl`, `--space-4`, `--radius-md`). Values were estimated by eye from the reference screens (no pixel sampler in the sandbox): re-read them against the designer's file when one is available, and change them there only.
- **Type: Noto Sans (variable, Vietnamese subset included), self-hosted through `@fontsource-variable/noto-sans`.** The screens use it; no request leaves the site at runtime. The `frontend-design` skill was not invoked; type and colour were taken from the screens instead.
- **Breakpoints, as literals in `@media`:** 900px (sidebar and two-column layouts), 1120px (full navigation instead of the menu button). Mobile first.
- **Content enters through `web/src/content/load.ts` only.** It reads the seed JSON at build time and returns `Content`. P5 replaces its body with the Strapi adapter; no template imports JSON.
- **UI strings go through `t()`** (`web/src/i18n/t.ts`, dictionary `web/src/i18n/vi.json`, flat dotted keys, `{name}` placeholders). Keys are typed, so a missing one fails `astro check`. P8 adds `en.json` and passes a locale. Client-owned facts stay in the CMS.
- **URLs are built in `web/src/lib/routes.ts` only**, shapes from the architecture memo. Navigation links to routes that later pieces build; until then they 404.
- **`noindex` is one constant, `NOINDEX` in `web/src/lib/site.ts`,** read by the layout. Flip it at launch. `public/robots.txt` stays disallow-all.
- **Empty settings render nothing:** no logo shows the brand name as text in the white logo pill, no phone/email/address/legal entity omits the footer info block, `show_demo_banner` false drops the banner.
- **Catalog filter is progressive, not a build-time index.** Every product is in the HTML (with `data-group`, `data-industries`, and a diacritic-folded `data-text`); a small inline script hides cards by sidebar choice, industry and search text, combined with AND. With JS off all 20 products show. At 35-100 products an index adds nothing; revisit if the catalog grows past a few hundred. Diverges from the plan row's "build-time index".
- **Sidebar groups:** one per product line, plus Accessories and Software, plus "all products". Screen 01 says "all robot lines" but also shows accessories and software, so the label is "Tất cả sản phẩm".
- **Product detail anchors:** the four numbered chips on screen 02 are anchors; the designer's labels do not map one-to-one to data, so 01 goes to applications, 02 to specs, 03 to related/compatible products, 04 to documents. Confirm with the client.
- **Description Markdown** is rendered by a small parser (`lib/text.ts`: paragraphs and bullet lists) into text nodes, never raw HTML. Replace it with a real Markdown library when a description needs more.
- **Specs print grouped** (a table per group, groups in order of first appearance, ungrouped rows under "Thông số chung"). `spec_pending` adds a notice above the sheet; both provisional and pending badges show together.
- **No images exist in the seed,** so `ProductVisual` draws a neutral well labelled with the kind. A gallery image replaces it with no template change.
- **The designer's "02/13" page counters and the screens' icon glyphs are not built** (the glyphs render as empty boxes in the screens, so their intent is unknown).

## Components P2b and P2c reuse

`BaseLayout` (page wrapper, header, footer, `noindex`), `Header`, `Footer`, `PageHead` (kicker, title, subtitle), `Breadcrumb`, `Badge`, `Button` (`primary`, `cta`, `outline`), `ProductCard`, `ProductVisual`. A section band and an industry card are not built yet: the first piece that needs one adds it next to these.

## Card grid (cleanup after P2c)

- **`CardGrid.astro` is the only card-grid rule; pages never write a `.grid`.** Props: `cols` (2, 3 or 4, the count at full width; default 3) and `from` (640 or 900; default 640). `from={640}` steps up: two columns from 640px, the full count from 1120px (for `cols={2}`, two from 640px). `from={900}` jumps straight to `cols` columns at 900px. These two shapes are exactly the ones the five pages already had (hop-tac, cong-nghe-ai, giai-phap listing: 3 stepped; homepage: 2 and 4 stepped, 3 jumping at 900; services listing: 2 jumping at 900), so no page changed how it renders. Content goes in the default slot.
- **A new grid whose breakpoints fit neither shape adds a value to `from`, not a page-local rule.** Auto-fill product grids (`san-pham`, `giai-phap/[slug]`) are a different kind (card width, not column count) and stay local.

