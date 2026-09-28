import { createContext, useContext } from 'react';

/**
 * Whether the site shows its text version instead of the 3D festival: no WebGL,
 * or the world failed to start. Provided by Festival.
 */
export const TextVersionContext = createContext(false);

export function useTextVersion(): boolean {
  return useContext(TextVersionContext);
}
