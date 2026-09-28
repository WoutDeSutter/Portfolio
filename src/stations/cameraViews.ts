import type { StationId } from './stations';

type Point3 = [x: number, y: number, z: number];

export type CameraView = {
  /** Camera position relative to the station, in world units (x = right, y = up, z = towards the front). */
  position: Point3;
  /** Point the camera looks at, relative to the station. */
  lookAt: Point3;
};

/**
 * Camera view per station. The scene reports the view it travels to (including focus views
 * on project objects) back to React, which is how the floor plan's view cone follows it.
 * Views are designed for the free area right of the text column (see `frameCamera` in
 * scene/layout.ts), so they hold at every screen width. They were fitted by projecting each
 * installation's corners and keeping them inside that area, looking down ~30°.
 * The entry is an overview of all five stations; it looks at the stage from the Work side.
 */
export const CAMERA_VIEWS: Record<StationId, CameraView> = {
  entry: { position: [31.5, 19.5, 0], lookAt: [-2.7, -0.3, 0] },
  work: { position: [4.95, 10.1, 12.8], lookAt: [1.15, 1.6, -1.4] },
  lab: { position: [0.9, 6.65, 9.05], lookAt: [0.05, 0.9, -0.85] },
  about: { position: [1.9, 4.85, 6.5], lookAt: [0, 0.6, -0.6] },
  contact: { position: [0.55, 5.2, 6.75], lookAt: [-0.1, 0.95, -0.6] },
};

/** Camera travel time between stations, in seconds (floor-plan indicator uses the same). */
export const TRAVEL_DURATION = 1.6;
