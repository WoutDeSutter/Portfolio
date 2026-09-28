import {
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from 'three';
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
