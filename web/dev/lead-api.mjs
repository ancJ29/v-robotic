// Local stand-in for the Cloudflare Pages Function, used by `astro dev` only (never part of a build).
// It mounts the REAL handler (functions/_lib/handle-lead.ts) at /api/lead, with the bucket replaced by a folder:
// leads land as files under web/.dev-leads/ (git-ignored). Turnstile uses Cloudflare's always-passes test secret
// unless TURNSTILE_SECRET_KEY is set; Slack is skipped unless SLACK_WEBHOOK_URL is set.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { handleLead } from '../functions/_lib/handle-lead.ts';

const ROOT = resolve(import.meta.dirname, '..', '.dev-leads');

export function devLeadApi() {
  const env = {
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA',
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',
    LEADS: {
      async put(key, value) {
        const file = join(ROOT, key);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, value);
        console.log(`[dev lead] stored ${file}`);
      },
    },
  };
  return {
    name: 'dev-lead-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/lead', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); res.end('{"ok":false,"error":"method_not_allowed"}'); return; }
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const request = new Request(`http://${req.headers.host}/api/lead`, { method: 'POST', headers: req.headers, body: Buffer.concat(chunks) });
        const out = await handleLead(request, env);
        res.statusCode = out.status;
        out.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await out.text());
      });
    },
  };
}
