import { Group } from 'three';
import { createBox, mergeStatic, type PrevizMaterials } from '../objects/previz';
import type { Installation } from './types';

const DESK = { width: 2.6, height: 0.8, depth: 1.2, z: -1.2 };
const CONSOLE = { tilt: -0.22, faders: 14 };

/** About: a front-of-house desk with a mixing console — where the show is run from. */
export function createAboutInstallation(materials: PrevizMaterials): Installation {
  const group = new Group();

  const desk = createBox(DESK.width, DESK.height, DESK.depth, materials);
  desk.position.z = DESK.z;
  group.add(desk);

  // The console surface tilts towards the operator; faders are its children so they tilt along.
  const mixer = new Group();
  mixer.position.set(0, DESK.height, DESK.z);
  mixer.rotation.x = CONSOLE.tilt;
  const surface = createBox(DESK.width - 0.2, 0.06, DESK.depth - 0.15, materials);
  mixer.add(surface);

  const channelWidth = (DESK.width - 0.5) / CONSOLE.faders;
  for (let i = 0; i < CONSOLE.faders; i++) {
    const fader = createBox(0.03, 0.02, 0.36, materials);
    fader.position.set(-(DESK.width - 0.5) / 2 + channelWidth * (i + 0.5), 0.06, 0.2);
    mixer.add(fader);
    const knob = createBox(0.08, 0.04, 0.05, materials);
    knob.position.set(fader.position.x, 0.08, 0.2 - 0.12 + ((i * 7) % 5) * 0.05);
    mixer.add(knob);
  }
  group.add(mixer);

  // A small monitor on the back of the desk
  const monitor = createBox(0.8, 0.5, 0.05, materials);
  monitor.position.set(DESK.width / 2 - 0.6, DESK.height + 0.15, DESK.z - DESK.depth / 2 + 0.1);
  group.add(monitor);

  mergeStatic(group, materials);
  return { group, interactives: [] };
}
