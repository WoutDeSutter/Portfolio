import { useEffect, useState } from 'react';
import { site } from '../content/content';
import { useTextVersion } from '../festival/TextVersionContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTranslation } from '../i18n/useTranslation';
import './Overview.css';

const HINT_DURATION = 9000;

/**
 * The overview of the terrain (no panel open). In 3D: only a short hint that fades once the
 * visitor starts looking around. Without WebGL: a short introduction for the text version.
 */
export function Overview() {
  const { t } = useTranslation();
  const textVersion = useTextVersion();
  const isTouch = useMediaQuery('(pointer: coarse)');
  const [showHint, setShowHint] = useState(true);
  useDocumentTitle(t('meta.role'));

  // No focus handling here: when a panel closes, Festival returns focus to that place's hotspot.
  useEffect(() => {
    const hide = () => setShowHint(false);
    const timer = setTimeout(hide, HINT_DURATION);
    window.addEventListener('pointerdown', hide, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', hide);
    };
  }, []);

  if (textVersion) {
    return (
      <section className="panel" aria-labelledby="overview-title">
        <h1 id="overview-title" className="panel__title">
          {site.name}
        </h1>
        <p className="panel-intro">{t('meta.role')}</p>
        <p>{t('fallback.intro')}</p>
      </section>
    );
  }

  return (
    <>
      {/* Name and role are painted in the world; this heading is for screen readers and search engines. */}
      <h1 className="visually-hidden">
        {site.name} — {t('meta.role')}
      </h1>
      <p className={showHint ? 'hint label' : 'hint hint--hidden label'} aria-hidden="true">
        {t(isTouch ? 'hint.touch' : 'hint.pointer')}
      </p>
    </>
  );
}
