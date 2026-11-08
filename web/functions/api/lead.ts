import { handleLead } from '../_lib/handle-lead.ts';
import type { LeadEnv } from '../_lib/env.ts';

/** Cloudflare Pages Function for POST /api/lead. All logic is in _lib/handle-lead.ts so it is testable as plain functions. */
export const onRequestPost = ({ request, env }: { request: Request; env: LeadEnv }): Promise<Response> => handleLead(request, env);

export const onRequest = (): Response =>
  new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } });
