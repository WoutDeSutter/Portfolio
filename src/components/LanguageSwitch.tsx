import { useTranslation } from '../i18n/useTranslation';

export function LanguageSwitch() {
  const { t, language, setLanguage } = useTranslation();
  const other = language === 'en' ? 'nl' : 'en';

  // The accessible name starts with the visible text ("EN (English)"), so voice control
  // ("click EN") works. `lang` makes screen readers pronounce it in that language.
  return (
    <button type="button" className="header-action" onClick={() => setLanguage(other)} lang={other}>
      <span className="label">{other.toUpperCase()}</span>
      <span className="visually-hidden"> ({t('common.languageSwitch')})</span>
    </button>
  );
}
