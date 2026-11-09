// Proves the contract against the real CMS: reads a running Strapi through the site's adapter and
// compares what comes back, field for field, with content/seed/<locale>/*.json (as the site would see it).
// Env: STRAPI_URL, STRAPI_TOKEN (read-only). Exit 1 on any difference.
// Run: node web/scripts/compare-with-seed.mjs   (Node 22.18+ reads the .ts adapter directly)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fetchContent } from '../src/content/strapi.ts';

const seedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content/seed/vi');
const seed = (n) => JSON.parse(fs.readFileSync(path.join(seedDir, `${n}.json`), 'utf8'));
const byOrder = (a) => [...a].sort((x, y) => x.order - y.order);

const got = await fetchContent({
  url: process.env.STRAPI_URL ?? 'http://127.0.0.1:1337',
  token: process.env.STRAPI_TOKEN ?? null,
  locale: 'vi',
});
const want = {
  siteSettings: seed('site-settings'),
  productLines: byOrder(seed('product-lines')),
  products: seed('products'),
  industries: byOrder(seed('industries')),
  showrooms: seed('showrooms'),
};
// Media: the seed's src is a site path (/placeholders/x/slug.svg); Strapi serves its own copy as
// <origin>/uploads/slug_with_underscores_<10 hex>.svg. Both are reduced to the file's own name; alt, width, height compare as they are.
const baseOf = (src, fromStrapi) => {
  const b = src.split('/').pop();
  if (!fromStrapi) return b;
  if (!/\/uploads\//.test(src)) throw new Error(`media src is not a Strapi upload: ${src}`);
  return b.replace(/_[0-9a-f]{10}(\.[a-z]+)$/, '$1').replace(/_/g, '-');
};
const normMedia = (v, fromStrapi) =>
  Array.isArray(v) ? v.map((x) => normMedia(x, fromStrapi))
  : v && typeof v === 'object'
    ? ('src' in v && 'alt' in v && 'width' in v ? { ...v, src: baseOf(v.src, fromStrapi) } : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normMedia(x, fromStrapi)])))
    : v;
let bad = 0;
for (const k of Object.keys(want)) {
  try {
    assert.deepStrictEqual(normMedia(got[k], true), normMedia(want[k], false));
    console.log(`ok   ${k}${Array.isArray(want[k]) ? ` (${want[k].length})` : ''}`);
  } catch (e) {
    bad++;
    console.log(`FAIL ${k}\n${String(e.message).split('\n').slice(0, 25).join('\n')}`);
  }
}
process.exit(bad ? 1 : 0);
