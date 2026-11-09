// The relay called as a plain function with a fake GitHub. Nothing here has touched real GitHub or Strapi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRebuild } from '../functions/_lib/handle-rebuild.ts';

const env = { REBUILD_HOOK_SECRET: 's3cret', GITHUB_DISPATCH_TOKEN: 'ghp_fake', GITHUB_REPO: 'o/r' };
const req = (body, auth = 'Bearer s3cret') => new Request('https://x.test/api/rebuild', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) });
const gh = (status = 204) => { const calls = []; return { calls, fetch: async (u, i) => { calls.push({ u, i }); return new Response(null, { status }); } }; };

test('a publish event dispatches web-deploy on main with content_source=strapi', async () => {
  const g = gh();
  const res = await handleRebuild(req({ event: 'entry.publish' }), env, g);
  assert.equal(res.status, 202);
  assert.equal(g.calls.length, 1);
  assert.equal(g.calls[0].u, 'https://api.github.com/repos/o/r/actions/workflows/web-deploy.yml/dispatches');
  assert.deepEqual(JSON.parse(g.calls[0].i.body), { ref: 'main', inputs: { content_source: 'strapi' } });
  assert.equal(g.calls[0].i.headers.Authorization, 'Bearer ghp_fake');
});
test('wrong, missing or malformed secret: 401 and GitHub is not called', async () => {
  for (const a of ['Bearer nope', '', 'Basic s3cret', 'Bearer ']) {
    const g = gh();
    assert.equal((await handleRebuild(req({ event: 'entry.publish' }, a), env, g)).status, 401);
    assert.equal(g.calls.length, 0);
  }
});
test('unconfigured: 503, never a dispatch', async () => {
  const g = gh();
  assert.equal((await handleRebuild(req({ event: 'entry.publish' }), { ...env, GITHUB_DISPATCH_TOKEN: '' }, g)).status, 503);
  assert.equal(g.calls.length, 0);
});
test('Strapi trigger-test and unrelated events: answered 200, nothing started', async () => {
  const g = gh();
  const res = await handleRebuild(req({ event: 'trigger-test' }), env, g);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).dispatched, false);
  assert.equal(g.calls.length, 0);
});
test('bad body: 400', async () => { assert.equal((await handleRebuild(req('not json'), env, gh())).status, 400); });
test('GitHub refuses or is unreachable: 502, GitHub text not echoed', async () => {
  const r = await handleRebuild(req({ event: 'entry.unpublish' }), env, gh(404));
  assert.equal(r.status, 502);
  assert.deepEqual(await r.json(), { ok: false, error: 'github_refused', status: 404 });
  assert.equal((await handleRebuild(req({ event: 'entry.publish' }), env, { fetch: async () => { throw new Error('net'); } })).status, 502);
});
