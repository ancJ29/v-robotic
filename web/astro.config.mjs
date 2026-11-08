import { defineConfig } from 'astro/config';
import { devLeadApi } from './dev/lead-api.mjs';

// devLeadApi serves /api/lead from the real handler during `astro dev` only; production uses functions/api/lead.ts.
export default defineConfig({ server: { port: 5173 }, vite: { plugins: [devLeadApi()] } });
