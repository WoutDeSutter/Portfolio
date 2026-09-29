import {
  AnimationMixer,
  Box3,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OPENABLE_PLACES, PLACES, findPlace, type Place, type PlaceId } from '../festival/places';
import { Board, type BoardContent, type BoardRow } from './board';
import {
  createBooth,
  createEntrance,
  createFoh,
  createGreyboxMaterials,
  createGround,
  createStage,
  type PlaceObject,
} from './greybox';
import { getLevel, setSpatializer } from '../audio/music';
import type { LightState } from '../festival/lights';
import { loadItem } from './items';
import { loadModels, loadTerrain, type ModelName, type Models } from './models';
import { BASE_FOV, CameraRig, type View } from './rig';
import { createFohDesk, type FohAction, type FohLabels, type FohState } from './fohDesk';
import type { CanvasScreen, Hotspot } from './screen';
import { createStageShow } from './show';
import { createSky } from './sky';
import { createSpeakers } from './speakers';
import { readWorldColors } from './theme';

export type HoverInfo = { labelKey: string; clientX: number; clientY: number };

/** Text shown in the world: booth signs, the boards inside the booths, and the identity on the arch / LED wall. */
export type WorldLabels = {
  places: Record<PlaceId, string>;
  boards: Partial<Record<PlaceId, BoardContent>>;
  /** Tracks and texts on the FOH desk screens. */
  foh: FohLabels;
  name: string;
  role: string;
};

export type WorldOptions = {
  initialPlace: PlaceId;
  labels: WorldLabels;
  reducedMotion: boolean;
  /** Visitor clicked a place (or empty ground while a place is open → the overview). */
  onNavigate: (path: string) => void;
  onHover: (info: HoverInfo | null) => void;
  /** Visitor used a screen on the FOH desks (play a track, pick a light colour, …). */
  onFoh: (action: FohAction) => void;
};

export type FestivalWorld = {
  goTo: (id: PlaceId) => void;
  /** Stage lights, set at the lighting desk. */
  setLights: (lights: LightState) => void;
  /** What the FOH desk screens show: the playing track and the lights. */
  setFohState: (state: FohState) => void;
  /** Put a project's animated model on the counter of a booth (or clear it with null). */
  showItem: (id: PlaceId, path: string | null) => void;
  /** Pixels covered by an open panel on the right / at the bottom. */
  setFrame: (right: number, bottom: number) => void;
  setLabels: (labels: WorldLabels) => void;
  /** Resolves once shaders are compiled and the first frame is drawn. */
  ready: Promise<void>;
  dispose: () => void;
};

/** The overview from behind the entrance, looking over the whole terrain towards the stage. */
const OVERVIEW: View = { target: new Vector3(0, 1, -2), theta: 0, phi: 0.95, radius: 36 };
const CLICK_TOLERANCE = 5; // pixels a pointer may move and still count as a click
/** The board on the back wall of each booth (local position; matches board_frame() in build_festival.py). */
const BOARD = { y: 1.85, z: -1.045, height: 1.25 };
const BOARD_WIDTH: Partial<Record<PlaceId, number>> = { merch: 1.9 };
/** Where a project's item stands on the counter (local; the tray / coaster in the Blender interiors). */
const ITEM_SPOT: Partial<Record<PlaceId, Vector3>> = {
  projects: new Vector3(1.15, 1.04, 1.02),
  lab: new Vector3(1.0, 1.04, 1.02),
};
/** Items slowly turn on their tray, radians per second. */
const TURNTABLE_SPEED = 0.35;
/** Items are scaled to fit this space on the counter (taller would hide the board behind it). */
const ITEM_FIT = { width: 0.6, height: 0.5 };
const PINCH_SPEED = 3; // zoom per pixel the fingers move together/apart

