import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { site } from '../content/content';
import { OPENABLE_PLACES, getPlaceForPath, type PlaceId } from '../festival/places';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useTranslation } from '../i18n/useTranslation';
import { whenIdle } from '../utils/whenIdle';
import type { FestivalWorld, HoverInfo, WorldLabels } from '../world/world';
import './WorldLayer.css';

type WorldLayerProps = {
  /** Pixels covered by the open panel, so the world can keep the place beside it. */
  frame: { right: number; bottom: number };
};

/**
 * The 3D festival, filling the screen behind everything. The URL decides where the camera
 * is: this component forwards route changes, labels and panel size to the world.
 */
export function WorldLayer({ frame }: WorldLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<FestivalWorld | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const placeId = getPlaceForPath(useLocation().pathname).id;

  const labels: WorldLabels = {
    places: Object.fromEntries(OPENABLE_PLACES.map((place) => [place.id, t(`places.${place.id}`)])) as Record<
      PlaceId,
      string
    >,
    name: site.name,
    role: t('meta.role'),
  };

  // Refs let the loading effect read the latest values without restarting the world.
  const latest = useRef({ placeId, labels, frame });
  useEffect(() => {
    latest.current = { placeId, labels, frame };
  });

  useEffect(() => {
    worldRef.current?.goTo(placeId);
  }, [placeId]);

  useEffect(() => {
    worldRef.current?.setLabels(latest.current.labels);
  }, [language]);

  useEffect(() => {
    worldRef.current?.setFrame(frame.right, frame.bottom);
  }, [frame.right, frame.bottom]);

  useEffect(() => {
    let cancelled = false;

    const start = () => {
      performance.mark('world:start');
      // Dynamic import: Three.js is downloaded as a separate file, after the page has shown.
      import('../world/world')
        .then(({ createFestivalWorld }) => {
          if (cancelled || !containerRef.current) return;
          const world = createFestivalWorld(containerRef.current, {
            initialPlace: latest.current.placeId,
            labels: latest.current.labels,
            reducedMotion,
            onNavigate: (path) => navigate(path),
            onHover: setHover,
          });
          world.setFrame(latest.current.frame.right, latest.current.frame.bottom);
          worldRef.current = world;
          return world.ready.then(() => {
            if (cancelled) return;
            performance.measure('world:ready', 'world:start');
            setIsReady(true);
          });
        })
        .catch((error: unknown) => {
          console.error('[world] Could not start the 3D festival:', error);
        });
    };
    const idle = whenIdle(start);

    return () => {
      cancelled = true;
      idle.cancel();
      worldRef.current?.dispose();
      worldRef.current = null;
      setIsReady(false);
      setHover(null);
    };
  }, [reducedMotion, navigate]);

  return (
    <>
      <div
        ref={containerRef}
        className={isReady ? 'world world--ready' : 'world'}
        aria-hidden="true"
      />
      {!isReady && <div className="world__loading label" aria-hidden="true" />}
      {hover && (
        <div
          className="world-label label"
          aria-hidden="true"
          style={{ transform: `translate(${hover.clientX}px, ${hover.clientY}px)` }}
        >
          {t(hover.labelKey)}
        </div>
      )}
    </>
  );
}
