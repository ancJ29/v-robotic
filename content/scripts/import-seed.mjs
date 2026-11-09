// Imports content/seed/<locale>/*.json into a running Strapi through its REST API, so the same script
// fills the local box today and the real one in P6. Safe to run again: each record is found by slug and
// updated, never duplicated. Relations are slugs in the seed; they are linked after every record exists.
// Env: STRAPI_URL (default http://127.0.0.1:1337), STRAPI_IMPORT_TOKEN (full-access). Arg: locale (default vi).
// Order: site settings, lines, industries, showrooms, products without relations, then the relations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const token = process.env.STRAPI_IMPORT_TOKEN;
const locale = process.argv[2] ?? 'vi';
if (!token) throw new Error('Set STRAPI_IMPORT_TOKEN (a full-access API token; strapi-bootstrap.mjs makes one)');
const seed = (n) => JSON.parse(fs.readFileSync(path.join(repo, 'content/seed', locale, `${n}.json`), 'utf8'));

async function api(method, p, body) {
  const res = await fetch(url + p, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} answered ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const RELATIONS = ['line', 'industries', 'related', 'compatible_with'];
const counts = {};

// slug -> documentId, for one collection in this locale
async function idsOf(plural) {
  const map = new Map();
  for (let page = 1; ; page++) {
    const b = await api('GET', `/api/${plural}?locale=${locale}&status=draft&fields[0]=slug&pagination[page]=${page}&pagination[pageSize]=100`);
    for (const r of b.data) map.set(r.slug, r.documentId);
    if (page >= b.meta.pagination.pageCount) return map;
  }
}

// Creates or updates; "published" so the site's read-only token sees it.
async function upsert(plural, rec, existing, strip = []) {
  const data = Object.fromEntries(Object.entries(rec).filter(([k]) => !strip.includes(k)));
  const id = existing.get(rec.slug);
  const q = `?locale=${locale}&status=published`;
  const res = id ? await api('PUT', `/api/${plural}/${id}${q}`, { data }) : await api('POST', `/api/${plural}${q}`, { data });
  existing.set(rec.slug, res.data.documentId);
  counts[plural] = (counts[plural] ?? 0) + 1;
}

// site settings: one record, no slug
const site = seed('site-settings');
await api('PUT', `/api/site-setting?locale=${locale}&status=published`, { data: site });
counts['site-setting'] = 1;

const lines = await idsOf('product-lines');
for (const r of seed('product-lines')) await upsert('product-lines', r, lines);
const industries = await idsOf('industries');
for (const r of seed('industries')) await upsert('industries', r, industries);
const showrooms = await idsOf('showrooms');
for (const r of seed('showrooms')) await upsert('showrooms', r, showrooms);

const products = await idsOf('products');
const productSeed = seed('products');
for (const r of productSeed) await upsert('products', r, products, RELATIONS);

const target = { line: lines, industries, related: products, compatible_with: products };
const need = (map, slug, what) => {
  const id = map.get(slug);
  if (!id) throw new Error(`${what} "${slug}" is not in Strapi`);
  return id;
};
for (const r of productSeed) {
  const data = {
    line: r.line ? need(lines, r.line, 'line') : null,
    industries: r.industries.map((s) => need(industries, s, 'industry')),
    related: r.related.map((s) => need(products, s, 'product')),
    compatible_with: r.compatible_with.map((s) => need(products, s, 'product')),
  };
  await api('PUT', `/api/products/${products.get(r.slug)}?locale=${locale}&status=published`, { data });
}
console.log(`imported (${locale}):`, JSON.stringify(counts));