export function createFestivalWorld(container: HTMLElement, options: WorldOptions): FestivalWorld {
  const { reducedMotion, onNavigate, onHover, onFoh } = options;
  const colors = readWorldColors();

  // Sharp (high-density) screens hardly show jagged edges, so antialiasing is only worth its cost below 2×.
  const renderer = new WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  // Phones get a lower pixel ratio: fewer pixels to fill, smoother on small GPUs.
  const maxPixelRatio = Math.min(window.innerWidth, window.innerHeight) < 600 ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.setClearColor(colors.bg);
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none'; // the world handles touch dragging itself
  container.appendChild(canvas);

  // Rendering on demand: a frame is only drawn when the camera moved or invalidate() was called.
  let needsRender = true;
  let disposed = false;
  const invalidate = () => {
    needsRender = true;
  };

  const scene = new Scene();
  // Far enough that the overview stays clear even when the camera steps back on a phone.
  scene.fog = new Fog(colors.bg, 60, 150);
  const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 200);

  // Night lighting: dim sky, a cool "moon", red light on the stage, warm light at the booths.
  scene.add(new HemisphereLight(0x8a95b8, 0x1a1a1a, 1.5));
  const moon = new DirectionalLight(0xb4c0ff, 0.7);
  moon.position.set(12, 25, 18);
  scene.add(moon);

  // Terrain
  const materials = createGreyboxMaterials(colors);
  const ground = createGround(materials);
  scene.add(ground);
  const sky = createSky(colors);
  scene.background = sky;

  const objects = new Map<PlaceId, PlaceObject>();
  for (const place of PLACES) {
    const object = buildPlace(place);
    object.group.position.set(place.x, 0, place.z);
    object.group.rotation.y = place.facing;
    scene.add(object.group);
    objects.set(place.id, object);
  }

  // Boards inside the booths (menu, tap list, …)
  const boards = new Map<PlaceId, Board>();
  for (const place of PLACES) {
    if (place.kind !== 'booth') continue;
    const board = new Board(BOARD_WIDTH[place.id] ?? 3.2, BOARD.height, colors);
    board.mesh.position.set(0, BOARD.y, BOARD.z);
    objects.get(place.id)!.group.add(board.mesh);
    boards.set(place.id, board);
  }

  function buildPlace(place: Place): PlaceObject {
    switch (place.kind) {
      case 'stage':
        return createStage(materials, colors);
      case 'foh':
        return createFoh(materials);
      case 'entrance':
        return createEntrance(materials, colors);
      default: {
        const booth = createBooth(materials, colors);
        const light = new PointLight(0xffc98a, 6, 7);
        light.position.set(0, 2.6, 2);
        booth.group.add(light);
        return booth;
      }
    }
  }

  // Blender models replace the greybox blocks once they have loaded (a failed model keeps its blocks).
  const MODEL_FOR: Record<Place['kind'], ModelName> = { booth: 'booth', stage: 'stage', foh: 'foh', entrance: 'entrance' };
  function applyModels(models: Models) {
    for (const place of PLACES) {
      const model = models[MODEL_FOR[place.kind]];
      const object = objects.get(place.id)!;
      if (!model) continue;
      object.group.remove(object.visual);
      disposeTree(object.visual);
      // Booths share one model: clones share its geometry and materials. Each adds its own interior.
      object.visual = model.clone();
      const interior = place.kind === 'booth' ? models[`booth_${place.id}` as ModelName] : undefined;
      if (interior) object.visual.add(interior);
      object.group.add(object.visual);
      if (place.kind === 'stage') show.useLenses(object.visual);
    }
  }

  // Stage lights (controlled from the FOH desk) and the speakers the FOH music plays from
  const stageObject = objects.get('about')!;
  const show = createStageShow(scene, stageObject.group, reducedMotion);
  const fohDesk = createFohDesk(objects.get('foh')!.group, reducedMotion);
  scene.updateMatrixWorld();
  const speakerPositions = (stageObject.speakers ?? []).map((position) => stageObject.group.localToWorld(position.clone()));
  setSpatializer(createSpeakers(scene, camera, speakerPositions));

  // Labels
  function applyLabels(labels: WorldLabels) {
    for (const [id, object] of objects) {
      if (id === 'entrance' || id === 'about') object.sign?.setText(labels.name, labels.role);
      else object.sign?.setText(labels.places[id]);
    }
    for (const [id, board] of boards) board.setContent(labels.boards[id] ?? { title: labels.places[id] });
    fohDesk.setLabels(labels.foh);
    invalidate();
  }
  let latestLabels = options.labels.foh;
  applyLabels(options.labels);
  // Signs use the web fonts; redraw once they are available.
  document.fonts?.ready.then(() => {
    for (const object of objects.values()) object.sign?.draw();
    for (const board of boards.values()) board.draw();
    fohDesk.setLabels(latestLabels);
    invalidate();
  });

  // Views per place
  function viewFor(id: PlaceId): View {
    if (id === 'entrance') return OVERVIEW;
    const place = findPlace(id);
    const object = objects.get(id)!;
    const target = object.focus.clone().applyAxisAngle(new Vector3(0, 1, 0), place.facing);
    target.add(new Vector3(place.x, 0, place.z));
    // FOH: inside the tent, behind the engineer, looking over the desk towards the stage.
    // Booths: almost at eye level, so the camera looks under the awning at the board inside.
    const phi = place.kind === 'foh' ? 1.38 : place.kind === 'stage' ? 1.3 : 1.44;
    return { target, theta: place.facing, phi, radius: place.viewDistance };
  }

  const rig = new CameraRig(reducedMotion);
  const pointer = new Vector2();
  let size = { width: 1, height: 1 };

  let currentPlace = options.initialPlace;
  rig.goTo(viewFor(currentPlace), true);

  // Project items on the counters. They only animate while their booth is open (and never with
  // reduced motion), so the world keeps rendering on demand the rest of the time.
  type ShownItem = { path: string; root: Object3D | null; mixer: AnimationMixer | null };
  const items = new Map<PlaceId, ShownItem>();
  let lastTime = performance.now();

  function showItem(id: PlaceId, path: string | null) {
    const spot = ITEM_SPOT[id];
    const current = items.get(id);
    if (!spot || (current?.path ?? null) === path) return;
    if (current?.root) {
      current.mixer?.stopAllAction();
      current.root.removeFromParent();
    }
    items.delete(id);
    invalidate();
    if (!path) return;
    const shown: ShownItem = { path, root: null, mixer: null };
    items.set(id, shown);
    loadItem(path)
      .then(({ scene: model, clips }) => {
        if (disposed || items.get(id) !== shown) return;
        const root = new Object3D();
        root.position.copy(spot);
        root.add(model);
        // Fit any model on the tray, whatever size it was made at in Blender (its rest pose).
        const bounds = new Box3().setFromObject(model);
        const extent = bounds.getSize(new Vector3());
        const fit = Math.min(ITEM_FIT.width / Math.max(extent.x, extent.z), ITEM_FIT.height / extent.y);
        model.scale.setScalar(Number.isFinite(fit) ? fit : 1);
        model.position.y = -bounds.min.y * model.scale.y;
        objects.get(id)!.group.add(root);
        shown.root = root;
        if (!reducedMotion && clips.length) {
          shown.mixer = new AnimationMixer(model);
          for (const clip of clips) shown.mixer.clipAction(clip).play();
        }
        invalidate();
      })
      .catch((error: unknown) => console.warn(`[world] Could not load item "${path}":`, error));
  }

  function updateItems(seconds: number): boolean {
    const shown = items.get(currentPlace);
    if (reducedMotion || !shown?.root) return false;
    shown.mixer?.update(seconds);
    shown.root.rotation.y += seconds * TURNTABLE_SPEED;
    return true;
  }

  function frame() {
    const now = performance.now();
    const seconds = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    const moved = rig.update(camera, pointer, size.width, size.height);
    const animated = updateItems(seconds);
    const level = getLevel();
    const lights = show.update(seconds, level);
    const meter = fohDesk.update(level, currentPlace === 'foh');
    if (!moved && !needsRender && !animated && !lights && !meter) return;
    renderer.render(scene, camera);
    needsRender = false;
  }

  const resizeObserver = new ResizeObserver(() => {
    size = { width: container.clientWidth || 1, height: container.clientHeight || 1 };
    renderer.setSize(size.width, size.height);
    invalidate();
  });
  resizeObserver.observe(container);

  // Hover, click and drag
  const raycaster = new Raycaster();
  const hitAreas = OPENABLE_PLACES.map((place) => objects.get(place.id)?.hitArea).filter(
    (area): area is Mesh => area !== undefined,
  );
  let hovered: PlaceId | null = null;
  let press: { x: number; y: number; lastX: number; lastY: number; dragged: boolean } | null = null;
  // Touch: every finger on the screen, so two of them can pinch to zoom.
  const touches = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  const touchDistance = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function toNormalized(event: PointerEvent, target: Vector2) {
    const rect = canvas.getBoundingClientRect();
    target.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  function placeAt(event: PointerEvent): PlaceId | null {
    const point = new Vector2();
    toNormalized(event, point);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(hitAreas, false)[0];
    if (!hit) return null;
    const place = OPENABLE_PLACES.find((candidate) => objects.get(candidate.id)?.hitArea === hit.object);
    return place?.id ?? null;
  }

  /** The clickable board row under the pointer, on the board of the booth that is open. */
  function boardRowAt(event: PointerEvent): { board: Board; row: BoardRow } | null {
    const board = boards.get(currentPlace);
    if (!board) return null;
    const point = new Vector2();
    toNormalized(event, point);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObject(board.mesh, false)[0];
    const row = hit?.uv ? board.rowAt(hit.uv) : null;
    return row ? { board, row } : null;
  }

  function setHoveredRow(target: { board: Board; row: BoardRow } | null) {
    const board = boards.get(currentPlace);
    if (board?.setHovered(target?.row ?? null)) invalidate();
  }

  /** The button under the pointer on the FOH desk screens, while the FOH is open. */
  function screenHotspotAt(event: PointerEvent): { screen: CanvasScreen; hotspot: Hotspot } | null {
    if (currentPlace !== 'foh') return null;
    const point = new Vector2();
    toNormalized(event, point);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(fohDesk.screens.map((screen) => screen.mesh), false)[0];
    const screen = fohDesk.screens.find((candidate) => candidate.mesh === hit?.object);
    const hotspot = screen && hit.uv ? screen.hotspotAt(hit.uv) : null;
    return screen && hotspot ? { screen, hotspot } : null;
  }

  function setHoveredScreen(target: { screen: CanvasScreen; hotspot: Hotspot } | null) {
    let changed = false;
    for (const screen of fohDesk.screens) {
      changed = screen.setHovered(screen === target?.screen ? target.hotspot.id : null) || changed;
    }
    if (changed) invalidate();
  }

  function setHovered(id: PlaceId | null, event?: PointerEvent) {
    if (id !== hovered) {
      if (hovered) objects.get(hovered)?.sign?.setHighlighted(false);
      if (id) objects.get(id)?.sign?.setHighlighted(true);
      hovered = id;
      canvas.style.cursor = id ? 'pointer' : '';
      invalidate();
    }
    onHover(id && event ? { labelKey: `places.${id}`, clientX: event.clientX, clientY: event.clientY } : null);
  }

  const onPointerDown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) {
        // A second finger: this is a pinch, not a tap or a drag.
        press = null;
        pinchDistance = touchDistance();
        return;
      }
      if (touches.size > 2) return;
    }
    press = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, dragged: false };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size >= 2) {
        const distance = touchDistance();
        rig.zoom((pinchDistance - distance) * PINCH_SPEED);
        pinchDistance = distance;
        return;
      }
    }
    // Touch has no cursor to follow: only a mouse makes the camera look around.
    if (event.pointerType === 'mouse') toNormalized(event, pointer);
    if (press) {
      if (!press.dragged && Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_TOLERANCE) {
        press.dragged = true;
        setHovered(null);
        canvas.style.cursor = 'grabbing';
      }
      if (press.dragged) rig.drag(event.clientX - press.lastX, event.clientY - press.lastY);
      press.lastX = event.clientX;
      press.lastY = event.clientY;
      return;
    }
    const row = boardRowAt(event);
    setHoveredRow(row);
    const button = screenHotspotAt(event);
    setHoveredScreen(button);
    if (row || button) {
      setHovered(null);
      canvas.style.cursor = 'pointer';
      return;
    }
    const id = placeAt(event);
    setHovered(id && id !== currentPlace ? id : null, event);
  };
  const onPointerUp = (event: PointerEvent) => {
    touches.delete(event.pointerId);
    const wasClick = press && !press.dragged;
    press = null;
    canvas.style.cursor = '';
    if (!wasClick) return;
    const row = boardRowAt(event);
    if (row?.row.path) {
      setHoveredRow(null);
      onNavigate(row.row.path);
      return;
    }
    const button = screenHotspotAt(event);
    if (button) {
      const action = fohDesk.press(button.hotspot);
      if (action) onFoh(action);
      invalidate();
      return;
    }
    const id = placeAt(event);
    if (id && id !== currentPlace) onNavigate(findPlace(id).path);
    else if (!id && currentPlace !== 'entrance') onNavigate('/');
  };
  const onPointerLeave = () => {
    if (press) return;
    setHovered(null);
    setHoveredRow(null);
    setHoveredScreen(null);
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    rig.zoom(event.deltaY);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Load the models, compile shaders ahead, then start rendering.
  const ready = loadModels()
    .then((models) => {
      if (!disposed) applyModels(models);
    })
    .then(() => renderer.compileAsync(scene, camera))
    .catch(() => {
      // Compiling ahead is an optimisation; if it fails, the first render compiles instead.
    })
    .then(() => {
      if (disposed) return;
      frame();
      renderer.setAnimationLoop(frame);
      // The landscape around the places is decoration: load it after the world is on screen.
      void loadTerrain().then((terrain) => {
        if (disposed || !terrain) return;
        scene.add(terrain);
        ground.visible = false;
        invalidate();
      });
      if (import.meta.env.DEV) {
        // Cost of one frame, to keep an eye on while adding models (dev only).
        const { calls, triangles } = renderer.info.render;
        console.info(`[world] ${calls} draw calls, ${triangles} triangles, ${renderer.info.memory.textures} textures`);
        (window as unknown as { __worldRenderer: WebGLRenderer }).__worldRenderer = renderer;
      }
    });

  // With reduced motion the camera does not fly; a short fade through the night softens the cut.
  // (Web Animations are not affected by the global reduced-motion CSS; a fade is not motion.)
  let fade: Animation | null = null;
  function cutTo(view: View) {
    fade?.cancel();
    fade = canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    const fadeOut = fade;
    fadeOut.finished
      .then(() => {
        rig.goTo(view, true);
        fade = canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
        fadeOut.cancel();
      })
      .catch(() => {
        // Cancelled by a newer goTo, which takes over.
      });
  }

  return {
    goTo(id) {
      setHoveredRow(null);
      currentPlace = id;
      setHovered(null);
      if (reducedMotion) cutTo(viewFor(id));
      else rig.goTo(viewFor(id), false);
    },
    showItem,
    setLights(lights) {
      show.setLights(lights);
      invalidate();
    },
    setFohState(state) {
      fohDesk.setState(state);
      invalidate();
    },
    setFrame(right, bottom) {
      rig.setFrame(right, bottom, reducedMotion);
    },
    setLabels(labels) {
      latestLabels = labels.foh;
      applyLabels(labels);
    },
    ready,
    dispose() {
      disposed = true;
      fade?.cancel();
      setSpatializer(null);
      show.dispose();
      fohDesk.dispose();
      renderer.setAnimationLoop(null);
      for (const shown of items.values()) shown.mixer?.stopAllAction();
      resizeObserver.disconnect();
      rig.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      for (const object of objects.values()) object.sign?.dispose();
      for (const board of boards.values()) board.dispose();
      disposeTree(scene);
      sky.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

/** Disposes every geometry, material and texture below `root` (shared ones may be disposed twice; that is harmless). */
function disposeTree(root: Object3D) {
  root.traverse((object: Object3D) => {
    if (!('geometry' in object)) return;
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) disposeMaterial(material);
  });
}

function disposeMaterial(material: Material | undefined) {
  if (!material) return;
  for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
  material.dispose();
}
