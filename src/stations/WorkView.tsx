import { ProjectRow } from '../components/ProjectRow';
import { getProjectsByKind } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';
import { StationHeader } from './StationHeader';

export function WorkView() {
  const { t } = useTranslation();
  const featured = getProjectsByKind('featured');
  const others = getProjectsByKind('project');

  return (
    <div className="station">
      <StationHeader id="work" />

      {featured.length > 0 && (
        <section className="station__section" aria-labelledby="work-featured">
          <h2 id="work-featured" className="label">
            {t('work.featured')}
          </h2>
          {featured.map((project) => (
            <ProjectRow key={project.slug} project={project} size="large" />
          ))}
        </section>
      )}

      {others.length > 0 && (
        <section className="station__section" aria-labelledby="work-more">
          <h2 id="work-more" className="label">
            {t('work.more')}
          </h2>
          {others.map((project) => (
            <ProjectRow key={project.slug} project={project} size="compact" />
          ))}
        </section>
      )}
    </div>
  );
}
