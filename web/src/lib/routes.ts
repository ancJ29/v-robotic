/** Every URL the site links to, built here once. Shapes come from docs/architecture.md (Routes); the slug ledger depends on them. */
export const routes = {
  home: '/',
  products: '/san-pham',
  product: (slug: string) => `/san-pham/${slug}`,
  solutions: '/giai-phap',
  solution: (slug: string) => `/giai-phap/${slug}`,
  services: '/dich-vu',
  ai: '/cong-nghe-ai',
  showroom: '/showroom',
  visit: '/showroom/dat-lich',
  partners: '/hop-tac',
  about: '/ve-chung-toi',
  contact: '/lien-he',
} as const;
