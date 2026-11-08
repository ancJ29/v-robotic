/**
 * The content contract: what the site reads, in one locale, whatever feeds it.
 *
 * Two feeds produce exactly these shapes: the seed JSON in `content/seed/<locale>/` (read as-is)
 * and, from piece P5, the adapter over Strapi's REST answer. Each interface here lists the same
 * fields as its Strapi schema in `cms/src/api/<type>/content-types/<type>/schema.json` (or, for
 * the Spec / JourneyStep / Seo shapes, `cms/src/components/`). `content/scripts/validate-seed.mjs`
 * checks that agreement by machine; change a field in one place and it fails until the other moves.
 *
 * Rules the shapes follow:
 * - Relations are slugs, not nested records. Slugs are the contract; see docs/conventions/content.md.
 * - Only the owning side of a relation is a field (the inverse, e.g. a line's products, is derived).
 * - An empty value is `null` (or `[]` for a list) and the site renders correctly when it is.
 * - Text fields marked "localized" in the schema are in the record's locale; the rest are shared.
 */

export type Locale = 'vi' | 'en';

/** A file in the media library, or a placeholder. `src` is a site-relative path or absolute URL. */
export interface MediaRef {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface Seo {
  meta_title: string | null;
  meta_description: string | null;
  /** True keeps the page out of search engines. The site is noindex everywhere until launch. */
  noindex: boolean;
}

/** One line of a product's specification. `key` is the stable machine name filters use. */
export interface Spec {
  /** Display group, e.g. "Tải trọng". */
  group: string | null;
  /** Stable, never translated: "payload_kg". Filters, comparison and calculators join on it. */
  key: string;
  label: string;
  /** What the spec tab prints. */
  value: string;
  /** The same value as a number when it is one, so "over 50 kg" can be a filter. */
  value_number: number | null;
  unit: string | null;
}

export interface JourneyStep {
  order: number;
  title: string;
  detail: string | null;
}

export type ProductKind = 'robot' | 'accessory' | 'software';
export type ProductBadge = 'new' | 'hot' | 'none';

export interface Product {
  kind: ProductKind;
  model: string;
  slug: string;
  /** Slug of a ProductLine. Required when kind is "robot", null otherwise. */
  line: string | null;
  /** Slugs of Industry. */
  industries: string[];
  /** Slugs of Product. */
  related: string[];
  /** Slugs of Product (the robots an accessory or software works with). */
  compatible_with: string[];
  summary: string | null;
  /** Markdown. */
  description: string | null;
  /** Shows the designer's "TÊN MODEL TẠM" badge. Independent of spec_pending. */
  name_provisional: boolean;
  /** Shows the "CHỜ HỒ SƠ KỸ THUẬT" badge. Independent of name_provisional. */
  spec_pending: boolean;
  featured: boolean;
  badge: ProductBadge;
  video_url: string | null;
  gallery: MediaRef[];
  documents: MediaRef[];
  specs: Spec[];
  seo: Seo | null;
}

export interface ProductLine {
  name: string;
  slug: string;
  summary: string | null;
  order: number;
}

export interface Industry {
  name: string;
  slug: string;
  order: number;
  tagline: string | null;
  /** Markdown. */
  problem: string | null;
  hero_image: MediaRef | null;
  journey: JourneyStep[];
  seo: Seo | null;
}

export type ShowroomStatus = 'open' | 'fitting_out' | 'planned';

export interface Showroom {
  city: string;
  name: string;
  slug: string;
  status: ShowroomStatus;
  /** Null until the project owner confirms it; the page then hides the address block. */
  address: string | null;
  hours: string | null;
  /** True once address and hours are confirmed for display (screen 07's caveat). */
  published: boolean;
  gallery: MediaRef[];
}

/** Every field may be empty and the site renders correctly when it is. */
export interface SiteSettings {
  brand_name: string | null;
  tagline: string | null;
  hero_headline: string | null;
  hero_sub: string | null;
  phone: string | null;
  zalo: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  legal_entity: string | null;
  /** Where leads are mailed. Reaches the Worker through the build's _site/settings.json. */
  lead_notify_email: string | null;
  /** The "BẢN MẪU THIẾT KẾ" band. */
  show_demo_banner: boolean;
  logo: MediaRef | null;
  mark: MediaRef | null;
  share_image: MediaRef | null;
  favicon: MediaRef | null;
  seo: Seo | null;
}

/** What the adapter hands the templates, per locale. */
export interface Content {
  locale: Locale;
  siteSettings: SiteSettings;
  productLines: ProductLine[];
  products: Product[];
  industries: Industry[];
  showrooms: Showroom[];
}
