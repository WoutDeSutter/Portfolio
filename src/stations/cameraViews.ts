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
 * Each view keeps its installation in the area right of the text column at 1440×900
 * (checked by projecting the installation's corners). The entry is an overview of all
 * five stations; it looks at the stage from the Work side.
 */
export const CAMERA_VIEWS: Record<StationId, CameraView> = {
  entry: { position: [21, 17, 0], lookAt: [3, 0, 1.5] },
  work: { position: [3, 9, 9], lookAt: [0.5, 1.5, 0] },
  lab: { position: [0.5, 5.5, 9], lookAt: [0, 0.8, -0.6] },
  about: { position: [2.5, 5, 8], lookAt: [0, 0.6, -0.5] },
  contact: { position: [0.5, 4.5, 8], lookAt: [0, 1, -0.5] },
};

/** Camera travel time between stations, in seconds (floor-plan indicator uses the same). */
export const TRAVEL_DURATION = 1.6;
