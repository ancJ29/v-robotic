/**
 * Browser side of every lead form (components/LeadForm.astro). Validates with the same validateLead the Worker
 * runs, posts JSON to /api/lead, and shows one of: field errors, success with a reference, or a failure that keeps
 * everything the visitor typed and offers a retry. It never clears the form on a failure.
 */
import { FIELDS, validateLead, type LeadKind } from '../../../packages/lead-schema/src/index.ts';

interface Config {
  kinds: LeadKind[];
  sitekey: string;
  endpoint: string;
  productNames: Record<string, string>;
  messages: {
    error: Record<string, string>; summary: string; busy: string; captchaWait: string; captchaBlocked: string;
    failUnavailable: string; failNetwork: string; failCaptcha: string; failGeneric: string;
    productContext: string; ref: string; submit: Record<string, string>;
  };
}
interface TurnstileApi { render(el: HTMLElement, o: Record<string, unknown>): string; reset(id?: string): void }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Address parameter -> the field it presets. ?service= and ?product= also choose the kind. */
const PRESET: Record<string, string> = { service: 'service_type', product: 'product_slug', type: 'partner_type', industry: 'industry_slug', showroom: 'showroom_slug' };
const TIMEOUT_MS = 15000;

export function initLeadForms(): void {
  document.querySelectorAll<HTMLFormElement>('form[data-lead-form]').forEach(setup);
}

