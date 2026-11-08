/**
 * The lead: one record shape, written by seven kinds of form, validated by this one module in the browser
 * and in the Worker, so the two cannot drift. No dependencies; plain functions.
 *
 * The record written to R2 is the one shape in the system with no migration path (files written on the day),
 * so it carries `schema_version` from its first write. Change the shape => bump SCHEMA_VERSION, never edit in place.
 */
export const SCHEMA_VERSION = 1 as const;

export const LEAD_KINDS = ['contact', 'consult', 'service', 'showroom_booking', 'partnership', 'warranty', 'ai_assist'] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

/** Fixed choices. The visitor-facing label of each is a string at `lead.option.<field>.<value>` in vi.json. */
export const OPTIONS = {
  need_group: ['buy', 'project', 'service'],
  service_type: ['rent', 'finance', 'deploy'],
  partner_type: ['distributor', 'showroom', 'integrator', 'international', 'research', 'referral'],
  need: ['reception', 'delivery', 'cleaning', 'warehouse', 'other'],
  stage: ['exploring', 'comparing', 'quote'],
} as const;

export type Control = 'text' | 'tel' | 'email' | 'textarea' | 'select' | 'date' | 'checkbox';

export type FieldName =
  | 'name' | 'phone' | 'email' | 'company' | 'message' | 'product_slug'
  | 'need_group' | 'service_type' | 'partner_type' | 'need' | 'stage' | 'serial' | 'preferred_date'
  | 'line_slug' | 'industry_slug' | 'showroom_slug' | 'consent';

/**
 * One form field and where it lands in the record: a top-level column, or a key of `details`.
 * `options` = a fixed list (OPTIONS); `cms` = the slug of a CMS entity, whose choices the page supplies.
 */
export interface FieldDef {
  /** Form field name AND string key (`lead.field.<name>`). */
  name: FieldName;
  control: Control;
  required: boolean;
  /** Max characters (select/checkbox ignore it). */
  max: number;
  width: 'half' | 'full';
  to: 'name' | 'phone' | 'email' | 'company' | 'message' | 'product_slug' | 'line_slug' | 'industry_slug' | 'showroom_slug' | 'details';
  options?: keyof typeof OPTIONS;
  cms?: 'line' | 'industry' | 'showroom';
}

const f = (name: FieldName, control: Control, required: boolean, max: number, width: 'half' | 'full', to: FieldDef['to'], extra: Partial<FieldDef> = {}): FieldDef =>
  ({ name, control, required, max, width, to, ...extra });

const NAME = f('name', 'text', true, 100, 'half', 'name');
const PHONE = f('phone', 'tel', true, 30, 'half', 'phone');
const EMAIL = f('email', 'email', false, 120, 'half', 'email');
const COMPANY = (required: boolean) => f('company', 'text', required, 150, 'half', 'company');
const MESSAGE = (required: boolean) => f('message', 'textarea', required, 2000, 'full', 'message');
const CONSENT = f('consent', 'checkbox', true, 0, 'full', 'details');
const NEED_GROUP = f('need_group', 'select', true, 0, 'full', 'details', { options: 'need_group' });
/** Not a visible field: filled from the page address (?product=). */
const PRODUCT = f('product_slug', 'text', false, 80, 'full', 'product_slug');

/** Per kind: the fields, in the order a form prints them, and which are required. */
export const FIELDS: Record<LeadKind, readonly FieldDef[]> = {
  contact: [NAME, COMPANY(false), PHONE, EMAIL, NEED_GROUP, MESSAGE(false), CONSENT],
  consult: [NAME, COMPANY(false), PHONE, EMAIL, NEED_GROUP, PRODUCT, MESSAGE(false), CONSENT],
  service: [NAME, COMPANY(false), PHONE, EMAIL, f('service_type', 'select', true, 0, 'full', 'details', { options: 'service_type' }), MESSAGE(false), CONSENT],
  showroom_booking: [
    f('showroom_slug', 'select', true, 80, 'full', 'showroom_slug', { cms: 'showroom' }),
    f('line_slug', 'select', false, 80, 'half', 'line_slug', { cms: 'line' }),
    f('preferred_date', 'date', true, 10, 'half', 'details'),
    NAME, PHONE, EMAIL, CONSENT,
  ],
  partnership: [f('partner_type', 'select', true, 0, 'full', 'details', { options: 'partner_type' }), COMPANY(true), NAME, PHONE, EMAIL, MESSAGE(false), CONSENT],
  warranty: [f('serial', 'text', true, 60, 'half', 'details'), COMPANY(false), NAME, PHONE, EMAIL, MESSAGE(true), CONSENT],
  ai_assist: [
    f('industry_slug', 'select', true, 80, 'full', 'industry_slug', { cms: 'industry' }),
    f('need', 'select', true, 0, 'half', 'details', { options: 'need' }),
    f('stage', 'select', true, 0, 'half', 'details', { options: 'stage' }),
    MESSAGE(false), NAME, PHONE, EMAIL, CONSENT,
  ],
};

