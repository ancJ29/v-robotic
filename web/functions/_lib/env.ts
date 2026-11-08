/**
 * Everything the lead Function reads from its environment. Names are the contract with Cloudflare Pages
 * (Settings > Environment variables, and the R2 binding); values never appear in the repository.
 * Placeholders live in web/.dev.vars.example.
 */
export interface LeadBucket {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
}

export interface LeadEnv {
  /** R2 binding to the private bucket. The Worker holds no storage credential: the binding is the whole grant. */
  LEADS?: LeadBucket;
  /** Turnstile secret (server side). */
  TURNSTILE_SECRET_KEY?: string;
  /** Slack incoming-webhook URL for the notification. Absent or empty = no notifier (a logged no-op, never an error). A credential. */
  SLACK_WEBHOOK_URL?: string;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
