import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Hotspots } from '../components/Hotspots';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { MuteButton } from '../components/MuteButton';
import { WorldLayer } from '../components/WorldLayer';
import { useWebGLSupport } from '../hooks/useWebGLSupport';
import { getPlaceForPath } from './places';
import { NO_FRAME, PanelFrameContext, type PanelFrame } from './PanelFrameContext';
import { TextVersionContext } from './TextVersionContext';
import './Festival.css';

/**
 * The whole site: the 3D festival filling the screen, the language toggle as the only
 * visible control, keyboard hotspots, and the panel of the open place (<Outlet />).
 * Without WebGL, or when the world fails to start, it renders the text version instead.
 */
export function Festival() {
  const hasWebGL = useWebGLSupport();
  const [worldFailed, setWorldFailed] = useState(false);
  const textVersion = !hasWebGL || worldFailed;
  const onWorldFail = useCallback(() => setWorldFailed(true), []);
  const { pathname } = useLocation();
  const [frame, setFrameState] = useState<PanelFrame>(NO_FRAME);

  // Only update when the numbers change, so panels can report on every resize cheaply.
  const setFrame = useCallback((next: PanelFrame) => {
    setFrameState((current) =>
      current.right === next.right && current.bottom === next.bottom ? current : next,
    );
  }, []);

  // When a panel closes, give keyboard focus back to that place's hotspot (instead of losing it).
  const previousPlace = useRef(getPlaceForPath(pathname).id);
  useEffect(() => {
    const place = getPlaceForPath(pathname).id;
    if (place === 'entrance' && previousPlace.current !== 'entrance' && document.activeElement === document.body) {
      document.querySelector<HTMLElement>(`[data-place="${previousPlace.current}"]`)?.focus();
    }
    previousPlace.current = place;
  }, [pathname]);

  return (
    <TextVersionContext.Provider value={textVersion}>
      <PanelFrameContext.Provider value={setFrame}>
        <div className={textVersion ? 'festival festival--flat' : 'festival'}>
          {!textVersion && <WorldLayer frame={frame} onFail={onWorldFail} />}
          <Hotspots />
          <div className="festival__corner">
            <MuteButton />
            <LanguageSwitch />
          </div>
          <main className="festival__main">
            <Outlet />
          </main>
        </div>
      </PanelFrameContext.Provider>
    </TextVersionContext.Provider>
  );
}
