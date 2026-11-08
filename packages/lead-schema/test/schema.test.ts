import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, buildRecord, FIELDS, LEAD_KINDS, SCHEMA_VERSION } from '../src/index.ts';
import { samples } from './samples.ts';

const NOW = new Date('2026-11-08T03:00:00Z');

test('every kind: a valid submission validates and builds a versioned record', () => {
  for (const kind of LEAD_KINDS) {
    const v = validateLead(samples[kind], NOW);
    assert.equal(v.ok, true, `${kind}: ${JSON.stringify(v)}`);
    if (!v.ok) continue;
    const rec = buildRecord(v.value, 'abc-12345678', '2026-11-08T03:00:00.000Z');
    assert.equal(rec.schema_version, SCHEMA_VERSION);
    assert.equal(rec.kind, kind);
    assert.equal(rec.details.consent, true);
    assert.ok(rec.name.length > 0 && rec.phone.length > 0);
  }
});

test('every required field of every kind is rejected when missing', () => {
  for (const kind of LEAD_KINDS) {
    for (const def of FIELDS[kind].filter((d) => d.required)) {
      const body: Record<string, unknown> = { ...samples[kind] };
      delete body[def.name];
      const v = validateLead(body, NOW);
      assert.equal(v.ok, false, `${kind}.${def.name} missing should fail`);
      if (!v.ok) assert.equal(v.errors[def.name], def.control === 'checkbox' ? 'consent_required' : 'required');
    }
  }
});

test('field rules', () => {
  const base = samples.contact;
  const err = (patch: Record<string, unknown>) => {
    const v = validateLead({ ...base, ...patch }, NOW);
    return v.ok ? null : v.errors;
  };
  assert.equal(err({ phone: 'abc' })?.phone, 'invalid_phone');
  assert.equal(err({ phone: '12345' })?.phone, 'invalid_phone');
  assert.equal(err({ phone: '+84 912 345 678' }), null);
  assert.equal(err({ email: 'nope' })?.email, 'invalid_email');
  assert.equal(err({ email: '' }), null);
  assert.equal(err({ need_group: 'hack' })?.need_group, 'invalid_option');
  assert.equal(err({ message: 'x'.repeat(2001) })?.message, 'too_long');
  assert.equal(err({ name: '   ' })?.name, 'required');
  assert.equal(err({ consent: 'true' })?.consent, 'consent_required');
  assert.equal(validateLead({ ...samples.consult, product_slug: 'Bad Slug' }, NOW).ok, false);
  assert.equal(validateLead({ ...samples.showroom_booking, preferred_date: '2026-11-01' }, NOW).ok, false);
  assert.equal(validateLead({ ...samples.showroom_booking, preferred_date: '2026-02-30' }, NOW).ok, false);
  assert.equal(validateLead({ ...samples.showroom_booking, preferred_date: '2026-11-07' }, NOW).ok, true);
  assert.equal(validateLead({ kind: 'nope' }, NOW).ok, false);
  assert.equal(validateLead(null, NOW).ok, false);
});

test('unknown fields are dropped, never stored', () => {
  const v = validateLead({ ...samples.contact, evil: '<script>', details: { x: 1 } }, NOW);
  assert.equal(v.ok, true);
  if (v.ok) assert.deepEqual(Object.keys(v.value.values).sort(), ['consent', 'name', 'need_group', 'phone', 'company', 'email', 'message'].sort());
});
