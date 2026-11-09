// The adapter's pure mapping, on hand-made Strapi-shaped answers (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapContent, mapMedia } from '../src/content/strapi.ts';

const raw = {
  siteSetting: { id: 1, documentId: 'x', brand_name: 'B', tagline: '', show_demo_banner: false, logo: { url: '/uploads/l.png', alternativeText: 'logo', width: 10, height: 20 }, seo: null },
  productLines: [{ id: 2, name: 'B', slug: 'b', summary: null, order: 2 }, { id: 1, name: 'A', slug: 'a', summary: 's', order: 1 }],
  industries: [],
  showrooms: [],
  products: [{
    id: 9, documentId: 'd', kind: 'robot', model: 'M', slug: 'm', summary: null, description: 'd', badge: 'none',
    name_provisional: true, spec_pending: false, featured: false, video_url: null,
    line: { id: 1, documentId: 'l', slug: 'a' }, industries: [{ slug: 'i1' }, { slug: 'i2' }], related: [], compatible_with: undefined,
    specs: [{ id: 5, group: null, key: 'k', label: 'L', value: '1', value_number: '1.5', unit: '' }],
    gallery: [{ url: 'https://cdn.example/x.jpg', alternativeText: null, width: 1, height: 2 }], documents: null, seo: { id: 3, meta_title: 'T', meta_description: null, noindex: true },
  }],
};

test('relations become slugs, empties become null or []', () => {
  const c = mapContent(raw, 'vi', 'http://cms.test/');
  const p = c.products[0];
  assert.equal(p.line, 'a');
  assert.deepEqual(p.industries, ['i1', 'i2']);
  assert.deepEqual(p.compatible_with, []);
  assert.deepEqual(p.documents, []);
  assert.deepEqual(p.specs[0], { group: null, key: 'k', label: 'L', value: '1', value_number: 1.5, unit: null });
  assert.deepEqual(p.seo, { meta_title: 'T', meta_description: null, noindex: true });
  assert.equal('id' in p, false);
});

test('media: relative paths get the public prefix, absolute URLs stay', () => {
  assert.equal(mapMedia({ url: '/uploads/l.png', alternativeText: 'a', width: 1, height: 2 }, 'http://cms.test/')?.src, 'http://cms.test/uploads/l.png');
  assert.equal(mapMedia({ url: 'https://cdn.example/x.jpg' }, 'http://cms.test')?.src, 'https://cdn.example/x.jpg');
  assert.equal(mapMedia(null, 'x'), null);
});

test('lines are sorted by order; empty strings are null; a missing banner flag defaults to shown', () => {
  const c = mapContent(raw, 'vi', 'http://cms.test');
  assert.deepEqual(c.productLines.map((l) => l.slug), ['a', 'b']);
  assert.equal(c.siteSettings.tagline, null);
  assert.equal(c.siteSettings.show_demo_banner, false);
  assert.equal(c.siteSettings.logo?.src, 'http://cms.test/uploads/l.png');
});
