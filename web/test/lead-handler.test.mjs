// The real handler, called directly as a plain function (the local Workers runtime is not used; see docs/conventions/lead-path.md).
// Storage, Turnstile's siteverify and Slack are replaced by in-memory fakes passed in through `deps` / `env`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleLead } from '../functions/_lib/handle-lead.ts';
import { samples } from '../../packages/lead-schema/test/samples.ts';

const NOW = new Date('2026-11-08T03:00:00.000Z');

function world({ r2Fails = 0, r2Always = false, slackFails = false, siteverify = 'pass', webhook = 'https://hooks.example.test/x' } = {}) {
  const stored = new Map();
  const calls = { slack: [], siteverify: 0, puts: 0 };
  let failsLeft = r2Fails;
  const env = {
    TURNSTILE_SECRET_KEY: 'test-secret',
    SLACK_WEBHOOK_URL: webhook,
    LEADS: {
      async put(key, value, opts) {
        calls.puts++;
        if (r2Always || failsLeft-- > 0) throw new Error('r2 down');
        stored.set(key, { value, opts });
      },
    },
  };
  const deps = {
    now: () => NOW,
    uuid: () => '00000000-0000-4000-8000-000000000001',
    fetch: async (url, init) => {
      if (String(url).includes('siteverify')) {
        calls.siteverify++;
        if (siteverify === 'down') throw new Error('network');
        const token = new URLSearchParams(init.body).get('response');
        return new Response(JSON.stringify({ success: siteverify === 'pass' && token === 'good' }), { status: 200 });
      }
      calls.slack.push({ url, body: JSON.parse(init.body) });
      return new Response('ok', { status: slackFails ? 500 : 200 });
    },
  };
  return { env, deps, stored, calls };
}

const post = (body, headers = {}) =>
  new Request('https://v-robotic.example/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const submit = (kind, extra = {}) => ({ ...samples[kind], turnstile_token: 'good', ...extra });

for (const kind of Object.keys(samples)) {
  test(`${kind}: a valid submission is stored as a well-formed, versioned record, then announced minimally`, async () => {
    const w = world();
    const res = await handleLead(post(submit(kind)), w.env, w.deps);
    const out = await res.json();
    assert.equal(res.status, 200);
    assert.equal(out.ok, true);
    assert.equal(w.stored.size, 1);
    const [[key, { value, opts }]] = [...w.stored];
    assert.equal(key, `leads/2026-11-08/${kind}-${out.id}.json`);
    const rec = JSON.parse(value);
    assert.equal(rec.schema_version, 1);
    assert.equal(rec.id, out.id);
    assert.equal(rec.kind, kind);
    assert.equal(rec.created, '2026-11-08T03:00:00.000Z');
    assert.equal(rec.locale, 'vi');
    assert.equal(rec.source_page, samples[kind].source_page);
    assert.equal(rec.name, 'Nguyen Van A');
    assert.equal(rec.phone, '0900 000 111');
    assert.equal(rec.details.consent, true);
    assert.equal(opts.customMetadata.schema_version, '1');
    assert.equal('turnstile_token' in rec, false);
    // announced once, with the pointer to R2 and none of the contact details
    assert.equal(w.calls.slack.length, 1);
    const text = w.calls.slack[0].body.text;
    assert.ok(text.includes(key), 'the message locates the record');
    assert.ok(!text.includes('0900') && !text.includes('a@example.com'), 'no phone or email in Slack');
    console.log(`  ${kind} record: ${JSON.stringify(rec)}`);
  });
}

test('showroom booking and warranty land their per-kind fields where the schema says', async () => {
  const w = world();
  await handleLead(post(submit('showroom_booking')), w.env, w.deps);
  const r1 = JSON.parse([...w.stored.values()][0].value);
  assert.equal(r1.showroom_slug, 'ha-noi');
  assert.equal(r1.line_slug, 'dich-vu');
  assert.equal(r1.details.preferred_date, '2026-11-20');
  const w2 = world();
  await handleLead(post(submit('warranty')), w2.env, w2.deps);
  const r2 = JSON.parse([...w2.stored.values()][0].value);
  assert.equal(r2.details.serial, 'SN-0001');
  assert.equal(r2.message, 'Robot khong khoi dong duoc');
});

test('a missing required field is rejected with the field named, and nothing is stored or announced', async () => {
  const w = world();
  const body = submit('warranty');
  delete body.serial;
  const res = await handleLead(post(body), w.env, w.deps);
  assert.equal(res.status, 422);
  assert.deepEqual(await res.json(), { ok: false, error: 'invalid', fields: { serial: 'required' } });
  assert.equal(w.stored.size, 0);
  assert.equal(w.calls.slack.length, 0);
  assert.equal(w.calls.siteverify, 0, 'a typo does not spend the single-use token');
});

test('a failed Turnstile check is rejected; nothing is stored', async () => {
  const w = world();
  const res = await handleLead(post(submit('contact', { turnstile_token: 'bad' })), w.env, w.deps);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, error: 'captcha' });
  assert.equal(w.stored.size, 0);
  const none = await handleLead(post(submit('contact', { turnstile_token: undefined })), world().env, world().deps);
  assert.equal(none.status, 400);
});

