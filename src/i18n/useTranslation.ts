import { useContext } from 'react';
import { dictionaries, FALLBACK_LANGUAGE, lookup } from './dictionaries';
import { LanguageContext } from './LanguageContext';

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used inside <LanguageProvider>');

  const { language, setLanguage } = context;

  /** Optional text: returns undefined when the key does not exist in either language. */
  const tOptional = (key: string): string | undefined =>
    lookup(dictionaries[language], key) ?? lookup(dictionaries[FALLBACK_LANGUAGE], key);

  /** Required text: falls back to the key itself so missing text is visible during development. */
  const t = (key: string): string => {
    const value = tOptional(key);
    if (value === undefined && import.meta.env.DEV) console.warn(`[i18n] Missing key: ${key}`);
    return value ?? key;
  };

  return { t, tOptional, language, setLanguage };
}
