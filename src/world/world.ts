import {
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
  SpotLight,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OPENABLE_PLACES, PLACES, findPlace, type Place, type PlaceId } from '../festival/places';
import {
  createBooth,
  createEntrance,
  createFoh,
  createGreyboxMaterials,
  createGround,
  createStage,
  type PlaceObject,
} from './greybox';
import { BASE_FOV, CameraRig, type View } from './rig';
import { readWorldColors } from './theme';

export type HoverInfo = { labelKey: string; clientX: number; clientY: number };

/** Text shown in the world: booth signs and the identity on the arch / LED wall. */
export type WorldLabels = {
  places: Record<PlaceId, string>;
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
};

export type FestivalWorld = {
  goTo: (id: PlaceId) => void;
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
const PINCH_SPEED = 3; // zoom per pixel the fingers move together/apart

export function createFestivalWorld(container: HTMLElement, options: WorldOptions): FestivalWorld {
  const { reducedMotion, onNavigate, onHover } = options;
  const colors = readWorldColors();

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
  scene.add(createGround(materials));

  const objects = new Map<PlaceId, PlaceObject>();
  for (const place of PLACES) {
    const object = buildPlace(place);
    object.group.position.set(place.x, 0, place.z);
    object.group.rotation.y = place.facing;
    scene.add(object.group);
    objects.set(place.id, object);
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

  // Red stage light from the truss
  const stage = findPlace('about');
  for (const x of [-5, 5]) {
    const spot = new SpotLight(colors.accent, 250, 25, 0.45, 0.6);
    spot.position.set(stage.x + x, 9, stage.z + 3);
    spot.target.position.set(stage.x + x * 0.3, 1.4, stage.z);
    scene.add(spot, spot.target);
  }

  // Labels
  function applyLabels(labels: WorldLabels) {
    for (const [id, object] of objects) {
      if (id === 'entrance' || id === 'about') object.sign?.setText(labels.name, labels.role);
      else object.sign?.setText(labels.places[id]);
    }
    invalidate();
  }
  applyLabels(options.labels);
  // Signs use the web fonts; redraw once they are available.
  document.fonts?.ready.then(() => {
    for (const object of objects.values()) object.sign?.draw();
    invalidate();
  });

  // Views per place
  function viewFor(id: PlaceId): View {
    if (id === 'entrance') return OVERVIEW;
    const place = findPlace(id);
    const object = objects.get(id)!;
    const target = object.focus.clone().applyAxisAngle(new Vector3(0, 1, 0), place.facing);
    target.add(new Vector3(place.x, 0, place.z));
    const phi = place.kind === 'foh' ? 1.05 : place.kind === 'stage' ? 1.3 : 1.25;
    return { target, theta: place.facing, phi, radius: place.viewDistance };
  }

  const rig = new CameraRig(reducedMotion);
  const pointer = new Vector2();
  let size = { width: 1, height: 1 };

  let currentPlace = options.initialPlace;
  rig.goTo(viewFor(currentPlace), true);

  function frame() {
    const moved = rig.update(camera, pointer, size.width, size.height);
    if (!moved && !needsRender) return;
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
    const id = placeAt(event);
    setHovered(id && id !== currentPlace ? id : null, event);
  };
  const onPointerUp = (event: PointerEvent) => {
    touches.delete(event.pointerId);
    const wasClick = press && !press.dragged;
    press = null;
    canvas.style.cursor = '';
    if (!wasClick) return;
    const id = placeAt(event);
    if (id && id !== currentPlace) onNavigate(findPlace(id).path);
    else if (!id && currentPlace !== 'entrance') onNavigate('/');
  };
  const onPointerLeave = () => {
    if (!press) setHovered(null);
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

  // Compile shaders ahead, then start rendering.
  const ready = renderer
    .compileAsync(scene, camera)
    .catch(() => {
      // Compiling ahead is an optimisation; if it fails, the first render compiles instead.
    })
    .then(() => {
      if (disposed) return;
      frame();
      renderer.setAnimationLoop(frame);
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
      currentPlace = id;
      setHovered(null);
      if (reducedMotion) cutTo(viewFor(id));
      else rig.goTo(viewFor(id), false);
    },
    setFrame(right, bottom) {
      rig.setFrame(right, bottom, reducedMotion);
    },
    setLabels: applyLabels,
    ready,
    dispose() {
      disposed = true;
      fade?.cancel();
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      rig.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      for (const object of objects.values()) object.sign?.dispose();
      scene.traverse((object: Object3D) => {
        if (!('geometry' in object)) return;
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) disposeMaterial(material);
      });
      renderer.dispose();
      canvas.remove();
    },
  };
}

function disposeMaterial(material: Material | undefined) {
  if (!material) return;
  for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
  material.dispose();
}
