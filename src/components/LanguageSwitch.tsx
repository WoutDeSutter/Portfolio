import { useTranslation } from '../i18n/useTranslation';

export function LanguageSwitch() {
  const { t, language, setLanguage } = useTranslation();
  const other = language === 'en' ? 'nl' : 'en';

  return (
    <button
      type="button"
      className="header-action"
      onClick={() => setLanguage(other)}
      aria-label={t('common.languageSwitchLabel')}
      lang={other}
    >
      <span className="label">{other.toUpperCase()}</span>
    </button>
  );
}
