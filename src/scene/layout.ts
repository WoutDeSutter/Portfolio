import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_VIEWS } from '../stations/cameraViews';
import {
  ENTRY,
  PLAN_BOUNDS,
  PLAN_TO_WORLD,
  findStation,
  type Station,
  type StationId,
} from '../stations/stations';

/** Floor-plan position → world position, with the entry at the origin. */
export function planToWorld(x: number, y: number): Vector3 {
  return new Vector3((x - ENTRY.plan.x) * PLAN_TO_WORLD, 0, (y - ENTRY.plan.y) * PLAN_TO_WORLD);
}

export function stationPosition(station: Station): Vector3 {
  return planToWorld(station.plan.x, station.plan.y);
}

/** Tracking-volume boundary, matching the dashed rectangle on the floor plan. */
export const STAGE_BOUNDS = {
  min: planToWorld(PLAN_BOUNDS.x0, PLAN_BOUNDS.y0),
  max: planToWorld(PLAN_BOUNDS.x1, PLAN_BOUNDS.y1),
};

/** World-space camera position and look-at point for a station. */
export function cameraTargets(id: StationId) {
  const station = stationPosition(findStation(id));
  const view = CAMERA_VIEWS[id];
  return {
    station,
    camera: station.clone().add(new Vector3(...view.position)),
    lookAt: station.clone().add(new Vector3(...view.lookAt)),
  };
}

export const BASE_FOV = 38;

/**
 * The camera views are designed for the free area right of the text column at 1440×900
 * (568×900 px). Its aspect ratio is the reference: on narrower free areas the field of view
 * widens so the same things stay in frame; on wider ones the picture just shows more around it.
 */
const DESIGN_ASPECT = 568 / 900;
const DESIGN_HALF_HFOV = Math.atan(Math.tan(MathUtils.degToRad(BASE_FOV / 2)) * DESIGN_ASPECT);

/**
 * Renders the camera as if the free area were the whole screen: the view fills the free area
 * exactly, and the canvas to the left of it (behind the text) continues the same picture.
 */
export function frameCamera(
  camera: PerspectiveCamera,
  canvas: { width: number; height: number },
  free: { left: number; width: number },
) {
  if (free.width <= 0) {
    camera.aspect = canvas.width / canvas.height;
    camera.fov = BASE_FOV;
    camera.clearViewOffset();
  } else {
    const aspect = free.width / canvas.height;
    camera.aspect = aspect;
    camera.fov =
      aspect < DESIGN_ASPECT
        ? MathUtils.radToDeg(2 * Math.atan(Math.tan(DESIGN_HALF_HFOV) / aspect))
        : BASE_FOV;
    // Show the region from -free.left to the canvas' right edge of a virtual image that is
    // exactly as wide as the free area.
    camera.setViewOffset(free.width, canvas.height, -free.left, 0, canvas.width, canvas.height);
  }
  camera.updateProjectionMatrix();
}
