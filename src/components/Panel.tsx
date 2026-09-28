import { useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { NO_FRAME, PanelFrameContext } from '../festival/PanelFrameContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../i18n/useTranslation';
import './Panel.css';

type PanelProps = {
  title: string;
  /** Where "back" and Esc go; defaults to the overview of the terrain. */
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
};

/**
 * The content of an open place, next to (desktop) or below (phone) the world.
 * Its heading receives focus when it opens, Esc closes it, and it reports its size
 * so the world keeps the place visible beside it.
 */
export function Panel({ title, backTo = '/', backLabel, children }: PanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const setFrame = useContext(PanelFrameContext);
  useDocumentTitle(title);

  // Move focus to the heading when the panel opens, so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate(backTo);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, backTo]);

  // useLayoutEffect measures after layout but before paint, so the world reframes without a jump.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const report = () => {
      const docked = getComputedStyle(panel).position === 'fixed';
      if (!docked) return setFrame(NO_FRAME);
      // offsetLeft/offsetTop give the resting position; getBoundingClientRect would include
      // the slide-in animation and measure the panel while it is still off-screen.
      if (panel.offsetLeft > window.innerWidth * 0.3) {
        setFrame({ right: window.innerWidth - panel.offsetLeft, bottom: 0 });
      } else {
        setFrame({ right: 0, bottom: window.innerHeight - panel.offsetTop });
      }
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(panel);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      setFrame(NO_FRAME);
    };
  }, [setFrame]);

  return (
    <section ref={panelRef} className="panel" aria-labelledby="panel-title">
      <Link to={backTo} className="panel__back label">
        <span aria-hidden="true">← </span>
        {backLabel ?? t('panel.back')}
      </Link>
      <h1 id="panel-title" ref={headingRef} className="panel__title" tabIndex={-1}>
        {title}
      </h1>
      <div className="panel__content">{children}</div>
    </section>
  );
}
