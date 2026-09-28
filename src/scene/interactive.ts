import type { Object3D } from 'three';
import type { StationId } from '../stations/stations';

/** Something in the scene the visitor can hover and click to navigate. */
export type Interactive = {
  /** Object used for raycasting (may be invisible). */
  hitArea: Object3D;
  /** Route to open on click, e.g. `/projects/tagrun`. */
  path: string;
  /** Translation key for the hover label, e.g. `projects.tagrun.title`. */
  labelKey: string;
  /** Set for station marks, so their tape can be highlighted. */
  stationId?: StationId;
  setHighlighted?: (highlighted: boolean) => void;
};

/** What the scene reports to React when the hovered object changes. */
export type HoverInfo = {
  labelKey: string;
  clientX: number;
  clientY: number;
};
