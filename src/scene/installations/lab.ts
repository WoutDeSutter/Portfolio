import { Group, LineBasicMaterial, Vector3 } from 'three';
import { getProjectsByKind } from '../../content/content';
import type { Interactive } from '../interactive';
import { createBox, type PrevizMaterials } from '../objects/previz';
import type { SceneColors } from '../theme';
import type { Installation } from './types';

const BENCH = { width: 4.2, height: 0.9, depth: 1.1, z: -1.4, top: 0.06, leg: 0.06 };
const PEGBOARD = { height: 1.3, z: -2.05 };
const ITEM = { size: 0.34, spacing: 0.62 };
/** Camera on a LAB entry's page, relative to its object on the bench. */
const FOCUS = { position: new Vector3(0.3, 0.9, 1.7), lookAt: new Vector3(0, 0.1, 0) };

/** Lab: a workbench with a pegboard. Every LAB entry from projects.json is a small object on the bench. */
export function createLabInstallation(colors: SceneColors, materials: PrevizMaterials): Installation {
  const group = new Group();
  const interactives: Interactive[] = [];

  const top = createBox(BENCH.width, BENCH.top, BENCH.depth, materials);
  top.position.set(0, BENCH.height - BENCH.top, BENCH.z);
  group.add(top);

  const legX = BENCH.width / 2 - 0.1;
  const legZ = BENCH.depth / 2 - 0.1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = createBox(BENCH.leg, BENCH.height - BENCH.top, BENCH.leg, materials);
    leg.position.set(sx * legX, 0, BENCH.z + sz * legZ);
    group.add(leg);
  }

  const pegboard = createBox(BENCH.width, PEGBOARD.height, 0.04, materials);
  pegboard.position.set(0, BENCH.height, PEGBOARD.z);
  group.add(pegboard);

  const experiments = getProjectsByKind('lab');
  experiments.forEach((project, index) => {
    const edge = new LineBasicMaterial({ color: colors.lineStrong });
    const item = createBox(ITEM.size, ITEM.size, ITEM.size, materials, edge);
    const x = (index - (experiments.length - 1) / 2) * ITEM.spacing;
    item.position.set(x, BENCH.height, BENCH.z);
    group.add(item);

    interactives.push({
      hitArea: item,
      path: `/projects/${project.slug}`,
      labelKey: `projects.${project.slug}.title`,
      slug: project.slug,
      focus: {
        position: item.position.clone().add(FOCUS.position),
        lookAt: item.position.clone().add(FOCUS.lookAt),
      },
      setHighlighted: (on) => edge.color.copy(on ? colors.accent : colors.lineStrong),
    });
  });

  return { group, interactives };
}
