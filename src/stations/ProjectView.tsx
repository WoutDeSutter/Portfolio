import { Link, useParams } from 'react-router';
import { ProjectMedia } from '../components/ProjectMedia';
import { StatusTag } from '../components/StatusTag';
import { TechList } from '../components/TechList';
import { getProject } from '../content/content';
import { PROJECT_SECTIONS } from '../content/types';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../i18n/useTranslation';
import './ProjectView.css';

export function ProjectView() {
  const { t, tOptional } = useTranslation();
  // useParams reads the `:slug` part of the route /projects/:slug.
  const { slug = '' } = useParams();
  const project = getProject(slug);
  const title = project ? t(`projects.${slug}.title`) : t('project.notFound');
  useDocumentTitle(title);

  if (!project) {
    return (
      <div className="station">
        <p className="station__empty">{t('project.notFound')}</p>
        <Link to="/work" className="project__back label">
          ← {t('project.back')}
        </Link>
      </div>
    );
  }

  const isLab = project.kind === 'lab';
  const sections = PROJECT_SECTIONS.map((id) => ({
    id,
    text: tOptional(`projects.${slug}.sections.${id}`),
  })).filter((section) => section.text);

  return (
    <article className="station project">
      <Link to={isLab ? '/lab' : '/work'} className="project__back label">
        ← {t(isLab ? 'project.backToLab' : 'project.back')}
      </Link>

      <header className="station__header">
        <div className="project__meta">
          <StatusTag status={project.status} />
          {project.year && <span className="label">{project.year}</span>}
        </div>
        <h1 className="station__title">{title}</h1>
        <p className="station__intro">{t(`projects.${slug}.summary`)}</p>
      </header>

      <ProjectMedia items={project.media} />

      {sections.map((section) => (
        <section key={section.id} className="project__section">
          <h2 className="label">{t(`project.sections.${section.id}`)}</h2>
          <p>{section.text}</p>
        </section>
      ))}

      {project.technologies.length > 0 && (
        <section className="project__section">
          <h2 className="label">{t('project.technologies')}</h2>
          <TechList ids={project.technologies} />
        </section>
      )}

      {project.links.length > 0 && (
        <section className="project__section">
          <h2 className="label">{t('project.links')}</h2>
          <ul className="project__links" role="list">
            {project.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {t(`project.linkTypes.${link.type}`)} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
