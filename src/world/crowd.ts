import { BufferGeometry, Group, InstancedMesh, Material, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * A small audience in front of the main stage: three kinds of person from crowd.glb (collection
 * "crowd" in festival.blend), placed with instancing, so the whole crowd costs three draw calls.
 * While music plays they bob to it (not with reduced motion). Decoration: loaded after the first
 * frame, like the terrain.
 */

const AREA = { xMin: -7, xMax: 7, zMin: -8.3, zMax: -3.4 }; // world space, between the barrier and the paths
const PEOPLE = 26;
const SPACING = 0.95;
const BEATS_PER_SECOND = 2.05; // ~123 bpm: most festival tracks are close

type Person = { x: number; z: number; turn: number; scale: number; phase: number; kind: number; index: number };

export type Crowd = {
  group: Group;
  /** Returns whether the crowd moved (the world then renders). */
  update: (seconds: number, level: number, playing: boolean) => boolean;
};

export async function loadCrowd(reducedMotion: boolean): Promise<Crowd | null> {
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/crowd.glb`);
    const kinds: { geometry: BufferGeometry; material: Material }[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) kinds.push({ geometry: object.geometry, material: object.material as Material });
    });
    return kinds.length ? createCrowd(kinds, reducedMotion) : null;
  } catch (error) {
    console.warn('[world] Could not load the crowd:', error);
    return null;
  }
}

function createCrowd(kinds: { geometry: BufferGeometry; material: Material }[], reducedMotion: boolean): Crowd {
  // Deterministic placement, so the crowd looks the same on every visit
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const people: Omit<Person, 'index'>[] = [];
  for (let attempt = 0; attempt < 600 && people.length < PEOPLE; attempt++) {
    // Denser towards the stage and the middle, like a real crowd
    const x = AREA.xMin + (AREA.xMax - AREA.xMin) * (0.5 + (random() - 0.5) * (0.6 + random() * 0.4));
    const z = AREA.zMin + (AREA.zMax - AREA.zMin) * Math.pow(random(), 1.6);
    if (people.some((other) => Math.hypot(other.x - x, other.z - z) < SPACING)) continue;
    people.push({
      x,
      z,
      turn: Math.PI + (random() - 0.5) * 0.7 - x * 0.03, // facing the stage, a little towards the middle
      scale: 0.92 + random() * 0.16,
      phase: random() * Math.PI * 2,
      kind: (random() < 0.55 ? 0 : random() < 0.6 ? 1 : 2) % kinds.length,
    });
  }

  const group = new Group();
  const counts = kinds.map((_, kind) => people.filter((person) => person.kind === kind).length);
  const meshes = kinds.map(({ geometry, material }, kind) => {
    const mesh = new InstancedMesh(geometry, material, Math.max(1, counts[kind]));
    mesh.count = counts[kind];
    group.add(mesh);
    return mesh;
  });
  const next = kinds.map(() => 0);
  const placed: Person[] = people.map((person) => ({ ...person, index: next[person.kind]++ }));

  const dummy = new Object3D();
  function place(time: number, energy: number) {
    for (const person of placed) {
      const bounce = energy * Math.abs(Math.sin(time * Math.PI * BEATS_PER_SECOND + person.phase));
      dummy.position.set(person.x, bounce * 0.07, person.z);
      dummy.rotation.set(0, person.turn, bounce * 0.05 * Math.sin(person.phase));
      dummy.scale.setScalar(person.scale);
      dummy.updateMatrix();
      meshes[person.kind].setMatrixAt(person.index, dummy.matrix);
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
  place(0, 0);

  let time = 0;
  let moving = false;
  return {
    group,
    update(seconds, level, playing) {
      if (reducedMotion) return false;
      if (!playing) {
        if (!moving) return false;
        moving = false;
        place(0, 0); // stand still again
        return true;
      }
      moving = true;
      time += seconds;
      place(time, 0.4 + Math.min(1, level * 1.6));
      return true;
    },
  };
}
