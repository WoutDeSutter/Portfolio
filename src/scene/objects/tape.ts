import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';

const TAPE_HEIGHT = 0.006; // just above the floor, avoids flickering (z-fighting)
export const TAPE_WIDTH = 0.12;

/**
 * A strip of gaffer tape from `from` to `to`.
 * The geometry starts at its origin, so animating scale.x "rolls out" the tape.
 */
export function createTapeStrip(from: Vector3, to: Vector3, material: MeshBasicMaterial): Mesh {
  const length = from.distanceTo(to);
  const geometry = new PlaneGeometry(length, TAPE_WIDTH);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(length / 2, 0, 0);

  const strip = new Mesh(geometry, material);
  strip.position.set(from.x, TAPE_HEIGHT, from.z);
  strip.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);
  return strip;
}

/** Four L-shaped corners around a position, like spike marks on a stage floor. */
export function createSpikeMark(size: number, material: MeshBasicMaterial): Group {
  const mark = new Group();
  const half = size / 2;
  const arm = size * 0.3;

  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const corner = new Vector3(sx * half, 0, sz * half);
    mark.add(createTapeStrip(corner, corner.clone().add(new Vector3(-sx * arm, 0, 0)), material));
    mark.add(createTapeStrip(corner, corner.clone().add(new Vector3(0, 0, -sz * arm)), material));
  }
  return mark;
}
