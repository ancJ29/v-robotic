// Checks the two halves of the content contract against each other, with no dependencies:
//   1. every seed record matches its Strapi schema field for field (names, types, enums,
//      required, relations by slug, components);
//   2. web/src/content/types.ts lists the same fields (and enum values) as the schemas;
//   3. no slug in content/slugs.json has gone missing from the seed (slugs are URLs).
// Exit code 1 with every problem listed; 0 with a one-line summary. Run: pnpm --filter content check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const errors = [];
const err = (m) => errors.push(m);

// ---- load schemas
const apiDir = 'cms/src/api';
const types = {}; // singular -> { schema, plural, uid }
for (const d of fs.readdirSync(path.join(repo, apiDir))) {
  const p = `${apiDir}/${d}/content-types/${d}/schema.json`;
  if (!fs.existsSync(path.join(repo, p))) continue;
  const schema = json(p);
  types[schema.info.singularName] = { schema, plural: schema.info.pluralName, single: schema.kind === 'singleType' };
}
const components = {}; // "shared.seo" -> schema
const compDir = 'cms/src/components';
for (const cat of fs.readdirSync(path.join(repo, compDir))) {
  for (const f of fs.readdirSync(path.join(repo, compDir, cat))) {
    components[`${cat}.${f.replace(/\.json$/, '')}`] = json(`${compDir}/${cat}/${f}`);
  }
}

const isDerived = (a) => a.type === 'relation' && a.mappedBy; // inverse side: not in the seed
const ownFields = (schema) => Object.entries(schema.attributes).filter(([, a]) => !isDerived(a));
const singularOfUid = (uid) => uid.split('.').pop();

