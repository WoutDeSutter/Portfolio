import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { getProjectsByKind } from '../../content/content';
import type { Project } from '../../content/types';
import type { Interactive } from '../interactive';
import { createBox, type PrevizMaterials } from '../objects/previz';
import { createTestPatternTexture } from '../textures';
import type { SceneColors } from '../theme';
import type { Installation } from './types';

/**
 * Featured screens stand one behind the other, like a corridor: each next project is
 * further back (and fades into the fog), so the installation grows in depth, not width.
 */
const SCREEN = { width: 3.2, height: 1.8, bottom: 0.9, firstX: -0.6, firstZ: -2.6, stepX: 1.6, stepZ: -3.6 };
/** Projectors hang from a pipe above the stage, in front of their screen. */
const PROJECTOR = { height: 3.4, throw: 3.6, pipeHeight: 3.8 };
/** Smaller projects are flight cases in a line along the right side. */
const CASE = { width: 1.1, height: 0.7, depth: 0.8, x: 3.4, firstZ: 1.6, stepZ: -1.2 };
const BEAM_OPACITY = { idle: 0.05, highlighted: 0.12 };
/**
 * Camera on a project page, relative to the object: in front and slightly to the right,
 * far enough that the object stays right of the text column (checked at 1440×900).
 */
const FOCUS = {
  screen: { position: new Vector3(2.2, 3.2, 9.5), lookAt: new Vector3(0, 1.8, 0) },
  flightCase: { position: new Vector3(2.4, 2.6, 4.2), lookAt: new Vector3(0, 0.35, 0) },
};

export function createWorkInstallation(colors: SceneColors, materials: PrevizMaterials): Installation {
  const group = new Group();
  const interactives: Interactive[] = [];
  const screens: { project: Project; surface: MeshBasicMaterial }[] = [];

  const featured = getProjectsByKind('featured');
  featured.forEach((project, index) => {
    const position = new Vector3(
      SCREEN.firstX + index * SCREEN.stepX,
      0,
      SCREEN.firstZ + index * SCREEN.stepZ,
    );
    const { object, interactive, surface } = createProjection(project, colors, materials);
    object.position.copy(position);
    group.add(object);
    interactives.push({
      ...interactive,
      focus: {
        position: position.clone().add(FOCUS.screen.position),
        lookAt: position.clone().add(FOCUS.screen.lookAt),
      },
    });
    screens.push({ project, surface });
  });

  // One pipe over all projectors
  if (featured.length > 0) {
    const firstZ = SCREEN.firstZ + PROJECTOR.throw;
    const lastZ = firstZ + (featured.length - 1) * SCREEN.stepZ;
    const pipe = createBox(0.06, 0.06, firstZ - lastZ + 1.2, materials);
    pipe.position.set(
      SCREEN.firstX + ((featured.length - 1) * SCREEN.stepX) / 2,
      PROJECTOR.pipeHeight,
      (firstZ + lastZ) / 2,
    );
    // The pipe runs diagonally along the projectors
    pipe.rotation.y = Math.atan2(SCREEN.stepX, -SCREEN.stepZ);
    group.add(pipe);
  }

  getProjectsByKind('project').forEach((project, index) => {
    const edge = new LineBasicMaterial({ color: colors.lineStrong });
    const flightCase = createBox(CASE.width, CASE.height, CASE.depth, materials, edge);
    // Lid seam: a thin band near the top, as on a real road case
    const lid = createBox(CASE.width + 0.02, 0.02, CASE.depth + 0.02, materials, edge);
    lid.position.y = CASE.height * 0.72;
    flightCase.add(lid);
    flightCase.position.set(CASE.x, 0, CASE.firstZ + index * CASE.stepZ);
    group.add(flightCase);

    interactives.push({
      hitArea: flightCase,
      path: `/projects/${project.slug}`,
      labelKey: `projects.${project.slug}.title`,
      slug: project.slug,
      focus: {
        position: flightCase.position.clone().add(FOCUS.flightCase.position),
        lookAt: flightCase.position.clone().add(FOCUS.flightCase.lookAt),
      },
      setHighlighted: (on) => edge.color.copy(on ? colors.accent : colors.lineStrong),
    });
  });

  // Hero images load only when the visitor first arrives at Work.
  const activate = () => {
    const loader = new TextureLoader();
    for (const { project, surface } of screens) {
      const hero = project.media.find((item) => item.type === 'image');
      if (!hero) continue;
      loader.load(hero.src, (texture) => {
        texture.colorSpace = SRGBColorSpace;
        surface.map?.dispose();
        surface.map = texture;
        surface.needsUpdate = true;
      });
    }
  };

  return { group, interactives, activate };
}

