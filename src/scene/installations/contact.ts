import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { createBox, mergeStatic, type PrevizMaterials } from '../objects/previz';
import { createRadialTexture, createVerticalFadeTexture } from '../textures';
import type { SceneColors } from '../theme';
import type { Installation } from './types';

const DOOR = { width: 1.3, height: 2.4, post: 0.14, z: -1.5 };

/** Contact: the stage door — the way out to the rest of the world, with light spilling in. */
export function createContactInstallation(colors: SceneColors, materials: PrevizMaterials): Installation {
  const group = new Group();

  for (const side of [-1, 1]) {
    const post = createBox(DOOR.post, DOOR.height, DOOR.post, materials);
    post.position.set((side * (DOOR.width + DOOR.post)) / 2, 0, DOOR.z);
    group.add(post);
  }
  const lintel = createBox(DOOR.width + DOOR.post * 2, DOOR.post, DOOR.post, materials);
  lintel.position.set(0, DOOR.height, DOOR.z);
  group.add(lintel);
  mergeStatic(group, materials);

  const lightMaterial = { color: colors.text, transparent: true, blending: AdditiveBlending, depthWrite: false };

  // Light in the doorway, brightest at the floor
  const glow = new Mesh(
    new PlaneGeometry(DOOR.width, DOOR.height),
    new MeshBasicMaterial({ ...lightMaterial, alphaMap: createVerticalFadeTexture(), opacity: 0.1 }),
  );
  glow.position.set(0, DOOR.height / 2, DOOR.z);
  group.add(glow);

  // Spill on the floor in front of the door
  const spill = new Mesh(
    new PlaneGeometry(DOOR.width * 1.6, 2.6),
    new MeshBasicMaterial({ ...lightMaterial, map: createRadialTexture(), opacity: 0.1 }),
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.012, DOOR.z + 1.1);
  group.add(spill);

  return { group, interactives: [] };
}
