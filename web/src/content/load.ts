import type { Content, Industry, Product, ProductLine, Showroom, SiteSettings } from './types';
import products from '../../../content/seed/vi/products.json';
import productLines from '../../../content/seed/vi/product-lines.json';
import industries from '../../../content/seed/vi/industries.json';
import showrooms from '../../../content/seed/vi/showrooms.json';
import siteSettings from '../../../content/seed/vi/site-settings.json';
import { fetchContent } from './strapi';

/**
 * The only file that knows where content comes from, and the only place the switch is read.
 *
 * `CONTENT_SOURCE` picks the feed: unset or `seed` (the default) reads the committed seed JSON, so a
 * build needs no Strapi; `strapi` reads the running CMS through the adapter in `strapi.ts`.
 * `STRAPI_URL` (default http://127.0.0.1:1337), `STRAPI_TOKEN` (a read-only API token) and the
 * optional `STRAPI_PUBLIC_URL` (prefix for relative media paths) configure the second.
 * Asking for `strapi` and not reaching it fails the build: it never falls back to the seed
 * on its own, because that would publish stale content without anyone noticing.
 * The seed JSON is checked against types.ts by `pnpm --filter content check`, so its casts are safe.
 * Top-level await keeps `getContent()` synchronous, so no page or template changes.
 */
const env = (k: string): string | undefined => (import.meta as any).env?.[k] ?? process.env[k];

function fromSeed(): Content {
  return {
    locale: 'vi',
    siteSettings: siteSettings as unknown as SiteSettings,
    productLines: [...(productLines as unknown as ProductLine[])].sort((a, b) => a.order - b.order),
    products: products as unknown as Product[],
    industries: [...(industries as unknown as Industry[])].sort((a, b) => a.order - b.order),
    showrooms: showrooms as unknown as Showroom[],
  };
}

const source = env('CONTENT_SOURCE') ?? 'seed';
if (source !== 'seed' && source !== 'strapi') throw new Error(`CONTENT_SOURCE must be "seed" or "strapi", got "${source}"`);

const content: Content =
  source === 'strapi'
    ? await fetchContent({
        url: env('STRAPI_URL') ?? 'http://127.0.0.1:1337',
        token: env('STRAPI_TOKEN') ?? null,
        locale: 'vi',
        publicUrl: env('STRAPI_PUBLIC_URL'),
      })
    : fromSeed();

export function getContent(): Content {
  return content;
}

export function lineOf(c: Content, p: Product): ProductLine | undefined {
  return p.line ? c.productLines.find((l) => l.slug === p.line) : undefined;
}

export function productBySlug(c: Content, slug: string): Product | undefined {
  return c.products.find((p) => p.slug === slug);
}

/** Group label used by the sidebar, breadcrumb and kicker: the line for a robot, the kind otherwise. */
export function groupOf(c: Content, p: Product): { id: string; label: string } {
  const line = lineOf(c, p);
  return line ? { id: `line:${line.slug}`, label: line.name } : { id: `kind:${p.kind}`, label: '' };
}
