import type { AnimationClip, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** A project's small animated model ("the dish on the menu"), from public/models/items/. */
export type Item = { scene: Group; clips: AnimationClip[] };

const loader = new GLTFLoader();
const cache = new Map<string, Promise<Item>>();

/** Loads an item once; later calls reuse it. `path` is relative to the site root (projects.json → model). */
export function loadItem(path: string): Promise<Item> {
  let item = cache.get(path);
  if (!item) {
    item = loader
      .loadAsync(`${import.meta.env.BASE_URL}${path}`)
      .then((gltf) => ({ scene: gltf.scene, clips: gltf.animations }));
    cache.set(path, item);
    // A failed load may be retried later (e.g. after a network hiccup).
    item.catch(() => cache.delete(path));
  }
  return item;
}
