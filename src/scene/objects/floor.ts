import {
  BufferGeometry,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { STAGE_BOUNDS } from '../layout';
import type { SceneColors } from '../theme';

const FLOOR_SIZE = 80;
const GRID_SIZE = 60;
const GRID_OPACITY = 0.35;

export type Floor = {
  group: Group;
  grid: GridHelper;
  boundary: Line;
};

/** Matte black floor, a faint calibration grid and the dashed tracking-volume boundary. */
export function createFloor(colors: SceneColors): Floor {
  const group = new Group();

  const surface = new Mesh(
    new PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new MeshBasicMaterial({ color: colors.bg.clone().multiplyScalar(1.3) }),
  );
  surface.rotation.x = -Math.PI / 2;
  group.add(surface);

  const grid = new GridHelper(GRID_SIZE, GRID_SIZE, colors.line, colors.line);
  const gridMaterial = grid.material as LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.opacity = GRID_OPACITY;
  grid.position.y = 0.002;
  group.add(grid);

  const { min, max } = STAGE_BOUNDS;
  const corners = [
    new Vector3(min.x, 0.004, min.z),
    new Vector3(max.x, 0.004, min.z),
    new Vector3(max.x, 0.004, max.z),
    new Vector3(min.x, 0.004, max.z),
    new Vector3(min.x, 0.004, min.z),
  ];
  const boundary = new Line(
    new BufferGeometry().setFromPoints(corners),
    new LineDashedMaterial({ color: colors.lineStrong, dashSize: 0.4, gapSize: 0.3, transparent: true }),
  );
  boundary.computeLineDistances(); // required for dashed lines
  group.add(boundary);

  return { group, grid, boundary };
}
