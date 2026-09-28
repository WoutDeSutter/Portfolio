import { ProjectRow } from '../components/ProjectRow';
import { getProjectsByKind } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';
import { StationHeader } from './StationHeader';

export function LabView() {
  const { t } = useTranslation();
  const experiments = getProjectsByKind('lab');

  return (
    <div className="station">
      <StationHeader id="lab" intro={t('lab.intro')} />

      <section className="station__section">
        {experiments.length > 0 ? (
          <div className="lab__grid">
            {experiments.map((project) => (
              <ProjectRow key={project.slug} project={project} size="compact" />
            ))}
          </div>
        ) : (
          <p className="station__empty">{t('lab.empty')}</p>
        )}
      </section>
    </div>
  );
}
