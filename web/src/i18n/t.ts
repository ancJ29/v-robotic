import vi from './vi.json';
import type { Locale } from '../content/types';

/** Every UI string the templates print goes through here, so P8 adds `en.json` and nothing else. */
const dictionaries: Record<Locale, Record<string, string>> = { vi, en: vi /* P8 fills en.json */ };

export const defaultLocale: Locale = 'vi';

export type MessageKey = keyof typeof vi;

export function t(key: MessageKey, vars: Record<string, string | number> = {}, locale: Locale = defaultLocale): string {
  const text = dictionaries[locale][key] ?? vi[key];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
