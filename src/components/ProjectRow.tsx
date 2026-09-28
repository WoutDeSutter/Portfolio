import { Link } from 'react-router';
import type { Project } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';
import { StatusTag } from './StatusTag';
import { TechList } from './TechList';
import './ProjectRow.css';

type ProjectRowProps = {
  project: Project;
  /** Featured projects get a large presentation, others a compact one. */
  size: 'large' | 'compact';
};

export function ProjectRow({ project, size }: ProjectRowProps) {
  const { t } = useTranslation();
  const hero = project.media.find((item) => item.type === 'image');

  return (
    <article className={`project-row project-row--${size}`}>
      <Link to={`/projects/${project.slug}`} className="project-row__link">
        {size === 'large' && hero && (
          <img className="project-row__hero" src={hero.src} alt={t(hero.altKey)} loading="lazy" />
        )}
        <div className="project-row__body">
          <div className="project-row__meta">
            <StatusTag status={project.status} />
            {project.year && <span className="label">{project.year}</span>}
          </div>
          <h3 className="project-row__title">
            {t(`projects.${project.slug}.title`)}
            <span className="project-row__arrow" aria-hidden="true">
              →
            </span>
          </h3>
          <p className="project-row__summary">{t(`projects.${project.slug}.summary`)}</p>
          <TechList ids={project.technologies} />
        </div>
      </Link>
    </article>
  );
}
