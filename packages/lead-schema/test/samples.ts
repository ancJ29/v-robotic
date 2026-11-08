import type { LeadKind } from '../src/index.ts';

const person = { name: 'Nguyen Van A', phone: '0900 000 111', consent: true, source_page: '/lien-he' };

/** One valid submission per kind. Shared by the schema tests and (via the same import path) the handler tests. */
export const samples: Record<LeadKind, Record<string, unknown>> = {
  contact: { ...person, kind: 'contact', company: 'Cong ty Mau', email: 'a@example.com', need_group: 'buy', message: 'Can tu van' },
  consult: { ...person, kind: 'consult', need_group: 'project', product_slug: 'robot-mau', source_page: '/lien-he' },
  service: { ...person, kind: 'service', service_type: 'rent', message: 'Thue theo thang' },
  showroom_booking: { ...person, kind: 'showroom_booking', showroom_slug: 'ha-noi', line_slug: 'dich-vu', preferred_date: '2026-11-20', source_page: '/showroom/dat-lich' },
  partnership: { ...person, kind: 'partnership', partner_type: 'distributor', company: 'Dai ly Mau', source_page: '/hop-tac' },
  warranty: { ...person, kind: 'warranty', serial: 'SN-0001', message: 'Robot khong khoi dong duoc', source_page: '/dich-vu/bao-hanh' },
  ai_assist: { ...person, kind: 'ai_assist', industry_slug: 'benh-vien', need: 'reception', stage: 'exploring', source_page: '/tro-ly-ai' },
};