test('Turnstile unreachable: 503 and nothing stored (fail closed, visitor not blamed)', async () => {
  const w = world({ siteverify: 'down' });
  const res = await handleLead(post(submit('contact')), w.env, w.deps);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'unavailable');
  assert.equal(w.stored.size, 0);
});

test('R2 failing once is retried and the lead is kept', async () => {
  const w = world({ r2Fails: 1 });
  const res = await handleLead(post(submit('contact')), w.env, w.deps);
  assert.equal(res.status, 200);
  assert.equal(w.stored.size, 1);
  assert.equal(w.calls.puts, 2);
});

test('R2 failing for good: 503, loud, and NO notification is sent (nothing safe to point at)', async () => {
  const w = world({ r2Always: true });
  const res = await handleLead(post(submit('contact')), w.env, w.deps);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false, error: 'unavailable' });
  assert.equal(w.calls.slack.length, 0);
});

test('no bucket bound counts as an R2 failure', async () => {
  const w = world();
  delete w.env.LEADS;
  assert.equal((await handleLead(post(submit('contact')), w.env, w.deps)).status, 503);
});

test('no Slack webhook configured: still success, lead stored, no call made', async () => {
  for (const webhook of [undefined, '', '   ']) {
    const w = world();
    if (webhook === undefined) delete w.env.SLACK_WEBHOOK_URL; else w.env.SLACK_WEBHOOK_URL = webhook;
    const res = await handleLead(post(submit('contact')), w.env, w.deps);
    assert.equal(res.status, 200);
    assert.equal(w.stored.size, 1);
    assert.equal(w.calls.slack.length, 0);
  }
});

test('Slack failing never fails the submission', async () => {
  const w = world({ slackFails: true });
  const res = await handleLead(post(submit('contact')), w.env, w.deps);
  assert.equal(res.status, 200);
  assert.equal(w.stored.size, 1);
  assert.equal(w.calls.slack.length, 1, 'one attempt; the notification is not retried');
});

test('a retry of the same submission rewrites one object, not two', async () => {
  const w = world();
  const body = submit('contact', { submission_id: 'abcdef12-3456' });
  await handleLead(post(body), w.env, w.deps);
  await handleLead(post(body), w.env, w.deps);
  assert.equal(w.stored.size, 1);
});

test('honeypot: answered like success, nothing stored', async () => {
  const w = world();
  const res = await handleLead(post(submit('contact', { website: 'http://spam' })), w.env, w.deps);
  assert.equal(res.status, 200);
  assert.equal(w.stored.size, 0);
  assert.equal(w.calls.slack.length, 0);
});

test('cross-site, oversized and malformed requests are refused', async () => {
  const w = world();
  assert.equal((await handleLead(post(submit('contact'), { Origin: 'https://evil.example' }), w.env, w.deps)).status, 403);
  assert.equal((await handleLead(post(submit('contact'), { Origin: 'https://v-robotic.example' }), w.env, w.deps)).status, 200);
  assert.equal((await handleLead(post(submit('contact', { message: 'x'.repeat(20000) })), w.env, w.deps)).status, 413);
  assert.equal((await handleLead(post('{nope'), w.env, w.deps)).status, 400);
  assert.equal((await handleLead(post('[1]'), w.env, w.deps)).status, 400);
  assert.equal(w.stored.size, 1);
});
