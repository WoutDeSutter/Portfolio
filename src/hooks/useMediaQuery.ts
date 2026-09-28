import { useCallback, useSyncExternalStore } from 'react';

/**
 * Returns whether a CSS media query currently matches, and re-renders when that changes
 * (e.g. resizing the window or toggling "reduce motion" in the OS).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
