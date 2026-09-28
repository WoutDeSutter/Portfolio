import type { StationId } from './stations';

type Point3 = [x: number, y: number, z: number];

export type CameraView = {
  /** Camera position relative to the station, in world units (x = right, y = up, z = towards the front). */
  position: Point3;
  /** Point the camera looks at, relative to the station. */
  lookAt: Point3;
};

/**
 * Camera view per station, shared by the 3D scene and the floor plan's view indicator.
 * The entry is an overview that fits all five stations in the area right of the text column
 * (found with a small search over camera positions); it looks at the stage from the Work side.
 */
export const CAMERA_VIEWS: Record<StationId, CameraView> = {
  entry: { position: [21, 17, 0], lookAt: [3, 0, 1.5] },
  work: { position: [-3, 6.5, 12], lookAt: [0, 0.5, 0] },
  lab: { position: [0, 6.5, 12], lookAt: [0, 0.5, 0] },
  about: { position: [3, 6.5, 12], lookAt: [0, 0.5, 0] },
  contact: { position: [0, 6.5, 12], lookAt: [0, 0.5, 0] },
};

/** Camera travel time between stations, in seconds (floor-plan indicator uses the same). */
export const TRAVEL_DURATION = 1.6;
