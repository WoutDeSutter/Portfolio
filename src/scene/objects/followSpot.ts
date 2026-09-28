import {
  AdditiveBlending,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import { createRadialTexture, createVerticalFadeTexture } from '../textures';
import type { SceneColors } from '../theme';

const BEAM_HEIGHT = 14;
const BEAM_RADIUS = 2.2;
const POOL_SIZE = 5;

/**
 * A follow spot: a soft pool of light on the floor plus a faint beam from above.
 * It moves to the station the visitor is at — the stage equivalent of "you are here".
 */
export function createFollowSpot(colors: SceneColors): Group {
  const spot = new Group();

  const pool = new Mesh(
    new PlaneGeometry(POOL_SIZE, POOL_SIZE),
    new MeshBasicMaterial({
      color: colors.text,
      map: createRadialTexture(),
      transparent: true,
      opacity: 0.16,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.01;
  spot.add(pool);

  const beam = new Mesh(
    new ConeGeometry(BEAM_RADIUS, BEAM_HEIGHT, 48, 1, true),
    new MeshBasicMaterial({
      color: colors.text,
      alphaMap: createVerticalFadeTexture(),
      transparent: true,
      opacity: 0.05,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  beam.position.y = BEAM_HEIGHT / 2;
  spot.add(beam);

  return spot;
}
