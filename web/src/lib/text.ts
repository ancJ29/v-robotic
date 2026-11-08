/** Lower-case and strip Vietnamese diacritics so "robot le tan" finds "Robot lễ tân". Used to build the catalog's search text. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

/** Minimal Markdown for CMS descriptions: paragraphs and "- " bullet lists. Returns blocks the template renders as text (no raw HTML). */
export type Block = { type: 'p'; text: string } | { type: 'ul'; items: string[] };
export function parseBlocks(md: string | null): Block[] {
  if (!md) return [];
  const blocks: Block[] = [];
  for (const chunk of md.split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => { if (para.length) blocks.push({ type: 'p', text: para.join(' ') }); para = []; };
    const flushList = () => { if (list.length) blocks.push({ type: 'ul', items: list }); list = []; };
    for (const l of lines) {
      if (/^[-*]\s+/.test(l)) { flushPara(); list.push(l.replace(/^[-*]\s+/, '')); }
      else { flushList(); para.push(l); }
    }
    flushPara(); flushList();
  }
  return blocks;
}
