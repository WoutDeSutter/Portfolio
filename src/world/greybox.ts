import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
  type Material,
} from 'three';
import { Sign } from './sign';
import type { WorldColors } from './theme';

/**
 * Greybox versions of everything on the terrain: simple blocks with the right proportions,
 * used to validate the interaction before real (Blender) models replace them.
 * Every builder works in local space with its front facing +z.
 */

export type GreyboxMaterials = {
  body: MeshStandardMaterial;
  dark: MeshStandardMaterial;
  ground: MeshStandardMaterial;
  hit: MeshBasicMaterial;
};

export function createGreyboxMaterials(colors: WorldColors): GreyboxMaterials {
  return {
    body: new MeshStandardMaterial({ color: 0x5c5c5c, roughness: 0.9 }),
    dark: new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 }),
    ground: new MeshStandardMaterial({ color: colors.bg.clone().multiplyScalar(1.8), roughness: 1 }),
    // Invisible, but still hit by raycasting: the click area of a place.
    hit: new MeshBasicMaterial({ visible: false }),
  };
}

export type PlaceObject = {
  group: Group;
  /** The visible block geometry; replaced by the Blender model once that has loaded. */
  visual: Group;
  /** Invisible box used for hover/click. */
  hitArea?: Mesh;
  sign?: Sign;
  /** Where sound comes from (used later for positional audio). */
  speakers?: Vector3[];
  /** Where the camera looks when this place is open (local space). */
  focus: Vector3;
};

/** A box with its base at `y` (not its centre), which is how things stand on the ground. */
function box(width: number, height: number, depth: number, material: Material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y + height / 2, z);
  return mesh;
}

/**
 * Moves everything except the sign and the click area into a `visual` group, so the world can
 * swap the blocks for a Blender model while keeping the sign, click area and focus point.
 */
function withVisual(object: Omit<PlaceObject, 'visual'>): PlaceObject {
  const visual = new Group();
  const keep = new Set<Object3D>([object.sign?.mesh, object.hitArea].filter((item) => item !== undefined));
  for (const child of [...object.group.children]) if (!keep.has(child)) visual.add(child);
  object.group.add(visual);
  return { ...object, visual };
}

function hitBox(width: number, height: number, depth: number, materials: GreyboxMaterials, z = 0) {
  return box(width, height, depth, materials.hit, 0, 0, z);
}

export function createGround(materials: GreyboxMaterials): Mesh {
  const ground = new Mesh(new PlaneGeometry(90, 90), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  return ground;
}

/** A booth (a pop-up container in the Blender model): counter at the front, walls, roof and a sign on top. */
export function createBooth(materials: GreyboxMaterials, colors: WorldColors): PlaceObject {
  const group = new Group();
  const { body, dark } = materials;

  group.add(box(3.6, 0.15, 2.6, dark));
  group.add(box(3.2, 1.05, 0.6, body, 0, 0.15, 0.95));
  group.add(box(3.6, 2.8, 0.12, body, 0, 0, -1.24));
  group.add(box(0.12, 2.8, 2.6, body, -1.74, 0, 0));
  group.add(box(0.12, 2.8, 2.6, body, 1.74, 0, 0));
  const roof = box(4, 0.14, 3.2, dark, 0, 2.85, 0.2);
  group.add(roof);

  const sign = new Sign(3.2, 0.8, colors);
  sign.mesh.position.set(0, 3.75, 0.7);
  group.add(sign.mesh);

  const hitArea = hitBox(4.6, 4.3, 4.2, materials, 0.6);
  group.add(hitArea);

  return withVisual({ group, hitArea, sign, focus: new Vector3(0, 1.8, 0.6) });
}

/** Main stage: deck, LED wall (with name and role), truss towers and hanging speakers. */
export function createStage(materials: GreyboxMaterials, colors: WorldColors): PlaceObject {
  const group = new Group();
  const { body, dark } = materials;
  const deck = { width: 16, height: 1.4, depth: 8 };

  group.add(box(deck.width, deck.height, deck.depth, dark));

  const sign = new Sign(11, 4.4, colors);
  sign.mesh.position.set(0, deck.height + 2.9, -deck.depth / 2 + 0.4);
  group.add(sign.mesh);

  // Truss: four towers and a roof frame
  const trussHeight = 9;
  for (const x of [-7.6, 7.6]) {
    for (const z of [-3.6, 3.6]) group.add(box(0.5, trussHeight, 0.5, body, x, 0, z));
    group.add(box(0.5, 0.5, 7.7, body, x, trussHeight, 0));
  }
  for (const z of [-3.6, 3.6]) group.add(box(15.7, 0.5, 0.5, body, 0, trussHeight, z));

  // Line arrays hanging left and right of the stage front
  const speakers = [new Vector3(-9.2, 5.5, 3.6), new Vector3(9.2, 5.5, 3.6)];
  for (const position of speakers) group.add(box(0.9, 3, 0.9, dark, position.x, position.y - 1.5, position.z));

  const hitArea = hitBox(deck.width + 3, trussHeight, deck.depth, materials);
  group.add(hitArea);

  return withVisual({ group, hitArea, sign, speakers, focus: new Vector3(0, 4, 0) });
}

/** FOH tent: a raised platform with a mixing desk facing the stage, under a small roof. */
export function createFoh(materials: GreyboxMaterials): PlaceObject {
  const group = new Group();
  const { body, dark } = materials;

  group.add(box(5, 0.3, 4, dark));
  for (const x of [-2.3, 2.3]) {
    for (const z of [-1.8, 1.8]) group.add(box(0.12, 3, 0.12, body, x, 0.3, z));
  }
  const roof = new Mesh(new ConeGeometry(3.6, 1.2, 4), dark);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.3 + 0.6;
  group.add(roof);

  // The desk faces the stage (-z): the operator stands on the entrance side.
  group.add(box(2.6, 0.9, 1.1, body, 0, 0.3, -0.7));
  const desktop = box(2.6, 0.08, 1.1, dark, 0, 1.2, -0.7);
  desktop.rotation.x = 0.2;
  group.add(desktop);

  const hitArea = hitBox(5.5, 4.5, 4.5, materials);
  group.add(hitArea);

  return withVisual({ group, hitArea, focus: new Vector3(0, 1.3, -0.6) });
}

/** Entrance arch with a banner (name and role), facing the arriving visitor. */
export function createEntrance(materials: GreyboxMaterials, colors: WorldColors): PlaceObject {
  const group = new Group();
  for (const x of [-5.6, 5.6]) group.add(box(1, 5.2, 1, materials.body, x, 0, 0));

  const sign = new Sign(10.2, 1.5, colors);
  sign.mesh.position.set(0, 4.4, 0.52);
  group.add(sign.mesh);

  return withVisual({ group, sign, focus: new Vector3() });
}