function setup(form: HTMLFormElement): void {
  const cfg = JSON.parse(form.querySelector('script[data-config]')!.textContent!) as Config;
  const $ = <T extends HTMLElement>(sel: string) => form.querySelector<T>(sel)!;
  const submitBtn = $<HTMLButtonElement>('[data-submit]');
  const summary = $('[data-summary]');
  const failBox = $('[data-fail]');
  const failText = $('[data-fail-text]');
  const rows = [...form.querySelectorAll<HTMLElement>('[data-field]')];
  const fieldEl = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`);
  let kind: LeadKind = cfg.kinds[0];
  let submissionId = crypto.randomUUID();
  let token = '';
  let widget: string | undefined;
  let busy = false;

  // --- kind and presets from the address -------------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const has = (k: LeadKind) => cfg.kinds.includes(k);
  const service = params.get('service');
  const product = params.get('product');
  if (has('service') && service && fieldEl('service_type')?.querySelector(`option[value="${CSS.escape(service)}"]`)) kind = 'service';
  else if (has('consult') && product && SLUG.test(product)) kind = 'consult';
  for (const [param, field] of Object.entries(PRESET)) {
    const v = params.get(param);
    const el = fieldEl(field);
    if (!v || !el) continue;
    if (el instanceof HTMLSelectElement) { if (el.querySelector(`option[value="${CSS.escape(v)}"]`)) el.value = v; }
    else if (field === 'product_slug' && SLUG.test(v)) el.value = v;
  }
  const ctx = $('[data-product-ctx]');
  const name = product && cfg.productNames[product];
  if (kind === 'consult' && name) { ctx.textContent = cfg.messages.productContext.replace('{name}', name); ctx.hidden = false; }
  for (const el of form.querySelectorAll<HTMLInputElement>('input[type="date"]')) el.min = new Date().toISOString().slice(0, 10);

  function applyKind(): void {
    for (const row of rows) {
      const on = row.dataset.kinds!.split(' ').includes(kind);
      if (row.tagName !== 'INPUT') row.hidden = !on;
      row.querySelectorAll<HTMLInputElement>('input,select,textarea').forEach((i) => { i.disabled = !on; });
      if (row instanceof HTMLInputElement) row.disabled = !on;
    }
    form.querySelectorAll<HTMLElement>('[data-success-kind]').forEach((p) => { p.hidden = p.dataset.successKind !== kind; });
    submitBtn.textContent = cfg.messages.submit[kind] ?? submitBtn.textContent;
  }
  applyKind();

  // --- Turnstile ---------------------------------------------------------------------------------------------
  const box = $('[data-turnstile]');
  let tries = 0;
  const mount = window.setInterval(() => {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (api) {
      window.clearInterval(mount);
      widget = api.render(box, {
        sitekey: cfg.sitekey,
        callback: (t: string) => { token = t; },
        'expired-callback': () => { token = ''; },
        'error-callback': () => { token = ''; },
      });
    } else if (++tries > 50) {
      window.clearInterval(mount);
      showFail(cfg.messages.captchaBlocked);
    }
  }, 200);
  const turnstileReady = () => Boolean((window as unknown as { turnstile?: TurnstileApi }).turnstile && widget !== undefined);
  const resetCaptcha = () => { token = ''; if (widget !== undefined) (window as unknown as { turnstile: TurnstileApi }).turnstile.reset(widget); };

  // --- messages ----------------------------------------------------------------------------------------------
  function clearErrors(): void {
    summary.hidden = true; failBox.hidden = true;
    form.querySelectorAll<HTMLElement>('.err').forEach((e) => { e.hidden = true; e.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((e) => { e.removeAttribute('aria-invalid'); e.removeAttribute('aria-describedby'); });
  }
  function showFail(text: string): void { failText.textContent = text; failBox.hidden = false; failBox.scrollIntoView({ block: 'nearest' }); }
  function showFieldErrors(errors: Record<string, string | undefined>): boolean {
    let first: HTMLElement | null = null;
    for (const [field, code] of Object.entries(errors)) {
      const el = fieldEl(field);
      const msg = form.querySelector<HTMLElement>(`#err-${field}`);
      if (!el || !msg || !code) continue;
      msg.textContent = cfg.messages.error[code] ?? cfg.messages.error.required;
      msg.hidden = false;
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', msg.id);
      first ??= el;
    }
    if (!first) return false;
    summary.textContent = cfg.messages.summary; summary.hidden = false;
    first.focus();
    return true;
  }

  // --- submit ------------------------------------------------------------------------------------------------
  function collect(): Record<string, unknown> {
    const body: Record<string, unknown> = { kind, source_page: location.pathname, submission_id: submissionId };
    for (const def of FIELDS[kind]) {
      const el = fieldEl(def.name);
      if (!el) continue;
      body[def.name] = def.control === 'checkbox' ? el.checked : el.value;
    }
    body.website = fieldEl('website')?.value ?? '';
    return body;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy) return;
    clearErrors();
    const body = collect();
    const checked = validateLead(body);
    if (!checked.ok) { showFieldErrors(checked.errors); return; }
    if (!token) { showFail(turnstileReady() ? cfg.messages.captchaWait : cfg.messages.captchaBlocked); return; }

    busy = true; submitBtn.disabled = true; submitBtn.textContent = cfg.messages.busy;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, turnstile_token: token }), signal: ctl.signal });
      let out: { ok?: boolean; id?: string; error?: string; fields?: Record<string, string> } = {};
      try { out = await res.json(); } catch { /* not JSON: treated as a failure below */ }
      if (res.ok && out.ok) {
        form.classList.add('done');
        $('[data-ref]').textContent = cfg.messages.ref.replace('{id}', String(out.id ?? '').slice(0, 8).toUpperCase());
        const okBox = $('[data-success]'); okBox.hidden = false; okBox.focus();
        submissionId = crypto.randomUUID();
      } else if (res.status === 422 && out.fields) {
        if (!showFieldErrors(out.fields)) showFail(cfg.messages.failGeneric);
      } else if (res.status === 400 && out.error === 'captcha') {
        showFail(cfg.messages.failCaptcha);
      } else if (res.status === 503) {
        showFail(cfg.messages.failUnavailable);
      } else {
        showFail(cfg.messages.failGeneric);
      }
    } catch {
      showFail(cfg.messages.failNetwork);
    } finally {
      window.clearTimeout(timer);
      resetCaptcha(); // a Turnstile token is single use: always ask for a fresh one
      busy = false; submitBtn.disabled = false; applyKind();
    }
  });

  $('[data-again]').addEventListener('click', () => {
    form.reset(); form.classList.remove('done'); $('[data-success]').hidden = true; clearErrors();
    kind = cfg.kinds[0]; applyKind();
  });
}
