import { useState } from 'react';
import type { ProjectDemo as Demo } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';
import { ExternalLink } from './ExternalLink';

type ProjectDemoProps = {
  demo: Demo;
  title: string;
};

/**
 * Optional interactive demo. Nothing is loaded until the visitor asks for it, so a heavy
 * WebGL/WebXR demo never slows down the rest of the project page.
 */
export function ProjectDemo({ demo, title }: ProjectDemoProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (!demo.enabled) return null;

  const externalLink = (
    <ExternalLink href={demo.url} className="project-demo__link">
      {t('project.demo.openExternal')}
    </ExternalLink>
  );

  return (
    <section className="project__section project-demo" aria-labelledby="project-demo">
      <h2 id="project-demo" className="label">
        {t('project.demo.heading')}
      </h2>

      {demo.type === 'external' ? (
        externalLink
      ) : isOpen ? (
        <>
          <iframe
            className="project-demo__frame"
            src={demo.url}
            title={`${t('project.demo.heading')}: ${title}`}
            allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
            loading="lazy"
          />
          <div className="project-demo__actions">
            <button type="button" className="header-action" onClick={() => setIsOpen(false)}>
              <span className="label">{t('project.demo.close')}</span>
            </button>
            {externalLink}
          </div>
        </>
      ) : (
        <>
          <p className="project-demo__notice">{t('project.demo.notice')}</p>
          <div className="project-demo__actions">
            <button
              type="button"
              className="header-action header-action--accent"
              onClick={() => setIsOpen(true)}
            >
              <span className="label">{t('project.demo.load')}</span>
            </button>
            {externalLink}
          </div>
        </>
      )}
    </section>
  );
}
