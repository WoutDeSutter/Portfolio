import {
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneColors } from '../theme';

/**
 * Objects are drawn in a "previz" style — dark volumes with thin light edges,
 * like stage previsualisation software. It reads as technical and needs no lighting.
 */
export type PrevizMaterials = {
  face: MeshBasicMaterial;
  edge: LineBasicMaterial;
};

export function createPrevizMaterials(colors: SceneColors): PrevizMaterials {
  return {
    face: new MeshBasicMaterial({ color: colors.surface }),
    edge: new LineBasicMaterial({ color: colors.lineStrong }),
  };
}

/** A solid with visible edges. Pass a separate edge material to highlight it on its own. */
export function createSolid(
  geometry: BufferGeometry,
  materials: PrevizMaterials,
  edge: LineBasicMaterial = materials.edge,
): Group {
  const solid = new Group();
  solid.add(new Mesh(geometry, materials.face));
  solid.add(new LineSegments(new EdgesGeometry(geometry), edge));
  return solid;
}

/**
 * Performance: bakes every part of `group` that uses the shared previz materials into one
 * mesh and one set of lines, so the GPU draws them in 2 calls instead of 2 per part
 * (the mixing desk alone has 60+ parts). Parts with their own materials — highlightable
 * edges, projection surfaces, light — are left as they are.
 * Only use it on groups without interactive (hoverable/clickable) parts that share materials.
 */
export function mergeStatic(group: Group, materials: PrevizMaterials): void {
  group.updateMatrixWorld(true);
  const toGroupSpace = group.matrixWorld.clone().invert();
  const faces: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const merged: Object3D[] = [];

  const bake = (object: Mesh | LineSegments) =>
    object.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(toGroupSpace, object.matrixWorld));

  group.traverse((object) => {
    if (object instanceof LineSegments && object.material === materials.edge) {
      edges.push(bake(object));
      merged.push(object);
    } else if (object instanceof Mesh && object.material === materials.face) {
      faces.push(bake(object));
      merged.push(object);
    }
  });

  for (const object of merged) {
    object.removeFromParent();
    (object as Mesh).geometry.dispose();
  }
  if (faces.length > 0) group.add(new Mesh(mergeGeometries(faces), materials.face));
  if (edges.length > 0) group.add(new LineSegments(mergeGeometries(edges), materials.edge));
  for (const geometry of [...faces, ...edges]) geometry.dispose();
}

/** A box standing on y = 0 (its base on the floor), which is how most stage objects are placed. */
export function createBox(
  width: number,
  height: number,
  depth: number,
  materials: PrevizMaterials,
  edge?: LineBasicMaterial,
): Group {
  const geometry = new BoxGeometry(width, height, depth).translate(0, height / 2, 0);
  return createSolid(geometry, materials, edge);
}
