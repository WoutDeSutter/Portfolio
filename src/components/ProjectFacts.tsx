import type { Project } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';
import { StatusTag } from './StatusTag';
import { TechList } from './TechList';

/** Key facts a recruiter scans first. Rows without data are left out. */
export function ProjectFacts({ project }: { project: Project }) {
  const { t } = useTranslation();

  return (
    <dl className="project-facts">
      <div className="project-facts__row">
        <dt className="label">{t('project.statusLabel')}</dt>
        <dd>
          <StatusTag status={project.status} />
        </dd>
      </div>
      {project.year && (
        <div className="project-facts__row">
          <dt className="label">{t('project.year')}</dt>
          <dd>{project.year}</dd>
        </div>
      )}
      {project.technologies.length > 0 && (
        <div className="project-facts__row">
          <dt className="label">{t('project.technologies')}</dt>
          <dd>
            <TechList ids={project.technologies} />
          </dd>
        </div>
      )}
    </dl>
  );
}
