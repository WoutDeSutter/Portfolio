import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { site } from '../content/content';
import { useSceneSupport } from '../hooks/useSceneSupport';
import type { CameraHeading } from '../scene/interactive';
import { useTranslation } from '../i18n/useTranslation';
import { CvButton } from './CvButton';
import { FloorPlan } from './FloorPlan';
import { LanguageSwitch } from './LanguageSwitch';
import { SceneLayer } from './SceneLayer';
import './Shell.css';

/**
 * The frame around every station: identity, language, CV, floor plan.
 * <Outlet /> is where React Router renders the current route's view.
 */
export function Shell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const showScene = useSceneSupport();
  // "Lifted" state: the scene reports where its camera goes, the floor plan shows it.
  const [cameraHeading, setCameraHeading] = useState<CameraHeading | null>(null);

  // After navigating, start at the top and move focus to the new page's heading, so screen
  // readers announce the page ("Work, heading level 1") and Tab continues from there.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const heading = mainRef.current?.querySelector<HTMLElement>('h1[tabindex="-1"]');
    (heading ?? mainRef.current)?.focus({ preventScroll: true });
  }, [pathname]);

  // A normal href="#main" would be read as a route by HashRouter, so focus the element directly.
  const skipToContent = (event: React.MouseEvent) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className={showScene ? 'shell shell--scene' : 'shell'}>
      {showScene && <SceneLayer onHeadingChange={setCameraHeading} />}

      <a className="skip-link" href="#main" onClick={skipToContent}>
        {t('common.skipToContent')}
      </a>

      <header className="shell__header">
        <Link to="/" className="shell__identity">
          <span className="shell__name">{site.name}</span>{' '}
          <span className="label">{t('meta.role')}</span>
        </Link>
        <div className="shell__actions">
          <LanguageSwitch />
          <CvButton />
        </div>
      </header>

      <main id="main" className="shell__main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>

      <aside className="shell__plan">
        <FloorPlan cameraHeading={showScene ? cameraHeading : null} />
      </aside>
    </div>
  );
}
