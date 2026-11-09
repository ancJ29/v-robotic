/**
 * POST /api/rebuild: the relay between Strapi's Publish webhook and GitHub Actions (piece P7).
 * Strapi's webhook can set headers but cannot shape its body, and GitHub's dispatch endpoints need a body
 * Strapi will not send ("ref"), so this Function answers Strapi and makes the call GitHub wants.
 * It starts the existing web-deploy workflow with content_source=strapi; it deploys nothing itself.
 * NEVER RUN against real GitHub or Strapi: tested only with fakes (web/test/rebuild-handler.test.mjs).
 */
import type { FetchFn } from './env.ts';

export interface RebuildEnv {
  /** Shared secret Strapi sends as "Authorization: Bearer <secret>". A credential (Pages secret). */
  REBUILD_HOOK_SECRET?: string;
  /** Fine-grained GitHub token: this repository only, permission Actions: Read and write, nothing else. A credential (Pages secret). */
  GITHUB_DISPATCH_TOKEN?: string;
  /** owner/name. Not secret; declared in wrangler.jsonc "vars". */
  GITHUB_REPO?: string;
}

// Events that change what the site shows. Strapi's own "trigger-test" is answered but starts nothing.
const REBUILD_EVENTS = new Set(['entry.publish', 'entry.unpublish', 'entry.delete', 'media.create', 'media.update', 'media.delete']);
const WORKFLOW_FILE = 'web-deploy.yml';

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Compares through SHA-256 digests so the time taken does not depend on how many leading characters match. */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function handleRebuild(request: Request, env: RebuildEnv, deps: { fetch?: FetchFn } = {}): Promise<Response> {
  const doFetch: FetchFn = deps.fetch ?? ((u, i) => fetch(u, i));
  if (!env.REBUILD_HOOK_SECRET || !env.GITHUB_DISPATCH_TOKEN || !env.GITHUB_REPO) return json(503, { ok: false, error: 'not_configured' });
  const auth = request.headers.get('Authorization') ?? '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!given || !(await sameSecret(given, env.REBUILD_HOOK_SECRET))) return json(401, { ok: false, error: 'unauthorized' });

  let event = '';
  try {
    event = String(((await request.json()) as { event?: unknown }).event ?? '');
  } catch {
    return json(400, { ok: false, error: 'bad_body' });
  }
  if (!REBUILD_EVENTS.has(event)) return json(200, { ok: true, dispatched: false, event });

  let res: Response;
  try {
    res = await doFetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'v-robotic-rebuild-relay',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { content_source: 'strapi' } }),
    });
  } catch {
    return json(502, { ok: false, error: 'github_unreachable' });
  }
  // GitHub answers 204 and no body. Anything else is surfaced as a status only, never GitHub's text (it can echo the repo).
  if (res.status !== 204) return json(502, { ok: false, error: 'github_refused', status: res.status });
  return json(202, { ok: true, dispatched: true, event });
}
