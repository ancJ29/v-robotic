import { buildRecord, validateLead, type LeadRecord } from '../../../packages/lead-schema/src/index.ts';
import type { FetchFn, LeadEnv } from './env.ts';
import { leadKey, sendLeadNotification } from './notify.ts';
import { verifyTurnstile } from './turnstile.ts';

export interface Deps {
  fetch: FetchFn;
  now: () => Date;
  uuid: () => string;
}
const realDeps: Deps = { fetch: (i, init) => fetch(i, init), now: () => new Date(), uuid: () => crypto.randomUUID() };

/** Largest body accepted. A lead is a few hundred bytes; the longest text field is 2000 characters. */
const MAX_BODY = 16 * 1024;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Tries once more on failure; one blip must not cost a lead. */
async function twice<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

/**
 * POST /api/lead. The answer the browser gets, and what it means:
 *   200 { ok: true, id }               the lead is safe in R2 (the notification may have failed or be unconfigured)
 *   422 { ok: false, error: 'invalid', fields }   a field failed validation (codes, not words)
 *   400 { ok: false, error: 'captcha' }           the spam check failed; get a fresh token and retry
 *   413 / 400 / 403                    malformed, oversized or cross-site
 *   503 { ok: false, error: 'unavailable' }       NOTHING was saved (R2 failed, or the spam check could
 *                                       not be reached); the form keeps the data and offers a retry or the phone
 * A lead counts as safe only when R2 has it.
 */
export async function handleLead(request: Request, env: LeadEnv, deps: Deps = realDeps): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { ok: false, error: 'forbidden' });

  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { ok: false, error: 'too_large' });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'bad_request' });
  }

  // Honeypot: a hidden field a person never fills. Answer like a success so a bot learns nothing; store nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') return json(200, { ok: true, id: deps.uuid() });

  // Validate before spending a Turnstile token: a token is single-use, and a visitor with a typo should keep theirs.
  const checked = validateLead(body, deps.now());
  if (!checked.ok) return json(422, { ok: false, error: 'invalid', fields: checked.errors });

  const verdict = await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'), deps.fetch);
  if (verdict === 'fail') return json(400, { ok: false, error: 'captcha' });
  if (verdict === 'unreachable') {
    console.error(JSON.stringify({ event: 'lead_turnstile_unreachable' }));
    return json(503, { ok: false, error: 'unavailable' });
  }

  const created = deps.now().toISOString();
  const id = checked.value.id ?? deps.uuid();
  const record: LeadRecord = buildRecord(checked.value, id, created);

  // ORDER IS THE RULE: R2 is the record of truth, the notification is a best-effort extra.
  // 1. Write to R2 (twice if the first try fails). If that fails, the lead is lost, so fail loudly: 503.
  // 2. Only then notify. A failed or absent notification is logged and never changes the answer.
  // Logs carry the id, the kind and the step, never a name, phone or message.
  const log = (event: string, reason: unknown) =>
    console.error(JSON.stringify({ event, id: record.id, kind: record.kind, reason: reason instanceof Error ? reason.message : String(reason) }));

  try {
    await twice(async () => {
      if (!env.LEADS) throw new Error('no_bucket');
      await env.LEADS.put(leadKey(record), JSON.stringify(record, null, 2), {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: { kind: record.kind, schema_version: String(record.schema_version) },
      });
    });
  } catch (e) {
    log('lead_store_failed', e);
    return json(503, { ok: false, error: 'unavailable' });
  }

  try {
    await sendLeadNotification(env, record, deps.fetch);
  } catch (e) {
    log('lead_notify_failed', e);
  }
  return json(200, { ok: true, id: record.id });
}
