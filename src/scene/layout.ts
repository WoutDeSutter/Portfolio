import { Vector3 } from 'three';
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

/** On wide screens the text column covers the left side, so the stage is framed to the right. */
export const FRAME_SHIFT = 0.22;
export const FRAME_SHIFT_MIN_WIDTH = 768;
