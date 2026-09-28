import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Hotspots } from '../components/Hotspots';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { WorldLayer } from '../components/WorldLayer';
import { useWebGLSupport } from '../hooks/useWebGLSupport';
import { getPlaceForPath } from './places';
import { NO_FRAME, PanelFrameContext, type PanelFrame } from './PanelFrameContext';
import './Festival.css';

/**
 * The whole site: the 3D festival filling the screen, the language toggle as the only
 * visible control, keyboard hotspots, and the panel of the open place (<Outlet />).
 * Without WebGL it renders the text version instead of the world.
 */
export function Festival() {
  const hasWebGL = useWebGLSupport();
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
    <PanelFrameContext.Provider value={setFrame}>
      <div className={hasWebGL ? 'festival' : 'festival festival--flat'}>
        {hasWebGL && <WorldLayer frame={frame} />}
        <Hotspots />
        <div className="festival__corner">
          <LanguageSwitch />
        </div>
        <main className="festival__main">
          <Outlet />
        </main>
      </div>
    </PanelFrameContext.Provider>
  );
}
