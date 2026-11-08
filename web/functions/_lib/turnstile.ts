import type { FetchFn } from './env.ts';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = 'pass' | 'fail' | 'unreachable';

/**
 * Asks Cloudflare whether a token is genuine. 'fail' = the token is wrong, spent or absent (a bot, or a stale page);
 * 'unreachable' = we could not ask, which the handler treats differently (the visitor is not at fault).
 */
export async function verifyTurnstile(token: unknown, secret: string | undefined, ip: string | null, fetchFn: FetchFn): Promise<TurnstileResult> {
  if (!secret) return 'unreachable';
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return 'fail';
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const res = await fetchFn(VERIFY_URL, { method: 'POST', body: form });
    if (!res.ok) return 'unreachable';
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? 'pass' : 'fail';
  } catch {
    return 'unreachable';
  }
}
