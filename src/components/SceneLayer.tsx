import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useTranslation } from '../i18n/useTranslation';
import type { CameraHeading, HoverInfo } from '../scene/interactive';
import type { StageScene } from '../scene/StageScene';
import { getStationForPath } from '../stations/stations';
import './SceneLayer.css';

type SceneLayerProps = {
  /** Reports where the camera is heading, so the floor plan can show it. */
  onHeadingChange: (heading: CameraHeading) => void;
};

/**
 * The 3D stage behind the content. The URL decides where the camera is:
 * this component only forwards route changes to the scene.
 */
export function SceneLayer({ onHeadingChange }: SceneLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const freeAreaRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StageScene | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { pathname } = useLocation();
  const stationId = getStationForPath(pathname).id;
  const projectSlug = pathname.match(/^\/projects\/([^/]+)/)?.[1];

  // Lets the loading effect read the latest view without re-running on every navigation.
  const viewRef = useRef({ stationId, projectSlug });
  useEffect(() => {
    viewRef.current = { stationId, projectSlug };
    sceneRef.current?.goTo(stationId, projectSlug);
  }, [stationId, projectSlug]);

  // Same trick for the callback, so a new function from the parent doesn't restart the scene.
  const onHeadingChangeRef = useRef(onHeadingChange);
  useEffect(() => {
    onHeadingChangeRef.current = onHeadingChange;
  }, [onHeadingChange]);

  useEffect(() => {
    let cancelled = false;

    // Dynamic import: Three.js is downloaded as a separate file, only when the 3D stage is used.
    import('../scene/StageScene')
      .then(({ createStageScene }) => {
        if (cancelled || !containerRef.current || !freeAreaRef.current) return;
        sceneRef.current = createStageScene(containerRef.current, freeAreaRef.current, {
          initialStation: viewRef.current.stationId,
          initialProject: viewRef.current.projectSlug,
          reducedMotion,
          onNavigate: (path) => navigate(path),
          onHover: setHover,
          onHeadingChange: (heading) => onHeadingChangeRef.current(heading),
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
      >
        {/* Marks the free area right of the text column (positioned in CSS); the scene measures it. */}
        <div ref={freeAreaRef} className="scene-layer__free" />
      </div>
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
