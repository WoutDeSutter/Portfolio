import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';
import { CvButton } from './CvButton';
import { FloorPlan } from './FloorPlan';
import { LanguageSwitch } from './LanguageSwitch';
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

  // After navigating, start at the top and move keyboard/screen-reader focus to the new content.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  // A normal href="#main" would be read as a route by HashRouter, so focus the element directly.
  const skipToContent = (event: React.MouseEvent) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={skipToContent}>
        {t('common.skipToContent')}
      </a>

      <header className="shell__header">
        <Link to="/" className="shell__identity">
          <span className="shell__name">{site.name}</span>
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
        <FloorPlan />
      </aside>
    </div>
  );
}
