import {
  AdditiveBlending,
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
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

function createRadialTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** Black at the top (invisible) to white at the floor: the beam fades out towards the rig. */
function createVerticalFadeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#000');
  gradient.addColorStop(1, '#fff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return new CanvasTexture(canvas);
}
