import type { Group } from 'three';
import type { Interactive } from '../interactive';

/** The objects at one station, positioned relative to the station's spike mark. */
export type Installation = {
  group: Group;
  interactives: Interactive[];
  /**
   * Called the first time the camera arrives, to load heavier assets only when needed.
   * Call `onChange` when something visible changed later (e.g. a texture finished loading).
   */
  activate?: (onChange: () => void) => void;
};
