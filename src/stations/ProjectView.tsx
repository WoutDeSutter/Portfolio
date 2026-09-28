import { Link, useParams } from 'react-router';
import { ProjectDemo } from '../components/ProjectDemo';
import { ProjectFacts } from '../components/ProjectFacts';
import { MediaFigure, ProjectGallery } from '../components/ProjectMedia';
import { ProjectPager } from '../components/ProjectPager';
import { ProjectSections } from '../components/ProjectSections';
import { getProject } from '../content/content';
import { useDocumentDescription } from '../hooks/useDocumentDescription';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../i18n/useTranslation';
import './ProjectView.css';

/**
 * A project case study. Every part is optional except title and summary,
 * so small projects stay short and featured ones can grow.
 */
export function ProjectView() {
  const { t } = useTranslation();
  // useParams reads the `:slug` part of the route /projects/:slug.
  const { slug = '' } = useParams();
  const project = getProject(slug);
  const title = project ? t(`projects.${slug}.title`) : t('project.notFound');
  const summary = project ? t(`projects.${slug}.summary`) : '';
  useDocumentTitle(title);
  useDocumentDescription(summary || title);

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
  // The first image or video is the hero; everything else goes into the gallery.
  const [hero, ...gallery] = project.media.filter((item) => item.type !== 'model');

  return (
    // `key` resets the page (e.g. an open demo) when moving to another project.
    <article key={slug} className="station project">
      <Link to={isLab ? '/lab' : '/work'} className="project__back label">
        ← {t(isLab ? 'project.backToLab' : 'project.back')}
      </Link>

      <header className="station__header">
        <h1 className="station__title">{title}</h1>
        <p className="station__intro">{summary}</p>
        <ProjectFacts project={project} />
      </header>

      {hero && <MediaFigure item={hero} eager />}

      <ProjectSections slug={slug} />
      <ProjectDemo demo={project.demo} title={title} />
      <ProjectGallery items={gallery} />

      {project.links.length > 0 && (
        <section className="project__section" aria-labelledby="project-links">
          <h2 id="project-links" className="label">
            {t('project.links')}
          </h2>
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

      <ProjectPager project={project} />
    </article>
  );
}