/** A screen on legs with a projector hanging in front of it. Built at the origin. */
function createProjection(project: Project, colors: SceneColors, materials: PrevizMaterials) {
  const object = new Group();
  const frameEdge = new LineBasicMaterial({ color: colors.lineStrong });

  const frame = createBox(SCREEN.width + 0.12, SCREEN.height + 0.12, 0.06, materials, frameEdge);
  frame.position.set(0, SCREEN.bottom - 0.06, -0.04);
  object.add(frame);
  for (const side of [-1, 1]) {
    const leg = createBox(0.06, SCREEN.bottom, 0.06, materials);
    leg.position.set((side * SCREEN.width) / 2.2, 0, -0.04);
    object.add(leg);
  }

  const surface = new MeshBasicMaterial({
    map: createTestPatternTexture({
      bg: `#${colors.bg.getHexString()}`,
      line: `#${colors.lineStrong.getHexString()}`,
      accent: `#${colors.accent.getHexString()}`,
    }),
    // Slightly dimmed, like a projection in a dark room, so bright images don't outshine the text.
    color: colors.text.clone().multiplyScalar(0.6),
  });
  const screen = new Mesh(new PlaneGeometry(SCREEN.width, SCREEN.height), surface);
  screen.position.set(0, SCREEN.bottom + SCREEN.height / 2, 0.001);
  object.add(screen);

  // Projector hanging from the pipe, tilted down towards the screen
  const hanger = createBox(0.04, PROJECTOR.pipeHeight - PROJECTOR.height, 0.04, materials);
  hanger.position.set(0, PROJECTOR.height, PROJECTOR.throw);
  object.add(hanger);
  const projector = createBox(0.5, 0.24, 0.42, materials, frameEdge);
  projector.position.set(0, PROJECTOR.height - 0.24, PROJECTOR.throw);
  object.add(projector);

  // Light beam: a pyramid from the lens to the four screen corners
  const lens = new Vector3(0, PROJECTOR.height - 0.12, PROJECTOR.throw - 0.22);
  const beamMaterial = new MeshBasicMaterial({
    color: colors.text,
    transparent: true,
    opacity: BEAM_OPACITY.idle,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  object.add(new Mesh(createBeamGeometry(lens), beamMaterial));

  const interactive: Interactive = {
    hitArea: screen,
    path: `/projects/${project.slug}`,
    labelKey: `projects.${project.slug}.title`,
    slug: project.slug,
    setHighlighted: (on) => {
      frameEdge.color.copy(on ? colors.accent : colors.lineStrong);
      beamMaterial.opacity = on ? BEAM_OPACITY.highlighted : BEAM_OPACITY.idle;
    },
  };

  return { object, interactive, surface };
}

function createBeamGeometry(lens: Vector3): BufferGeometry {
  const halfWidth = SCREEN.width / 2;
  const top = SCREEN.bottom + SCREEN.height;
  const corners = [
    [-halfWidth, SCREEN.bottom, 0],
    [halfWidth, SCREEN.bottom, 0],
    [halfWidth, top, 0],
    [-halfWidth, top, 0],
  ];
  const positions: number[] = [];
  for (let i = 0; i < 4; i++) {
    positions.push(lens.x, lens.y, lens.z, ...corners[i], ...corners[(i + 1) % 4]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}
