import type {
  Content, Industry, JourneyStep, Locale, MediaRef, Product, ProductLine, Seo, Showroom, SiteSettings, Spec,
} from './types';

/**
 * The Strapi adapter: Strapi 5's REST answer (flattened `data`, relations and components populated)
 * turned into exactly the shapes in types.ts. `mapContent` is pure and unit-tested; `fetchContent`
 * is the only part that touches the network. Relation objects become slugs, media become MediaRef,
 * ids Strapi adds (`id`, `documentId`, timestamps) are dropped. Empty is `null` or `[]`, as in the seed.
 */

type Raw = Record<string, any>; // Strapi's answer is untyped JSON; the mappers below pick the fields they trust.

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const slugs = (v: unknown): string[] => (Array.isArray(v) ? v.map((x: Raw) => x.slug as string) : []);
const slugOf = (v: unknown): string | null => (v && typeof v === 'object' ? ((v as Raw).slug ?? null) : null);

/** `publicUrl` is prefixed to a relative upload path (the local provider); an R2 URL is already absolute. */
export function mapMedia(m: Raw | null | undefined, publicUrl: string): MediaRef | null {
  if (!m) return null;
  const url = String(m.url ?? '');
  return {
    src: /^https?:\/\//.test(url) ? url : publicUrl.replace(/\/$/, '') + url,
    alt: str(m.alternativeText),
    width: num(m.width),
    height: num(m.height),
  };
}
const medias = (v: unknown, publicUrl: string): MediaRef[] =>
  Array.isArray(v) ? v.map((m) => mapMedia(m, publicUrl)!).filter(Boolean) : [];

function mapSeo(s: Raw | null | undefined): Seo | null {
  return s ? { meta_title: str(s.meta_title), meta_description: str(s.meta_description), noindex: s.noindex !== false } : null;
}

function mapSpec(s: Raw): Spec {
  return { group: str(s.group), key: s.key, label: s.label, value: s.value, value_number: num(s.value_number), unit: str(s.unit) };
}

function mapStep(s: Raw): JourneyStep {
  return { order: s.order, title: s.title, detail: str(s.detail) };
}

export function mapProductLine(r: Raw): ProductLine {
  return { name: r.name, slug: r.slug, summary: str(r.summary), order: r.order, sample_data: !!r.sample_data };
}

export function mapProduct(r: Raw, publicUrl: string): Product {
  return {
    kind: r.kind,
    model: r.model,
    slug: r.slug,
    line: slugOf(r.line),
    industries: slugs(r.industries),
    related: slugs(r.related),
    compatible_with: slugs(r.compatible_with),
    summary: str(r.summary),
    description: str(r.description),
    sample_data: !!r.sample_data,
    name_provisional: !!r.name_provisional,
    spec_pending: !!r.spec_pending,
    featured: !!r.featured,
    badge: r.badge,
    video_url: str(r.video_url),
    gallery: medias(r.gallery, publicUrl),
    documents: medias(r.documents, publicUrl),
    specs: (r.specs ?? []).map(mapSpec),
    seo: mapSeo(r.seo),
  };
}

export function mapIndustry(r: Raw, publicUrl: string): Industry {
  return {
    name: r.name,
    slug: r.slug,
    order: r.order,
    sample_data: !!r.sample_data,
    tagline: str(r.tagline),
    problem: str(r.problem),
    hero_image: mapMedia(r.hero_image, publicUrl),
    journey: (r.journey ?? []).map(mapStep),
    seo: mapSeo(r.seo),
  };
}

export function mapShowroom(r: Raw, publicUrl: string): Showroom {
  return {
    city: r.city,
    name: r.name,
    slug: r.slug,
    opening_status: r.opening_status,
    description: str(r.description),
    address: str(r.address),
    hours: str(r.hours),
    sample_data: !!r.sample_data,
    details_confirmed: !!r.details_confirmed,
    gallery: medias(r.gallery, publicUrl),
  };
}

