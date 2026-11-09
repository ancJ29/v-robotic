// Generates the sample placeholder pictures (SVG, no network, no fonts fetched) into web/public/placeholders/
// and points the seed records at them: product.gallery[0], industry.hero_image, showroom.gallery[0].
// Safe to rerun: same input, same bytes. Run: node content/scripts/make-placeholders.mjs
// Replace before launch: delete the files, set those fields back to null / [] (or upload real photographs in Strapi).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const seedDir = path.join(repo, 'content/seed/vi');
const outDir = path.join(repo, 'web/public/placeholders');
const LABEL = 'ẢNH MẪU - chưa phải ảnh thật';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Two lines at most, broken at a space or slash near the middle.
function wrap(name, max) {
  if (name.length <= max) return [name];
  const words = name.split(' ');
  let best = [name, ''], gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    if (Math.abs(a.length - b.length) < gap) { gap = Math.abs(a.length - b.length); best = [a, b]; }
  }
  return best[1] ? best : [name];
}

function svg(name, w, h) {
  const lines = wrap(name, 14);
  const size = Math.round(Math.min(w, h) * (lines.some((l) => l.length > 12) ? 0.085 : 0.1));
  const cy = h / 2 - ((lines.length - 1) * size * 1.2) / 2;
  const text = lines.map((l, i) => `<text x="${w / 2}" y="${cy + i * size * 1.2}" font-size="${size}" font-weight="700" fill="#2b3440">${esc(l)}</text>`).join('\n  ');
  const small = Math.round(size * 0.42);
  const labelY = cy + (lines.length - 1) * size * 1.2 + size * 1.25;
  const top = cy - size * 1.0, bottom = labelY + small * 0.6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(LABEL)}: ${esc(name)}">
  <defs><pattern id="h" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="28" height="28" fill="#e6e9ee"/><rect width="14" height="28" fill="#dde1e7"/></pattern></defs>
  <rect width="${w}" height="${h}" fill="url(#h)"/>
  <rect x="12" y="12" width="${w - 24}" height="${h - 24}" fill="none" stroke="#8a93a1" stroke-width="4" stroke-dasharray="18 12"/>
  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle">
  <rect x="${w * 0.12}" y="${top}" width="${w * 0.76}" height="${bottom - top}" rx="14" fill="#ffffff" fill-opacity="0.88"/>
  ${text}
  <text x="${w / 2}" y="${labelY}" font-size="${small}" font-weight="700" fill="#b3261e">${esc(LABEL)}</text>
  </g>
</svg>
`;
}

const read = (n) => JSON.parse(fs.readFileSync(path.join(seedDir, `${n}.json`), 'utf8'));
const write = (n, d) => fs.writeFileSync(path.join(seedDir, `${n}.json`), JSON.stringify(d, null, 2) + '\n');
const ref = (dir, rec, name, w, h) => {
  fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  fs.writeFileSync(path.join(outDir, dir, `${rec.slug}.svg`), svg(name, w, h));
  return { src: `/placeholders/${dir}/${rec.slug}.svg`, alt: `Ảnh mẫu (chưa phải ảnh thật): ${name}`, width: w, height: h };
};

const products = read('products');
for (const p of products) p.gallery = [ref('products', p, p.model, 800, 600)];
write('products', products);
const industries = read('industries');
for (const i of industries) i.hero_image = ref('industries', i, i.name, 1000, 1000); // used 1:1 and 16:9, so text sits in the middle band
write('industries', industries);
const showrooms = read('showrooms');
for (const s of showrooms) s.gallery = [ref('showrooms', s, s.name, 800, 600)];
write('showrooms', showrooms);
console.log(`placeholders: ${products.length} products, ${industries.length} industries, ${showrooms.length} showrooms`);
