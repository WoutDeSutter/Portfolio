import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SpotLight,
  type Scene,
} from 'three';
import { LIGHT_COLORS, type LightState } from '../festival/lights';

/**
 * The stage lights the visitor controls from the lighting desk in the FOH: two wash spots,
 * twelve moving heads (their lenses come from the Blender stage model) and their beams.
 * Modes: wash (spots only), beams (still beams), show (beams sweep and pulse with the music),
 * blackout. The chosen colours alternate over the lights. With reduced motion the show stands still.
 */

// Moving heads in stage space (see build_stage() in build_festival.py): 6 per truss, front and back.
const HEADS = [3.68, -3.12].flatMap((z) => Array.from({ length: 6 }, (_, i) => ({ x: -6.25 + i * 2.5, y: 8.22, z })));
const BEAM = { length: 10, radius: 1.1, tilt: -0.45 };

export type StageShow = {
  setLights: (lights: LightState) => void;
  /** Lens materials of the stage model, once it has loaded. */
  useLenses: (root: Object3D) => void;
  /** Advance the animation; returns whether anything changed (the world then renders). */
  update: (seconds: number, level: number) => boolean;
  dispose: () => void;
};

export function createStageShow(scene: Scene, stage: Object3D, reducedMotion: boolean): StageShow {
  // Wash: two spots from the front truss onto the stage
  const spots = [-5, 5].map((x) => {
    const spot = new SpotLight(0xffffff, 250, 25, 0.45, 0.6);
    spot.position.set(x, 9, 3);
    spot.target.position.set(x * 0.3, 1.4, 0);
    stage.add(spot, spot.target);
    return spot;
  });

  // Beams: open cones with their tip at the moving head, opening downwards towards the audience
  const beamGeometry = new ConeGeometry(BEAM.radius, BEAM.length, 20, 1, true);
  beamGeometry.translate(0, -BEAM.length / 2, 0);
  const beams = HEADS.map((head, index) => {
    const material = new MeshBasicMaterial({
      transparent: true,
      opacity: 0.07,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    const pivot = new Group();
    pivot.position.set(head.x, head.y, head.z);
    pivot.add(new Mesh(beamGeometry, material));
    pivot.rotation.x = BEAM.tilt;
    pivot.visible = false;
    stage.add(pivot);
    // Alternate colours from left to right, and front and back truss out of step
    return { pivot, material, index, slot: (index % 6) + Math.floor(index / 6) };
  });

  let lenses: MeshStandardMaterial[] = [];
  let lights: LightState = { mode: 'wash', colors: ['red'] };
  let palette: Color[] = [new Color(LIGHT_COLORS.red)];
  let time = 0;
  scene.updateMatrixWorld();

  const colorFor = (slot: number) => palette[slot % palette.length];

  function apply() {
    palette = lights.colors.map((id) => new Color(LIGHT_COLORS[id]));
    const on = lights.mode !== 'blackout';
    spots.forEach((spot, index) => {
      spot.color.copy(colorFor(index));
      spot.intensity = on ? 250 : 0;
    });
    for (const beam of beams) {
      beam.pivot.visible = lights.mode === 'beams' || lights.mode === 'show';
      beam.material.color.copy(colorFor(beam.slot));
      beam.material.opacity = 0.07;
      beam.pivot.rotation.set(BEAM.tilt, 0, 0);
    }
    lenses.forEach((lens, index) => {
      lens.emissive.copy(colorFor(index));
      lens.emissiveIntensity = on ? 3 : 0;
    });
  }

  return {
    setLights(next) {
      lights = next;
      apply();
    },
    useLenses(root) {
      const found = new Set<MeshStandardMaterial>();
      root.traverse((object) => {
        const material = (object as Mesh).material as MeshStandardMaterial | undefined;
        if (material?.name === 'lens') found.add(material);
      });
      lenses = [...found];
      apply();
    },
    update(seconds, level) {
      if (lights.mode !== 'show' || reducedMotion) return false;
      time += seconds;
      const pulse = 0.9 + level * 1.2; // without music the beams still sweep; the kick drum makes them flash
      for (const beam of beams) {
        const phase = time * 0.7 + beam.index * 0.55;
        beam.pivot.rotation.set(BEAM.tilt + Math.sin(phase * 0.8) * 0.18, 0, Math.sin(phase) * 0.35);
        beam.material.opacity = 0.05 * pulse;
      }
      // With several colours the beams also step through them, a step every few seconds.
      if (palette.length > 1) {
        const step = Math.floor(time / 2.5);
        for (const beam of beams) beam.material.color.copy(colorFor(beam.slot + step));
      }
      for (const spot of spots) spot.intensity = 180 + 220 * level;
      for (const lens of lenses) lens.emissiveIntensity = 2 + 4 * level;
      return true;
    },
    dispose() {
      beamGeometry.dispose();
      for (const beam of beams) beam.material.dispose();
    },
  };
}
