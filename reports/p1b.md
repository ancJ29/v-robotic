# P1b report: the sample content at the screens' size

Plain words. Each item ends in one question you can answer yes or no. Nothing here has been pushed.

## What was done

1. The sample now has 12 industries (was 4) and 5 showrooms (was 3). The 11 industry names and 5 city names come straight from the client's own two design screens; all were readable, none guessed.
2. Everything that is not a name is placeholder text starting with the tag [PLACEHOLDER], so one search finds it all. No images were added. The two new showrooms have no address, so none prints.
3. The site builds 44 pages (was 36): the 8 new industry pages. No broken links. Seed check and site checks pass.

## What reads well and what does not

- The industries list fits: 11 cards plus the "not sure which robot?" card make 4 full rows of 3.
- The homepage shows only the first 6 industries, so it did not grow.
- The 5 showroom tabs fit in one row on a wide screen and wrap on a narrow one.
- The 8 new industry pages are shorter: no products are linked to them, so their "suitable products" section is hidden.
- I could not look at a real browser here, so line wrapping of long names such as "Bệnh viện / Phòng khám" on a phone is not checked.

## Questions

1. **Retire the extra sample industry "Kho vận (tạm)", which is on no screen (it makes 12, not 11)?** Yes: one small commit edits the slug list and moves 3 product links, then the list is exactly the screens' 11. No: it stays as a 12th card until the client says.
2. **Is "[PLACEHOLDER]" visible on the pages (taglines, step titles) acceptable for the client preview?** Yes: nobody mistakes it for real content. No: say so and the marker moves to a hidden field, at the cost of the one-search guarantee.
3. **Should the next piece link a few products to the 8 new industries so their pages are not bare?** Yes: a small follow-up in the seed. No: they stay bare until real content.
