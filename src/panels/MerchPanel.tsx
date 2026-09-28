import { Panel } from '../components/Panel';
import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';

/** The Merch stand: take the CV home. */
export function MerchPanel() {
  const { t } = useTranslation();

  return (
    <Panel title={t('places.merch')}>
      <p className="panel-intro">{t('merch.intro')}</p>
      {site.cv.file ? (
        <a className="button button--accent" href={site.cv.file} download>
          {t('cv.download')}
        </a>
      ) : (
        <p className="panel-empty">{t('cv.unavailable')}</p>
      )}
    </Panel>
  );
}