// ---- seed
const locales = fs.readdirSync(path.join(repo, 'content/seed')).filter((d) => fs.statSync(path.join(repo, 'content/seed', d)).isDirectory());
const seed = {}; // locale -> singular -> data
for (const loc of locales) {
  seed[loc] = {};
  for (const [singular, t] of Object.entries(types)) {
    const p = `content/seed/${loc}/${t.plural}.json`;
    if (!fs.existsSync(path.join(repo, p))) { err(`${loc}: missing seed file ${p}`); continue; }
    seed[loc][singular] = json(p);
    if (t.single && (Array.isArray(seed[loc][singular]) || typeof seed[loc][singular] !== 'object')) err(`${p}: a single type is one object`);
    if (!t.single && !Array.isArray(seed[loc][singular])) err(`${p}: a collection is an array`);
  }
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const MEDIA = ['src', 'alt', 'width', 'height'];

function checkValue(where, name, a, v, ctx) {
  const at = `${where}.${name}`;
  const empty = v === null || v === undefined;
  if (v === undefined) return err(`${at}: absent (use null or [] for empty)`);
  const isList = a.type === 'component' ? a.repeatable : a.type === 'media' ? a.multiple : a.type === 'relation' ? /ToMany$/.test(a.relation) : false;
  if (isList) {
    if (!Array.isArray(v)) return err(`${at}: must be an array`);
    if (a.required && v.length === 0) err(`${at}: required, empty`);
    v.forEach((item, i) => checkOne(`${at}[${i}]`, a, item, ctx));
    return;
  }
  if (empty) { if (a.required) err(`${at}: required, got null`); return; }
  checkOne(at, a, v, ctx);
}

function checkOne(at, a, v, ctx) {
  switch (a.type) {
    case 'string': case 'text': case 'richtext': case 'uid': case 'email':
      if (typeof v !== 'string') return err(`${at}: must be a string`);
      if (a.required && v.trim() === '') err(`${at}: required, blank`);
      if (a.regex && !new RegExp(a.regex).test(v)) err(`${at}: "${v}" does not match ${a.regex}`);
      if (a.type === 'uid' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) err(`${at}: slug "${v}" must be lowercase ascii words joined by hyphens`);
      return;
    case 'boolean': if (typeof v !== 'boolean') err(`${at}: must be true or false`); return;
    case 'integer': if (!Number.isInteger(v)) err(`${at}: must be an integer`); return;
    case 'decimal': case 'float': if (typeof v !== 'number') err(`${at}: must be a number`); return;
    case 'enumeration': if (!a.enum.includes(v)) err(`${at}: "${v}" is not one of ${a.enum.join('|')}`); return;
    case 'media':
      if (!isObj(v)) return err(`${at}: must be a media object {${MEDIA.join(', ')}}`);
      for (const k of MEDIA) if (!(k in v)) err(`${at}: media missing "${k}"`);
      for (const k of Object.keys(v)) if (!MEDIA.includes(k)) err(`${at}: unknown media field "${k}"`);
      if (typeof v.src !== 'string') err(`${at}.src: must be a string`);
      return;
    case 'relation': {
      const target = singularOfUid(a.target);
      if (typeof v !== 'string') return err(`${at}: a relation is a slug string`);
      if (!ctx.slugs[target]?.has(v)) err(`${at}: "${v}" is not a slug of ${target}`);
      return;
    }
    case 'component': {
      const c = components[a.component];
      if (!c) return err(`${at}: unknown component ${a.component}`);
      if (!isObj(v)) return err(`${at}: must be an object`);
      checkRecord(at, c, v, ctx);
      return;
    }
    default: err(`${at}: validator does not know attribute type "${a.type}"`);
  }
}

function checkRecord(where, schema, rec, ctx) {
  if (!isObj(rec)) return err(`${where}: must be an object`);
  const fields = ownFields(schema);
  const names = new Set(fields.map(([n]) => n));
  for (const k of Object.keys(rec)) if (!names.has(k)) err(`${where}: "${k}" is not in the schema`);
  for (const [n, a] of fields) checkValue(where, n, a, rec[n], ctx);
}

for (const loc of locales) {
  const slugs = {};
  for (const [singular, t] of Object.entries(types)) {
    if (t.single || !Array.isArray(seed[loc][singular])) continue;
    const seen = new Set();
    seed[loc][singular].forEach((r, i) => {
      if (seen.has(r.slug)) err(`${loc}/${t.plural}[${i}]: duplicate slug "${r.slug}"`);
      seen.add(r.slug);
    });
    slugs[singular] = seen;
  }
  const ctx = { slugs };
  for (const [singular, t] of Object.entries(types)) {
    const data = seed[loc][singular];
    if (data === undefined) continue;
    const recs = t.single ? [data] : data;
    recs.forEach((r, i) => checkRecord(`${loc}/${t.plural}${t.single ? '' : `[${i}${r?.slug ? ' ' + r.slug : ''}]`}`, t.schema, r, ctx));
  }
  // rules Strapi cannot enforce natively
  (seed[loc].product ?? []).forEach((p) => {
    if (p.kind === 'robot' && !p.line) err(`${loc}/products[${p.slug}]: a robot needs a line`);
    if (p.kind !== 'robot' && p.line) err(`${loc}/products[${p.slug}]: only robots have a line`);
    for (const f of ['related', 'compatible_with']) if (p[f]?.includes(p.slug)) err(`${loc}/products[${p.slug}].${f}: lists itself`);
    const keys = (p.specs ?? []).map((s) => s.key);
    if (new Set(keys).size !== keys.length) err(`${loc}/products[${p.slug}].specs: duplicate key`);
  });
}

// ---- slug ledger
const ledger = json('content/slugs.json');
for (const [singular] of Object.entries(types)) {
  if (!ledger[singular]) continue;
  for (const loc of locales) {
    const have = new Set((seed[loc][singular] ?? []).map((r) => r.slug));
    for (const s of ledger[singular]) if (!have.has(s)) err(`slug ledger: ${singular} "${s}" is gone from ${loc} seed (renaming a slug is a deliberate edit of content/slugs.json)`);
    for (const s of have) if (!ledger[singular].includes(s)) err(`slug ledger: ${singular} "${s}" in ${loc} seed is not in content/slugs.json (add it)`);
  }
}

// ---- types.ts against the schemas
const ts = read('web/src/content/types.ts');
const interfaces = {};
for (const m of ts.matchAll(/export interface (\w+) \{\n([\s\S]*?)\n\}/g)) {
  interfaces[m[1]] = [...m[2].matchAll(/^ {2}(\w+)\??: ([^;]+);/gm)].map((f) => ({ name: f[1], type: f[2] }));
}
const aliases = {};
for (const m of ts.matchAll(/export type (\w+) = ([^;]+);/g)) aliases[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
const pairs = [
  ['Product', types.product.schema], ['ProductLine', types['product-line'].schema], ['Industry', types.industry.schema],
  ['Showroom', types.showroom.schema], ['SiteSettings', types['site-setting'].schema],
  ['Seo', components['shared.seo']], ['Spec', components['catalog.spec']], ['JourneyStep', components['journey.step']],
];
for (const [iface, schema] of pairs) {
  const fields = interfaces[iface];
  if (!fields) { err(`types.ts: interface ${iface} not found`); continue; }
  const want = new Set(ownFields(schema).map(([n]) => n));
  const have = new Set(fields.map((f) => f.name));
  for (const n of want) if (!have.has(n)) err(`types.ts ${iface}: missing field "${n}" (in schema)`);
  for (const n of have) if (!want.has(n)) err(`types.ts ${iface}: field "${n}" is not in the schema`);
  for (const [n, a] of ownFields(schema)) {
    const f = fields.find((x) => x.name === n);
    if (f && a.type === 'enumeration') {
      const lits = aliases[f.type.trim()];
      if (!lits || lits.slice().sort().join() !== a.enum.slice().sort().join()) err(`types.ts ${iface}.${n}: values differ from schema enum ${a.enum.join('|')}`);
    }
  }
}

if (errors.length) {
  console.error(`seed check FAILED, ${errors.length} problem(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
const count = Object.entries(seed.vi ?? {}).map(([k, v]) => `${Array.isArray(v) ? v.length : 1} ${k}`).join(', ');
console.log(`seed check ok: ${locales.join(',')} (${count}); types.ts agrees with ${pairs.length} schemas; slug ledger holds`);
