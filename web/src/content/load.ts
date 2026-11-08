import type { Content, Industry, Product, ProductLine, Showroom, SiteSettings } from './types';
import products from '../../../content/seed/vi/products.json';
import productLines from '../../../content/seed/vi/product-lines.json';
import industries from '../../../content/seed/vi/industries.json';
import showrooms from '../../../content/seed/vi/showrooms.json';
import siteSettings from '../../../content/seed/vi/site-settings.json';

/**
 * The only file that knows where content comes from. Today: the seed JSON, read at build time.
 * P5 replaces the body with the Strapi adapter; its return type stays `Content`, so no template changes.
 * The JSON files are checked against types.ts by `pnpm --filter content check`, so the casts are safe.
 */
const content: Content = {
  locale: 'vi',
  siteSettings: siteSettings as unknown as SiteSettings,
  productLines: [...(productLines as unknown as ProductLine[])].sort((a, b) => a.order - b.order),
  products: products as unknown as Product[],
  industries: [...(industries as unknown as Industry[])].sort((a, b) => a.order - b.order),
  showrooms: showrooms as unknown as Showroom[],
};

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
