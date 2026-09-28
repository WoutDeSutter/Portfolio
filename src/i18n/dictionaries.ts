import en from '../data/i18n/en.json';
import nl from '../data/i18n/nl.json';

export type Language = 'en' | 'nl';

export const dictionaries: Record<Language, unknown> = { en, nl };

export const FALLBACK_LANGUAGE: Language = 'en';

const STORAGE_KEY = 'language';

/** Stored choice first, then the browser language, then English. */
export function detectLanguage(): Language {
  const stored = readStoredLanguage();
  if (stored) return stored;

  const preferred = navigator.languages ?? [navigator.language];
  const match = preferred.find((lang) => lang.toLowerCase().startsWith('nl'));
  return match ? 'nl' : FALLBACK_LANGUAGE;
}

export function storeLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this visit only.
  }
}

function readStoredLanguage(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'en' || value === 'nl' ? value : null;
  } catch {
    return null;
  }
}

/** Looks up a dot-separated key such as `projects.tagrun.title`. */
export function lookup(dictionary: unknown, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Development check: nl.json and en.json must contain the same keys. */
export function warnOnMismatchedKeys(): void {
  const enKeys = new Set(collectKeys(en));
  const nlKeys = new Set(collectKeys(nl));
  const missingInNl = [...enKeys].filter((key) => !nlKeys.has(key));
  const missingInEn = [...nlKeys].filter((key) => !enKeys.has(key));
  if (missingInNl.length) console.warn('[i18n] Missing in nl.json:', missingInNl);
  if (missingInEn.length) console.warn('[i18n] Missing in en.json:', missingInEn);
}

function collectKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}
