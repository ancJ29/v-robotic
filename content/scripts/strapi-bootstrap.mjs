// Makes a fresh local Strapi usable by scripts: creates the first admin if none exists, logs in, and
// (re)creates two API tokens, "import" (full access, writes the seed) and "site" (read-only, what the
// site build reads). Writes them to a git-ignored file; prints no secret.
// Env: STRAPI_URL (default http://127.0.0.1:1337), ADMIN_EMAIL, ADMIN_PASSWORD, TOKENS_FILE (default cms/.env.tokens).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const out = process.env.TOKENS_FILE ?? path.join(repo, 'cms/.env.tokens');
if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (local throwaway values; see docs/conventions/strapi-local.md)');

async function call(method, p, body, jwt) {
  const res = await fetch(url + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

let r = await call('POST', '/admin/login', { email, password });
if (r.status !== 200) {
  const reg = await call('POST', '/admin/register-admin', { email, password, firstname: 'Local', lastname: 'Admin' });
  if (reg.status !== 200) throw new Error(`neither login (${r.status}) nor first-admin registration (${reg.status}) worked`);
  r = reg;
}
const jwt = r.json.data.token;

const existing = await call('GET', '/admin/api-tokens', null, jwt);
for (const t of existing.json?.data ?? []) {
  if (t.name === 'import' || t.name === 'site') await call('DELETE', `/admin/api-tokens/${t.id}`, null, jwt);
}
const keys = {};
for (const [name, type] of [['import', 'full-access'], ['site', 'read-only']]) {
  const t = await call('POST', '/admin/api-tokens', { name, description: `local ${name}`, type, lifespan: null }, jwt);
  if (t.status !== 201 && t.status !== 200) throw new Error(`creating token ${name} answered ${t.status}`);
  keys[name] = t.json.data.accessKey;
}
fs.writeFileSync(out, `STRAPI_IMPORT_TOKEN=${keys.import}\nSTRAPI_TOKEN=${keys.site}\n`, { mode: 0o600 });
console.log(`admin ${email} ready; tokens written to ${out}`);