export interface LeadRecord {
  schema_version: typeof SCHEMA_VERSION;
  /** Also the visitor's receipt code (first 8 characters shown). A retry of one submission rewrites one object. */
  id: string;
  kind: LeadKind;
  /** ISO 8601, set by the Worker, never by the browser. */
  created: string;
  locale: 'vi';
  /** Path of the page the form was on. */
  source_page: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  message: string | null;
  product_slug: string | null;
  line_slug: string | null;
  industry_slug: string | null;
  showroom_slug: string | null;
  /** Per-kind extras: need_group, service_type, partner_type, need, stage, serial, preferred_date, consent. */
  details: Record<string, string | boolean>;
}

/** Machine codes only; the words for each are `lead.error.<code>` in vi.json. */
export type ErrorCode =
  | 'required' | 'too_long' | 'invalid_phone' | 'invalid_email' | 'invalid_option'
  | 'invalid_slug' | 'invalid_date' | 'date_past' | 'consent_required';

export type FieldErrors = Partial<Record<string, ErrorCode>>;

export interface ValidLead {
  kind: LeadKind;
  id: string | null;
  source_page: string;
  values: Record<string, string | boolean>;
}

export type Validation = { ok: true; value: ValidLead } | { ok: false; kind: LeadKind | null; errors: FieldErrors };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_RE = /^\+?[\d\s().-]+$/;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
// Control characters except tab, newline and carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const DAY = 24 * 3600 * 1000;

export function isKind(v: unknown): v is LeadKind {
  return typeof v === 'string' && (LEAD_KINDS as readonly string[]).includes(v);
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(CONTROL, '').trim() : '');

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Validates a submission of one kind. Unknown fields are dropped (never stored). Every field's error is
 * returned at once so a form can show them together. `now` is injected so tests are deterministic.
 */
export function validateLead(input: unknown, now: Date = new Date()): Validation {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const kind = body.kind;
  if (!isKind(kind)) return { ok: false, kind: null, errors: { kind: 'invalid_option' } };

  const errors: FieldErrors = {};
  const values: Record<string, string | boolean> = {};
  for (const def of FIELDS[kind]) {
    const raw = body[def.name];
    if (def.control === 'checkbox') {
      if (raw === true) values[def.name] = true;
      else if (def.required) errors[def.name] = 'consent_required';
      continue;
    }
    const v = clean(raw);
    if (v === '') {
      if (def.required) errors[def.name] = 'required';
      continue;
    }
    if (def.max > 0 && v.length > def.max) { errors[def.name] = 'too_long'; continue; }
    if (def.options && !(OPTIONS[def.options] as readonly string[]).includes(v)) { errors[def.name] = 'invalid_option'; continue; }
    if ((def.cms || def.name === 'product_slug') && !SLUG.test(v)) { errors[def.name] = 'invalid_slug'; continue; }
    if (def.control === 'email' && !EMAIL_RE.test(v)) { errors[def.name] = 'invalid_email'; continue; }
    if (def.control === 'tel') {
      const digits = v.replace(/\D/g, '').length;
      if (!PHONE_RE.test(v) || digits < 8 || digits > 15) { errors[def.name] = 'invalid_phone'; continue; }
    }
    if (def.control === 'date') {
      if (!validDate(v)) { errors[def.name] = 'invalid_date'; continue; }
      // One day of slack so a visitor ahead of or behind UTC is never told today is "in the past".
      const earliest = new Date(now.getTime() - DAY).toISOString().slice(0, 10);
      const latest = new Date(now.getTime() + 366 * DAY).toISOString().slice(0, 10);
      if (v < earliest) { errors[def.name] = 'date_past'; continue; }
      if (v > latest) { errors[def.name] = 'invalid_date'; continue; }
    }
    values[def.name] = v;
  }
  if (Object.keys(errors).length > 0) return { ok: false, kind, errors };

  const sourcePage = clean(body.source_page);
  const id = clean(body.submission_id);
  return {
    ok: true,
    value: {
      kind,
      id: ID_RE.test(id) ? id : null,
      source_page: sourcePage.startsWith('/') && sourcePage.length <= 200 ? sourcePage : '/',
      values,
    },
  };
}

/** Builds the record the Worker stores. `id` and `created` come from the Worker, never the browser's clock. */
export function buildRecord(v: ValidLead, id: string, created: string): LeadRecord {
  const rec: LeadRecord = {
    schema_version: SCHEMA_VERSION,
    id,
    kind: v.kind,
    created,
    locale: 'vi',
    source_page: v.source_page,
    name: '',
    phone: '',
    email: null,
    company: null,
    message: null,
    product_slug: null,
    line_slug: null,
    industry_slug: null,
    showroom_slug: null,
    details: {},
  };
  for (const def of FIELDS[v.kind]) {
    const val = v.values[def.name];
    if (val === undefined) continue;
    if (def.to === 'details') rec.details[def.name] = val;
    else rec[def.to] = String(val);
  }
  return rec;
}
