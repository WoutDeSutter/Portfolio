import { useSyncExternalStore } from 'react';
import { getState, subscribe, type MusicState } from './music';

/**
 * The current music state in a component. useSyncExternalStore lets React read a value that
 * lives outside React (the music module) and re-render whenever it changes.
 */
export function useMusic(): MusicState {
  return useSyncExternalStore(subscribe, getState);
}
