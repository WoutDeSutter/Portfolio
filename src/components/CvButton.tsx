import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';

export function CvButton() {
  const { t } = useTranslation();

  if (!site.cv.file) {
    return <span className="header-action header-action--disabled label">{t('cv.unavailable')}</span>;
  }

  return (
    <a className="header-action header-action--accent" href={site.cv.file} download>
      <span className="label">{t('cv.download')}</span>
    </a>
  );
}
