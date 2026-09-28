import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useReducedMotion } from '../hooks/useMediaQuery';
import type { StageScene } from '../scene/StageScene';
import { findStation, getStationForPath } from '../stations/stations';
import './SceneLayer.css';

/**
 * The 3D stage behind the content. The URL decides where the camera is:
 * this component only forwards route changes to the scene.
 */
export function SceneLayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StageScene | null>(null);
  const [isReady, setIsReady] = useState(false);
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
          onSelectStation: (id) => navigate(findStation(id).path),
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
    };
  }, [reducedMotion, navigate]);

  return (
    <div
      ref={containerRef}
      className={isReady ? 'scene-layer scene-layer--ready' : 'scene-layer'}
      aria-hidden="true"
    />
  );
}
