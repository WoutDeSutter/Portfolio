import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useTranslation } from '../i18n/useTranslation';
import type { HoverInfo } from '../scene/interactive';
import type { StageScene } from '../scene/StageScene';
import { getStationForPath } from '../stations/stations';
import './SceneLayer.css';

/**
 * The 3D stage behind the content. The URL decides where the camera is:
 * this component only forwards route changes to the scene.
 */
export function SceneLayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StageScene | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const stationId = getStationForPath(useLocation().pathname).id;

  // Lets the loading effect read the latest station without re-running on every navigation.
  const stationIdRef = useRef(stationId);
  useEffect(() => {
    stationIdRef.current = stationId;
    sceneRef.current?.goTo(stationId);
  }, [stationId]);

  useEffect(() => {
    let cancelled = false;

    // Dynamic import: Three.js is downloaded as a separate file, only when the 3D stage is used.
    import('../scene/StageScene')
      .then(({ createStageScene }) => {
        if (cancelled || !containerRef.current) return;
        sceneRef.current = createStageScene(containerRef.current, {
          initialStation: stationIdRef.current,
          reducedMotion,
          onNavigate: (path) => navigate(path),
          onHover: setHover,
        });
        setIsReady(true);
      })
      .catch((error: unknown) => {
        // The DOM layer works on its own, so a failing 3D stage only costs the enhancement.
        console.error('[scene] Could not start the 3D stage:', error);
      });

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setIsReady(false);
      setHover(null);
    };
  }, [reducedMotion, navigate]);

  return (
    <>
      <div
        ref={containerRef}
        className={isReady ? 'scene-layer scene-layer--ready' : 'scene-layer'}
        aria-hidden="true"
      />
      {/* Contextual label next to the cursor; the same destinations are links in the page itself. */}
      {hover && (
        <div
          className="scene-label label"
          aria-hidden="true"
          style={{ transform: `translate(${hover.clientX}px, ${hover.clientY}px)` }}
        >
          {t(hover.labelKey)}
        </div>
      )}
    </>
  );
}
