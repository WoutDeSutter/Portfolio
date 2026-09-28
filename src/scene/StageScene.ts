import { gsap } from 'gsap';
import {
  Fog,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { TRAVEL_DURATION } from '../stations/cameraViews';
import { ENTRY, STATIONS, findStation, type StationId } from '../stations/stations';
import { createAboutInstallation } from './installations/about';
import { createContactInstallation } from './installations/contact';
import { createLabInstallation } from './installations/lab';
import type { Installation } from './installations/types';
import { createWorkInstallation } from './installations/work';
import type { CameraHeading, HoverInfo, Interactive } from './interactive';
import { BASE_FOV, cameraTargets, frameCamera, stationPosition } from './layout';
import { createFloor } from './objects/floor';
import { createFollowSpot } from './objects/followSpot';
import { createPrevizMaterials } from './objects/previz';
import { createSpikeMark, createTapeStrip } from './objects/tape';
import { readSceneColors } from './theme';

export type StageSceneOptions = {
  initialStation: StationId;
  /** Slug of the project whose page is open when the scene starts. */
  initialProject?: string;
  reducedMotion: boolean;
  /** Called when the visitor clicks a station mark or a project in the scene. */
  onNavigate: (path: string) => void;
  /** Called when the hovered object changes, to show a label next to the cursor. */
  onHover: (info: HoverInfo | null) => void;
  /** Called when the camera sets off to a new view, so the floor plan can show it. */
  onHeadingChange: (heading: CameraHeading) => void;
};

export type StageScene = {
  /** Travel to a station; with a project slug, focus on that project's object there. */
  goTo: (id: StationId, projectSlug?: string) => void;
  dispose: () => void;
};

const MARK_SIZE = 2;
const HIT_SIZE = 3;
const PARALLAX = { x: 0.5, y: 0.25, smoothing: 0.05 };
const OPACITY = {
  current: 1,
  hovered: 0.85,
  idle: 0.4,
  smoothing: 0.12,
};

type StationVisual = {
  id: StationId;
  markMaterial: MeshBasicMaterial;
  pathMaterial?: MeshBasicMaterial;
  paths: Mesh[];
  mark: Group;
};

/**
 * @param container Element the canvas is added to (fills the viewport).
 * @param freeArea Element marking the area right of the text column; the camera is framed on it.
 */
export function createStageScene(
  container: HTMLElement,
  freeArea: HTMLElement,
  options: StageSceneOptions,
): StageScene {
  const { reducedMotion, onNavigate, onHover, onHeadingChange } = options;
  const colors = readSceneColors();

  // Renderer, scene, camera
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(colors.bg);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  // Fog in the background color makes the stage fade into darkness, like a black box.
  // Far enough for the entry overview (~40 units away) to stay visible.
  scene.fog = new Fog(colors.bg, 20, 62);

  const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 100);

  // Floor
  const floor = createFloor(colors);
  scene.add(floor.group);

  // Stations: spike marks, tape paths from the entry and invisible click areas
  const interactives: Interactive[] = [];
  const entryPosition = stationPosition(ENTRY);
  const stations: StationVisual[] = STATIONS.map((station) => {
    const position = stationPosition(station);
    const markMaterial = new MeshBasicMaterial({ color: colors.accent, transparent: true });
    const mark = createSpikeMark(MARK_SIZE, markMaterial);
    mark.position.copy(position);
    scene.add(mark);

    const hitArea = new Mesh(
      new PlaneGeometry(HIT_SIZE, HIT_SIZE).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ visible: false }),
    );
    hitArea.position.copy(position);
    scene.add(hitArea);
    interactives.push({
      hitArea,
      path: station.path,
      labelKey: `stations.${station.id}`,
      stationId: station.id,
    });

    if (station === ENTRY) return { id: station.id, markMaterial, paths: [], mark };

    // The tape runs from the edge of the entry mark to the edge of the station mark.
    const direction = position.clone().sub(entryPosition).normalize();
    const inset = direction.clone().multiplyScalar(MARK_SIZE * 0.75);
    const pathMaterial = new MeshBasicMaterial({ color: colors.accent, transparent: true });
    const path = createTapeStrip(entryPosition.clone().add(inset), position.clone().sub(inset), pathMaterial);
    scene.add(path);

    return { id: station.id, markMaterial, pathMaterial, paths: [path], mark };
  });

  // Installations: the objects at each station (the entry is kept empty on purpose)
  const previz = createPrevizMaterials(colors);
  const installations: Partial<Record<StationId, Installation>> = {
    work: createWorkInstallation(colors, previz),
    lab: createLabInstallation(colors, previz),
    about: createAboutInstallation(previz),
    contact: createContactInstallation(colors, previz),
  };
  for (const [id, installation] of Object.entries(installations) as [StationId, Installation][]) {
    const origin = stationPosition(findStation(id));
    installation.group.position.copy(origin);
    scene.add(installation.group);
    for (const item of installation.interactives) {
      // Focus views are defined relative to the installation; convert them to world space.
      const focus = item.focus && {
        position: item.focus.position.clone().add(origin),
        lookAt: item.focus.lookAt.clone().add(origin),
      };
      interactives.push({ ...item, focus });
    }
  }

  const followSpot = createFollowSpot(colors);
  scene.add(followSpot);

  // Camera state: `cameraBase` and `lookTarget` are animated; parallax is added on top.
  let currentStation = options.initialStation;
  let hovered: Interactive | null = null;
  /** The project object whose page is open; it stays highlighted. */
  let selected: Interactive | null = null;
  const activated = new Set<StationId>();
  const cameraBase = new Vector3();
  const lookTarget = new Vector3();
  const pointer = new Vector2();
  const parallax = new Vector2();
  const gsapContext = gsap.context(() => {});

  /** Load an installation's heavier assets the first time the visitor arrives there. */
  function activate(id: StationId) {
    if (activated.has(id)) return;
    activated.add(id);
    installations[id]?.activate?.();
  }

  function refreshHighlight(item: Interactive | null) {
    item?.setHighlighted?.(item === hovered || item === selected);
  }

  /**
   * Move to a station — or, with a project slug, to that project's object at the station,
   * which then stays highlighted. `instant` skips the camera travel.
   */
  function travelTo(id: StationId, projectSlug: string | undefined, instant: boolean) {
    currentStation = id;
    activate(id);

    const previous = selected;
    selected = interactives.find((item) => item.slug !== undefined && item.slug === projectSlug) ?? null;
    refreshHighlight(previous);
    refreshHighlight(selected);

    const station = cameraTargets(id);
    const focus = selected?.focus;
    const target = focus ? { ...station, camera: focus.position, lookAt: focus.lookAt } : station;
    onHeadingChange({
      camera: { x: target.camera.x, z: target.camera.z },
      lookAt: { x: target.lookAt.x, z: target.lookAt.z },
    });

    gsapContext.add(() => {
      gsap.killTweensOf([cameraBase, lookTarget, followSpot.position]);
      if (instant) {
        cameraBase.copy(target.camera);
        lookTarget.copy(target.lookAt);
        followSpot.position.copy(target.station);
        return;
      }
      const tween = { duration: TRAVEL_DURATION, ease: 'power2.inOut' };
      gsap.to(cameraBase, { ...tween, x: target.camera.x, y: target.camera.y, z: target.camera.z });
      gsap.to(lookTarget, { ...tween, x: target.lookAt.x, y: target.lookAt.y, z: target.lookAt.z });
      gsap.to(followSpot.position, { ...tween, x: target.station.x, z: target.station.z });
    });
  }

  const goTo = (id: StationId, projectSlug?: string) => travelTo(id, projectSlug, reducedMotion);

  // Start at the initial view without travelling.
  travelTo(options.initialStation, options.initialProject, true);

  // Mark and path highlighting eases towards these values every frame.
  function targetOpacity(id: StationId): number {
    if (id === currentStation) return OPACITY.current;
    if (id === hovered?.stationId) return OPACITY.hovered;
    return OPACITY.idle;
  }

  function updateHighlights(smoothing: number) {
    for (const station of stations) {
      const target = targetOpacity(station.id);
      station.markMaterial.opacity += (target - station.markMaterial.opacity) * smoothing;
      if (station.pathMaterial) {
        station.pathMaterial.opacity += (target - station.pathMaterial.opacity) * smoothing;
      }
    }
  }
  updateHighlights(1);

  // Render loop
  renderer.setAnimationLoop(() => {
    if (!reducedMotion) parallax.lerp(pointer, PARALLAX.smoothing);
    camera.position.set(
      cameraBase.x + parallax.x * PARALLAX.x,
      cameraBase.y + parallax.y * PARALLAX.y,
      cameraBase.z,
    );
    camera.lookAt(lookTarget);
    updateHighlights(reducedMotion ? 1 : OPACITY.smoothing);
    renderer.render(scene, camera);
  });

  // Resize with the container and frame the camera on the free area right of the text.
  const resizeObserver = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    const containerLeft = container.getBoundingClientRect().left;
    const free = freeArea.getBoundingClientRect();
    frameCamera(camera, { width, height }, { left: free.left - containerLeft, width: free.width });
  });
  resizeObserver.observe(container);
  resizeObserver.observe(freeArea);

  // Pointer: parallax everywhere, hover + click on the canvas itself
  const raycaster = new Raycaster();
  const hitAreas = interactives.map((item) => item.hitArea);
  const canvas = renderer.domElement;

  function toNormalized(event: PointerEvent, target: Vector2) {
    const rect = canvas.getBoundingClientRect();
    target.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  /** The interactive under the pointer. Hits on child meshes are traced back to their hit area. */
  function interactiveAt(event: PointerEvent): Interactive | null {
    const point = new Vector2();
    toNormalized(event, point);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(hitAreas, true)[0];
    for (let object: Object3D | null = hit?.object ?? null; object; object = object.parent) {
      const match = interactives.find((item) => item.hitArea === object);
      if (match) return match;
    }
    return null;
  }

  /** Where you already are is not a link: the current station's mark and the open project. */
  const isActionable = (item: Interactive | null) =>
    item !== null && item.stationId !== currentStation && item !== selected;

  function setHovered(next: Interactive | null) {
    if (next === hovered) return;
    const previous = hovered;
    hovered = next;
    refreshHighlight(previous);
    refreshHighlight(hovered);
    canvas.style.cursor = hovered ? 'pointer' : '';
  }

  const onWindowPointerMove = (event: PointerEvent) => toNormalized(event, pointer);
  const onCanvasPointerMove = (event: PointerEvent) => {
    const item = interactiveAt(event);
    setHovered(isActionable(item) ? item : null);
    onHover(hovered ? { labelKey: hovered.labelKey, clientX: event.clientX, clientY: event.clientY } : null);
  };
  const onCanvasPointerLeave = () => {
    setHovered(null);
    onHover(null);
  };
  const onCanvasClick = (event: PointerEvent) => {
    const item = interactiveAt(event);
    if (!isActionable(item)) return;
    setHovered(null);
    onHover(null);
    onNavigate(item!.path);
  };

  window.addEventListener('pointermove', onWindowPointerMove);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerleave', onCanvasPointerLeave);
  canvas.addEventListener('click', onCanvasClick);

  // Intro: the stage "resolves" like a headset reading the room — grid first, then the tape rolls out.
  if (!reducedMotion) {
    gsapContext.add(() => {
      const gridMaterial = floor.grid.material as LineBasicMaterial;
      const boundaryMaterial = floor.boundary.material as LineDashedMaterial;
      const intro = gsap.timeline({ defaults: { ease: 'power2.out' } });
      intro.from(gridMaterial, { opacity: 0, duration: 1.2 }, 0);
      intro.from(boundaryMaterial, { opacity: 0, duration: 1.2 }, 0.2);
      intro.from(
        stations.map((station) => station.mark.scale),
        { x: 0, z: 0, duration: 0.6, stagger: 0.08 },
        0.3,
      );
      intro.from(
        stations.flatMap((station) => station.paths.map((path) => path.scale)),
        { x: 0, duration: 0.9, stagger: 0.12 },
        0.5,
      );
      intro.from(
        Object.values(installations).map((installation) => installation.group.scale),
        { y: 0.001, duration: 0.8, stagger: 0.1 },
        0.9,
      );
    });
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    gsapContext.revert();
    window.removeEventListener('pointermove', onWindowPointerMove);
    canvas.removeEventListener('pointermove', onCanvasPointerMove);
    canvas.removeEventListener('pointerleave', onCanvasPointerLeave);
    canvas.removeEventListener('click', onCanvasClick);

    // Free GPU memory: geometries, materials and textures are not garbage-collected automatically.
    scene.traverse((object) => {
      if (!('geometry' in object)) return; // meshes, lines and the grid
      const { geometry, material } = object as Mesh;
      geometry?.dispose();
      for (const item of Array.isArray(material) ? material : [material]) disposeMaterial(item);
    });
    renderer.dispose();
    canvas.remove();
  }

  return { goTo, dispose };
}

function disposeMaterial(material: Material | undefined) {
  if (!material) return;
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}
