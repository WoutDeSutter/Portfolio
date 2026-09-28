import { Panel } from '../components/Panel';
import { ProjectRow } from '../components/ProjectRow';
import { getProjectsByKind } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';

/** The Projects food truck: featured projects first, then the others. */
export function ProjectsPanel() {
  const { t } = useTranslation();
  const featured = getProjectsByKind('featured');
  const others = getProjectsByKind('project');

  return (
    <Panel title={t('places.projects')}>
      {featured.length > 0 && (
        <section className="panel-section" aria-labelledby="projects-featured">
          <h2 id="projects-featured" className="label">
            {t('work.featured')}
          </h2>
          {featured.map((project) => (
            <ProjectRow key={project.slug} project={project} size="large" />
          ))}
        </section>
      )}
      {others.length > 0 && (
        <section className="panel-section" aria-labelledby="projects-more">
          <h2 id="projects-more" className="label">
            {t('work.more')}
          </h2>
          {others.map((project) => (
            <ProjectRow key={project.slug} project={project} size="compact" />
          ))}
        </section>
      )}
    </Panel>
  );
}
