import { Panel } from '../components/Panel';
import { ProjectRow } from '../components/ProjectRow';
import { getProjectsByKind } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';

/** The Lab stand: experiments, prototypes and smaller explorations. */
export function LabPanel() {
  const { t } = useTranslation();
  const experiments = getProjectsByKind('lab');

  return (
    <Panel title={t('places.lab')}>
      <p className="panel-intro">{t('lab.intro')}</p>
      {experiments.length > 0 ? (
        <section className="panel-section">
          {experiments.map((project) => (
            <ProjectRow key={project.slug} project={project} size="compact" />
          ))}
        </section>
      ) : (
        <p className="panel-empty">{t('lab.empty')}</p>
      )}
    </Panel>
  );
}