export function mapSiteSettings(r: Raw, publicUrl: string): SiteSettings {
  return {
    brand_name: str(r.brand_name),
    tagline: str(r.tagline),
    hero_headline: str(r.hero_headline),
    hero_sub: str(r.hero_sub),
    phone: str(r.phone),
    zalo: str(r.zalo),
    whatsapp: str(r.whatsapp),
    email: str(r.email),
    address: str(r.address),
    legal_entity: str(r.legal_entity),
    show_demo_banner: r.show_demo_banner !== false,
    logo: mapMedia(r.logo, publicUrl),
    mark: mapMedia(r.mark, publicUrl),
    share_image: mapMedia(r.share_image, publicUrl),
    favicon: mapMedia(r.favicon, publicUrl),
    seo: mapSeo(r.seo),
  };
}

/** What `fetchContent` collects: the raw `data` of each endpoint. */
export interface RawContent {
  siteSetting: Raw;
  productLines: Raw[];
  products: Raw[];
  industries: Raw[];
  showrooms: Raw[];
}

export function mapContent(raw: RawContent, locale: Locale, publicUrl: string): Content {
  return {
    locale,
    siteSettings: mapSiteSettings(raw.siteSetting, publicUrl),
    productLines: raw.productLines.map(mapProductLine).sort((a, b) => a.order - b.order),
    products: raw.products.map((r) => mapProduct(r, publicUrl)),
    industries: raw.industries.map((r) => mapIndustry(r, publicUrl)).sort((a, b) => a.order - b.order),
    showrooms: raw.showrooms.map((r) => mapShowroom(r, publicUrl)),
  };
}

// Creation order is the catalogue order (the seed's). Not `id`: an edit in the admin re-publishes the row under
// a new id and would move the product to the end; `createdAt` survives (measured in P5).
const ORDER_CREATED = 'sort[0]=createdAt:asc&sort[1]=id:asc';
// Relations come back as slugs only (`fields`), components and media in full.
const slugOnly = (name: string) => `populate[${name}][fields][0]=slug`;
const QUERIES = {
  productLines: 'sort=order:asc',
  industries: ['sort=order:asc', 'populate[journey]=true', 'populate[seo]=true', 'populate[hero_image]=true'].join('&'),
  products: [
    ORDER_CREATED, slugOnly('line'), slugOnly('industries'), slugOnly('related'), slugOnly('compatible_with'),
    'populate[specs]=true', 'populate[seo]=true', 'populate[gallery]=true', 'populate[documents]=true',
  ].join('&'),
  showrooms: [ORDER_CREATED, 'populate[gallery]=true'].join('&'),
};
const SITE_QUERY = ['logo', 'mark', 'share_image', 'favicon', 'seo'].map((f) => `populate[${f}]=true`).join('&');

export interface StrapiOptions {
  url: string;
  token: string | null;
  locale: Locale;
  /** Prefix for relative media paths; defaults to `url`. */
  publicUrl?: string;
}

/** Reads every page of a collection (Strapi caps a page at 100). Fails loudly: a half-read catalogue must never build. */
async function getAll(o: StrapiOptions, plural: string, query: string): Promise<Raw[]> {
  const out: Raw[] = [];
  for (let page = 1; ; page++) {
    const body = await getJson(o, `/api/${plural}?locale=${o.locale}&pagination[page]=${page}&pagination[pageSize]=100&${query}`);
    out.push(...body.data);
    if (page >= (body.meta?.pagination?.pageCount ?? 1)) return out;
  }
}

async function getJson(o: StrapiOptions, path: string): Promise<Raw> {
  const res = await fetch(o.url.replace(/\/$/, '') + path, { headers: o.token ? { Authorization: `Bearer ${o.token}` } : {} });
  if (!res.ok) throw new Error(`Strapi answered ${res.status} for ${path.split('?')[0]} (${o.url})`);
  return res.json();
}

export async function fetchContent(o: StrapiOptions): Promise<Content> {
  const [site, productLines, industries, products, showrooms] = await Promise.all([
    getJson(o, `/api/site-setting?locale=${o.locale}&${SITE_QUERY}`),
    getAll(o, 'product-lines', QUERIES.productLines),
    getAll(o, 'industries', QUERIES.industries),
    getAll(o, 'products', QUERIES.products),
    getAll(o, 'showrooms', QUERIES.showrooms),
  ]);
  return mapContent({ siteSetting: site.data, productLines, products, industries, showrooms }, o.locale, o.publicUrl ?? o.url);
}
