# P1b report: sample content at the screens' size

Plain words. Each item ends in one question you can answer yes or no. Nothing here has been pushed.

## What was done

1. The seed now has 11 industries and 5 showrooms, with the names read off your two screens (all legible, none guessed). The extra sample industry "Kho vận" was removed on purpose.
2. Everything else is filled with realistic Vietnamese sample content: the 7 product lines, all 20 products (specification values that fit each kind of robot), all 11 industries with their detail-page text, a description for each of the 5 showrooms, and longer text on the five prose pages (services, AI technology, partnership, about, contact). The hero headline in the site settings was left alone.
3. No images, anywhere. No street addresses and no opening hours: every showroom stays "details not confirmed", so none prints.
4. Marking: each sample record has a hidden flag `sample_data`, so one search lists them all; the prose pages carry a `SAMPLE-DATA` comment. On the site, one red ribbon at the top of every page says the content is sample data. One setting, `SAMPLE_CONTENT` in `web/src/lib/site.ts`, turns it off.
5. The site builds 43 pages (was 36). Seed check and the whole `pnpm check` (content, site, cms) pass. No broken links.

## What reads well and what does not

- The industries list is a 3-column grid; 11 cards plus the "not sure which robot?" card fill 4 rows exactly. It holds.
- The homepage shows only the first 6 industries, so it did not grow.
- Product pages: the specification tables have 6 to 10 filled rows in 2 to 4 groups, and the descriptions are 2 paragraphs plus 4 bullets. Nothing looks cramped from the markup. Real copy will probably be longer than my 400 to 640 characters.
- Industry hero titles are now sentences of 48 to 65 characters in the big dark banner. On a phone that is likely 4 or 5 lines. This is the thing to look at first.
- Not checked, because no browser runs here: how long names wrap on a phone, the showroom tab row at phone width, and the red ribbon beside the header.

## What a human must replace before launch

- All text of the 7 product lines, 20 products, 11 industries and 5 showrooms, except the names read off the screens (industry names, city names, the first model of each line V-AURA 01 to V-EMPA 01, and the three agent names). Find them with: grep -rn '"sample_data": true' content/seed
- Every specification value on every product page (payload, reach, speed, battery, sizes, and so on).
- The second model of each line (V-AURA 02 to V-EMPA 02), the three accessories and their text.
- The links between products and industries.
- The sentences added after the first sentence in the five prose pages. Find them with: grep -rln SAMPLE-DATA web/src/copy
- Showroom addresses and hours (none exist yet; only the client has them), and the contact facts in site settings.
- Photographs and videos for everything: none exist, and only the client can supply them.
- Then set `SAMPLE_CONTENT` to false.

## Questions

1. **Is one red ribbon across the top of every page the right way to say "sample data"?** Yes: nobody can miss it and it comes off with one edit. No: say where it should sit instead.
2. **Should the industry hero titles be shortened to about 35 characters?** Yes: a small follow-up in the sample text; no: the real copy decides.
3. **Are the second models (V-AURA 02 and so on) acceptable as invented names?** Yes: they stay flagged as sample. No: they are removed and each line shows one model until the client names more.
