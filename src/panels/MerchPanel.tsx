import { Panel } from '../components/Panel';
import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';
import { assetUrl } from '../utils/assetUrl';

/** The Merch stand: take the CV home. */
export function MerchPanel() {
  const { t } = useTranslation();

  return (
    <Panel title={t('places.merch')}>
      <p className="panel-intro">{t('merch.intro')}</p>
      {site.cv.file ? (
        // assetUrl adds the file's content hash, so a replaced CV is never served from an old cache;
        // the download attribute keeps the plain file name when saving.
        <a className="button button--accent" href={assetUrl(site.cv.file)} download={site.cv.file.split('/').pop()}>
          {t('cv.download')}
        </a>
      ) : (
        <p className="panel-empty">{t('cv.unavailable')}</p>
      )}
    </Panel>
  );
}
