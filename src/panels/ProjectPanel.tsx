import { useParams } from 'react-router';
import { ExternalLink } from '../components/ExternalLink';
import { Panel } from '../components/Panel';
import { ProjectDemo } from '../components/ProjectDemo';
import { ProjectFacts } from '../components/ProjectFacts';
import { MediaFigure, ProjectGallery } from '../components/ProjectMedia';
import { ProjectPager } from '../components/ProjectPager';
import { ProjectSections } from '../components/ProjectSections';
import { getProject } from '../content/content';
import { useDocumentDescription } from '../hooks/useDocumentDescription';
import { useTranslation } from '../i18n/useTranslation';
import './ProjectPanel.css';

/**
 * A project case study, opened at the Projects (or Lab) booth. Every part is optional
 * except title and summary, so small projects stay short and featured ones can grow.
 */
export function ProjectPanel() {
  const { t } = useTranslation();
  // useParams reads the `:slug` part of the route /projects/:slug.
  const { slug = '' } = useParams();
  const project = getProject(slug);
  const title = project ? t(`projects.${slug}.title`) : t('project.notFound');
  const summary = project ? t(`projects.${slug}.summary`) : '';
  useDocumentDescription(summary || title);

  if (!project) {
    return (
      <Panel title={title} backTo="/projects" backLabel={t('project.back')}>
        {null}
      </Panel>
    );
  }

  const isLab = project.kind === 'lab';
  // The first image or video is the hero; everything else goes into the gallery.
  const [hero, ...gallery] = project.media.filter((item) => item.type !== 'model');

  return (
    <Panel
      title={title}
      backTo={isLab ? '/lab' : '/projects'}
      backLabel={t(isLab ? 'project.backToLab' : 'project.back')}
    >
      {/* `key` resets the content (e.g. an open demo) when moving to another project. */}
      <div key={slug} className="project">
        <p className="panel-intro">{summary}</p>
        <ProjectFacts project={project} />
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
                  <ExternalLink href={link.url}>{t(`project.linkTypes.${link.type}`)}</ExternalLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ProjectPager project={project} />
      </div>
    </Panel>
  );
}
