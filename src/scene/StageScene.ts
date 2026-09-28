import { gsap } from 'gsap';
import {
  Fog,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
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
import { ENTRY, STATIONS, type StationId } from '../stations/stations';
import { FRAME_SHIFT, FRAME_SHIFT_MIN_WIDTH, cameraTargets, stationPosition } from './layout';
import { createFloor } from './objects/floor';
import { createFollowSpot } from './objects/followSpot';
import { createSpikeMark, createTapeStrip } from './objects/tape';
import { readSceneColors } from './theme';

export type StageSceneOptions = {
  initialStation: StationId;
  reducedMotion: boolean;
  /** Called when the visitor clicks a station on the floor. */
  onSelectStation: (id: StationId) => void;
};

export type StageScene = {
  goTo: (id: StationId) => void;
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
  hitArea: Mesh;
  paths: Mesh[];
  mark: Group;
};

export function createStageScene(container: HTMLElement, options: StageSceneOptions): StageScene {
  const { reducedMotion, onSelectStation } = options;
  const colors = readSceneColors();

  // Renderer, scene, camera
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(colors.bg);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  // Fog in the background color makes the stage fade into darkness, like a black box.
  scene.fog = new Fog(colors.bg, 16, 44);

  const camera = new PerspectiveCamera(38, 1, 0.1, 100);

  // Floor
  const floor = createFloor(colors);
  scene.add(floor.group);

  // Stations: spike marks, tape paths from the entry and invisible click areas
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
    hitArea.userData.stationId = station.id;
    scene.add(hitArea);

    if (station === ENTRY) return { id: station.id, markMaterial, hitArea, paths: [], mark };

    // The tape runs from the edge of the entry mark to the edge of the station mark.
    const direction = position.clone().sub(entryPosition).normalize();
    const inset = direction.clone().multiplyScalar(MARK_SIZE * 0.75);
    const pathMaterial = new MeshBasicMaterial({ color: colors.accent, transparent: true });
    const path = createTapeStrip(entryPosition.clone().add(inset), position.clone().sub(inset), pathMaterial);
    scene.add(path);

    return { id: station.id, markMaterial, pathMaterial, hitArea, paths: [path], mark };
  });

  const followSpot = createFollowSpot(colors);
  scene.add(followSpot);

  // Camera state: `cameraBase` and `lookTarget` are animated; parallax is added on top.
  let currentStation = options.initialStation;
  let hoveredStation: StationId | null = null;
  const cameraBase = new Vector3();
  const lookTarget = new Vector3();
  const pointer = new Vector2();
  const parallax = new Vector2();
  const gsapContext = gsap.context(() => {});

  function goTo(id: StationId) {
    currentStation = id;
    const target = cameraTargets(id);

    gsapContext.add(() => {
      gsap.killTweensOf([cameraBase, lookTarget, followSpot.position]);
      if (reducedMotion) {
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

  // Start at the initial station without travelling.
  const initial = cameraTargets(currentStation);
  cameraBase.copy(initial.camera);
  lookTarget.copy(initial.lookAt);
  followSpot.position.copy(initial.station);

  // Mark and path highlighting eases towards these values every frame.
  function targetOpacity(id: StationId): number {
    if (id === currentStation) return OPACITY.current;
    if (id === hoveredStation) return OPACITY.hovered;
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

  // Resize with the container; on wide screens frame the stage to the right of the text.
  const resizeObserver = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    if (width >= FRAME_SHIFT_MIN_WIDTH) {
      camera.setViewOffset(width, height, -width * FRAME_SHIFT, 0, width, height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  // Pointer: parallax everywhere, hover + click on the canvas itself
  const raycaster = new Raycaster();
  const hitAreas = stations.map((station) => station.hitArea);
  const canvas = renderer.domElement;

  function toNormalized(event: PointerEvent, target: Vector2) {
    const rect = canvas.getBoundingClientRect();
    target.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function stationAt(event: PointerEvent): StationId | null {
    const point = new Vector2();
    toNormalized(event, point);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(hitAreas)[0];
    return hit ? (hit.object.userData.stationId as StationId) : null;
  }

  const onWindowPointerMove = (event: PointerEvent) => toNormalized(event, pointer);
  const onCanvasPointerMove = (event: PointerEvent) => {
    hoveredStation = stationAt(event);
    canvas.style.cursor = hoveredStation && hoveredStation !== currentStation ? 'pointer' : '';
  };
  const onCanvasPointerLeave = () => {
    hoveredStation = null;
    canvas.style.cursor = '';
  };
  const onCanvasClick = (event: PointerEvent) => {
    const id = stationAt(event);
    if (id && id !== currentStation) onSelectStation(id);
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
