import { Panel } from '../components/Panel';
import { useTranslation } from '../i18n/useTranslation';

/** The FOH tent. Music and light control (the easter egg) follow in a later step. */
export function FohPanel() {
  const { t } = useTranslation();
  return (
    <Panel title={t('places.foh')}>
      <p className="panel-intro">{t('foh.intro')}</p>
    </Panel>
  );
}
