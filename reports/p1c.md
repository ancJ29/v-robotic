# P1c: placeholder images, and the image path proved end to end

Written 2026-11-09. Everything below was run in this piece's own worktree. Nothing was pushed.

## What was done, in plain words

The site now has a picture for every product (20), every industry (11) and every showroom (5). They are
generated sample pictures, not photographs: a grey hatched ground, the item's own name, and in red the words
"ẢNH MẪU - chưa phải ảnh thật" (sample picture, not a real photo). They are SVG files, each under 1 KB, made
by `content/scripts/make-placeholders.mjs` with no network and nothing licensed.

The part that mattered: the whole path had never run. It now has. A file on disk went through the seed
import into Strapi as a real media record, came back out through the site's adapter, and landed in a built page.
It worked first time. The only mismatch was the address of the picture, which is expected and handled in the
compare script (see item 2).

## Questions, one yes-or-no each

1. **Are the SVG placeholders acceptable as the stand-in until the client's photographs arrive?** Yes keeps them
   and moves on; no means saying what a placeholder should look like instead (different look, or a raster format).
2. **May the compare script treat a Strapi upload address and the seed's site path as the same picture when only the
   file name matches?** Yes keeps the proof in place; no means the seed would have to carry Strapi's hashed
   addresses, which cannot be known in advance, so a no here would need a different proof.
3. **Should the deployed site keep building from the seed until item 17 (images pointing at Strapi's own address) is
   settled?** Yes keeps the live build safe; no means choosing how Strapi's pictures are published first.

## What was proved

- **Strapi round trip.** Fresh database, Strapi up in 4 to 6 s. The import uploaded 36 files (20 + 11 + 5) and linked
  them. A second import uploaded 0 and found all 36 already there, so it is safe to rerun. Products in Strapi: 20,
  not 40. Reading back through the site's own adapter, all five types equal the seed: alt text, width and height
  survive exactly (800x600 and 1000x1000). Strapi served one file back with HTTP 200, `image/svg+xml`, and the bytes were
  identical to the file on disk.
- **Both build directions.** From the seed (Strapi stopped): 43 pages. From Strapi: 43 pages. In the seed build every one
  of the 36 picture addresses on the pages points at a file that exists (none missing). In the Strapi build all 36
  point at Strapi uploads.
- **Page count:** 43 before, 43 after. It did not move, because images add no pages.
- **Where pictures show (counted in the built HTML):** catalogue 20, home page 14, each product page 2 (its own
  and its neighbour in the related band), the industry list 11, an industry page 3, the showroom page 5.
- **Checks:** `content/scripts/validate-seed.mjs` ok (11 industries, 20 products, 7 lines, 5 showrooms); root
  `pnpm check` green (cms type check, content check, astro check 0 errors, 26 tests pass). Nothing failed on `cms`.
- **Item 16 (closed in part).** Strapi was built and the types regenerated. The showroom `description` exists in
  the CMS and round-trips. The regenerated types file differs from P1b's hand edit in one line only: `related` on
  the product type sits in its alphabetical place instead of one slot lower. Same meaning, so the finding is that
  the hand edit was right in content and wrong in position. I committed what Strapi wrote. What stays open is the
  smaller half: the seed no longer exercises a confirmed showroom.
- **New finding, item 17.** A site built from Strapi writes picture addresses like `http://127.0.0.1:1337/uploads/...`,
  which no visitor can open. It does not touch the live site, which builds from the seed, but it will on the first
  deploy built from Strapi: set `STRAPI_PUBLIC_URL` or give Strapi object storage.

## What I could not judge

No browser starts here. I did not see any picture rendered, so I cannot say the text fits its frame, that the
"cover" crop of the industry pictures (square card, wide page) leaves the name readable, or that it reads as an
obvious placeholder at card size. I checked only the markup, the sizes, and that the files exist and download.
The text sits in the middle band on purpose for the crop, but that is reasoning, not looking.

## Decisions taken

- Format SVG (nothing in the path needs a raster; tiny; diffable; Strapi stored its width and height). Reasons in
  `docs/conventions/content.md`, P1c section.
- Files live once, in `web/public/placeholders/`; the seed build serves them and the import uploads from there.
- `ProductVisual` stays as the fallback for a product with no picture. No template changed.
- No contract change: the media fields already existed on the types.
- `sample_data` and the site-wide ribbon are untouched.

## Replace before launch

- All 36 pictures in `web/public/placeholders/` (delete them; upload the client's photographs in Strapi, or set the
  seed fields to real files), and drop `content/scripts/make-placeholders.mjs`.
- The alt text on each is "Ảnh mẫu (chưa phải ảnh thật): name"; real photographs need real descriptions.
- Product galleries on the client's side may need several pictures per product, and showrooms several; the
  placeholders give one each.
- Everything already on the replace-before-launch list (item 8) stands.
