import { Link } from 'react-router';
import { getNeighbours } from '../content/content';
import type { Project } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';

/** Previous / next project, so visitors can keep exploring without going back to the list. */
export function ProjectPager({ project }: { project: Project }) {
  const { t } = useTranslation();
  const { previous, next } = getNeighbours(project);
  if (!previous && !next) return null;

  return (
    <nav className="project-pager" aria-label={t('project.pager')}>
      {previous ? (
        <Link to={`/projects/${previous.slug}`} className="project-pager__link" rel="prev">
          <span className="label">← {t('project.previous')}</span>
          <span>{t(`projects.${previous.slug}.title`)}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          to={`/projects/${next.slug}`}
          className="project-pager__link project-pager__link--next"
          rel="next"
        >
          <span className="label">{t('project.next')} →</span>
          <span>{t(`projects.${next.slug}.title`)}</span>
        </Link>
      )}
    </nav>
  );
}
