import { handleRebuild, type RebuildEnv } from '../_lib/handle-rebuild.ts';

/** Cloudflare Pages Function for POST /api/rebuild. Logic lives in _lib/handle-rebuild.ts so it is testable as plain functions. */
export const onRequestPost = ({ request, env }: { request: Request; env: RebuildEnv }): Promise<Response> => handleRebuild(request, env);

export const onRequest = (): Response =>
  new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } });
