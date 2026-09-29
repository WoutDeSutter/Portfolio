import { Group, Material, Mesh, Object3D, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { assetUrl } from '../utils/assetUrl';

/** The Blender models (blender/festival.blend → public/models/*.glb). */
export type ModelName =
  | 'booth'
  | 'booth_projects'
  | 'booth_lab'
  | 'booth_merch'
  | 'booth_contact'
  | 'booth_links'
  | 'stage'
  | 'foh'
  | 'entrance';
const MODEL_NAMES: ModelName[] = [
  'booth',
  'booth_projects',
  'booth_lab',
  'booth_merch',
  'booth_contact',
  'booth_links',
  'stage',
  'foh',
  'entrance',
];

export type Models = Partial<Record<ModelName, Group>>;

/**
 * Loads every model. A model that fails to load is left out, so that place keeps its greybox
 * version; the world never waits on a broken file.
 */
export async function loadModels(): Promise<Models> {
  const loader = new GLTFLoader();
  const entries = await Promise.all(
    MODEL_NAMES.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(assetUrl(`models/${name}.glb`));
        return [name, mergeByMaterial(gltf.scene)] as const;
      } catch (error) {
        console.warn(`[world] Could not load model "${name}", using the greybox:`, error);
        return [name, undefined] as const;
      }
    }),
  );
  return Object.fromEntries(entries.filter(([, model]) => model)) as Models;
}

/**
 * The models are static, so all meshes that share a material are merged into one:
 * one draw call per material instead of one per Blender object.
 */
function mergeByMaterial(scene: Object3D): Group {
  scene.updateMatrixWorld(true);
  const byMaterial = new Map<Material, BufferGeometry[]>();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = (object.geometry as BufferGeometry).clone().applyMatrix4(object.matrixWorld);
    const material = object.material as Material;
    byMaterial.set(material, [...(byMaterial.get(material) ?? []), geometry]);
    (object.geometry as BufferGeometry).dispose();
  });

  const group = new Group();
  for (const [material, geometries] of byMaterial) {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
    if (geometries.length > 1) for (const geometry of geometries) geometry.dispose();
    if (merged) group.add(new Mesh(merged, material));
  }
  return group;
}

/**
 * The terrain around the places (grass and hills, paths, fence, trees, festoon lights). It is
 * decoration, so the world does not wait for it: it is loaded after the first frame and simply
 * appears. Null when it cannot be loaded (the plain ground stays).
 */
export async function loadTerrain(): Promise<Group | null> {
  try {
    const gltf = await new GLTFLoader().loadAsync(assetUrl('models/terrain.glb'));
    return mergeByMaterial(gltf.scene);
  } catch (error) {
    console.warn('[world] Could not load the terrain, keeping the plain ground:', error);
    return null;
  }
}
