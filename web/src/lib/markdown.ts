/**
 * Markdown for CMS fields on pages that need headings and emphasis (an industry's problem statement).
 * Handles: `##`/`###` headings, paragraphs, `-` bullet lists, inline **bold** and *italic*.
 * Returns data, never HTML: templates render text nodes, so CMS text cannot inject markup.
 * `lib/text.ts#parseBlocks` stays the lighter parser for product descriptions.
 */
export type Inline = { kind: 'text' | 'strong' | 'em'; text: string };
export type MdBlock =
  | { type: 'h'; level: 3 | 4; inline: Inline[] }
  | { type: 'p'; inline: Inline[] }
  | { type: 'ul'; items: Inline[][] };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ kind: 'text', text: s.slice(last, m.index) });
    out.push(m[1] !== undefined ? { kind: 'strong', text: m[1] } : { kind: 'em', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ kind: 'text', text: s.slice(last) });
  return out;
}

/** Headings are shifted below the page's own h2: `##` becomes an h3, `###` an h4. */
export function parseMarkdown(md: string | null): MdBlock[] {
  if (!md) return [];
  const blocks: MdBlock[] = [];
  for (const chunk of md.split(/\n{2,}/)) {
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => { if (para.length) blocks.push({ type: 'p', inline: parseInline(para.join(' ')) }); para = []; };
    const flushList = () => { if (list.length) blocks.push({ type: 'ul', items: list.map(parseInline) }); list = []; };
    for (const raw of chunk.split('\n')) {
      const l = raw.trim();
      if (!l) continue;
      const h = /^(#{1,4})\s+(.*)$/.exec(l);
      if (h) { flushPara(); flushList(); blocks.push({ type: 'h', level: h[1].length <= 2 ? 3 : 4, inline: parseInline(h[2]) }); }
      else if (/^[-*]\s+/.test(l)) { flushPara(); list.push(l.replace(/^[-*]\s+/, '')); }
      else { flushList(); para.push(l); }
    }
    flushPara(); flushList();
  }
  return blocks;
}
