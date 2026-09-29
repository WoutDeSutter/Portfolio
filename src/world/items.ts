import type { AnimationClip, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * A project's small animated model ("the dish on the menu"), from public/models/items/.
 * Settings come from the model itself (custom properties on item_root in festival.blend):
 * turntable = slowly turn on the tray; fit = scale to fit the tray (off for items made at real
 * size, like the free runner that uses the whole counter); scale = size on the tray after fitting.
 */
export type Item = { scene: Group; clips: AnimationClip[]; turntable: boolean; fit: boolean; scale: number };

const loader = new GLTFLoader();
const cache = new Map<string, Promise<Item>>();

/** Loads an item once; later calls reuse it. `path` is relative to the site root (projects.json → model). */
export function loadItem(path: string): Promise<Item> {
  let item = cache.get(path);
  if (!item) {
    item = loader
      .loadAsync(`${import.meta.env.BASE_URL}${path}`)
      .then((gltf) => {
        let settings: { turntable?: number; fit?: number; scale?: number } = {};
        gltf.scene.traverse((object) => {
          if ('turntable' in object.userData) settings = object.userData;
        });
        return {
          scene: gltf.scene,
          clips: gltf.animations,
          turntable: settings.turntable !== 0,
          fit: settings.fit !== 0,
          scale: typeof settings.scale === 'number' && settings.scale > 0 ? settings.scale : 1,
        };
      });
    cache.set(path, item);
    // A failed load may be retried later (e.g. after a network hiccup).
    item.catch(() => cache.delete(path));
  }
  return item;
}
