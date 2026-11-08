import { getContent } from '../content/load';
import { t } from '../i18n/t';

/** What every form page needs from the CMS, in one place: the select choices and the fallback contact facts. */
export function leadChoices() {
  const c = getContent();
  const s = c.siteSettings;
  return {
    choices: {
      // Every showroom is bookable; one that is not yet open says so in the choice. Address and hours are never printed here.
      showroom: c.showrooms.map((r) => ({
        value: r.slug,
        label: r.opening_status === 'open' ? r.city : t(`lead.showroom.${r.opening_status}` as const, { city: r.city }),
      })),
      line: c.productLines.map((l) => ({ value: l.slug, label: l.name })),
      industry: c.industries.map((i) => ({ value: i.slug, label: i.name })),
    },
    productNames: Object.fromEntries(c.products.map((p) => [p.slug, p.model])),
    fallback: { phone: s.phone, email: s.email },
  };
}
