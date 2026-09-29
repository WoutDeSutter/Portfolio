import { gsap } from 'gsap';
import { MathUtils, PerspectiveCamera, Spherical, Vector2, Vector3 } from 'three';

/** A camera position described around the point it looks at. */
export type View = {
  target: Vector3;
  /** Horizontal angle around the target (0 = camera on the +z side, towards the entrance). */
  theta: number;
  /** Angle from straight up (small = looking down steeply, π/2 = level). */
  phi: number;
  radius: number;
};

const LIMITS = {
  /** How far the visitor may drag sideways / up-down from the view, in radians. */
  theta: 0.75,
  phiMin: 0.35,
  phiMax: 1.45,
  zoomMin: 0.7,
  zoomMax: 1.3,
};
/**
 * Views are designed for a landscape area of this aspect ratio. When the visible area
 * (screen minus an open panel) is narrower — a phone, or a panel beside the world — the
 * camera steps back so the same things stay in frame.
 */
const DESIGN_ASPECT = 1.3;
export const BASE_FOV = 45;
/** First widen the field of view up to this, then step back (at most MAX_STEP_BACK ×). */
const MAX_FOV = 62;
const MAX_STEP_BACK = 1.8;
/** How much the camera "looks towards" the cursor. */
const LOOK = { theta: 0.1, phi: 0.05, smoothing: 0.06 };
const DRAG_SPEED = 0.005;
export const TRAVEL_DURATION = 1.4;

/**
 * Moves the camera in three layers:
 * 1. the view of the current place (animated when travelling),
 * 2. the visitor's drag/zoom offset (limited, reset when travelling),
 * 3. a gentle look towards the cursor.
 * Plus a view offset that keeps the target centred beside an open panel.
 */
export class CameraRig {
  private readonly state = { tx: 0, ty: 0, tz: 0, theta: 0, phi: 1, radius: 10 };
  private readonly user = { theta: 0, phi: 0, zoom: 1 };
  private readonly frame = { x: 0, y: 0 };
  private readonly look = new Vector2();
  private readonly spherical = new Spherical();
  private readonly lastPosition = new Vector3(Number.NaN, 0, 0);
  private readonly lastTarget = new Vector3();
  private lastFrame = { x: Number.NaN, y: 0, width: 0, height: 0 };

  constructor(private readonly reducedMotion: boolean) {}

  /** Travel to a view. Drag/zoom offsets fade out so the new place is framed as designed. */
  goTo(view: View, instant: boolean) {
    gsap.killTweensOf([this.state, this.user]);
    // Travel the short way round.
    const theta = this.state.theta + MathUtils.euclideanModulo(view.theta - this.state.theta + Math.PI, Math.PI * 2) - Math.PI;
    const to = { tx: view.target.x, ty: view.target.y, tz: view.target.z, theta, phi: view.phi, radius: view.radius };
    if (instant) {
      Object.assign(this.state, to);
      Object.assign(this.user, { theta: 0, phi: 0, zoom: 1 });
      return;
    }
    gsap.to(this.state, { ...to, duration: TRAVEL_DURATION, ease: 'power2.inOut' });
    gsap.to(this.user, { theta: 0, phi: 0, zoom: 1, duration: TRAVEL_DURATION * 0.6, ease: 'power2.out' });
  }

  /** Visitor dragged by (dx, dy) pixels. */
  drag(dx: number, dy: number) {
    gsap.killTweensOf(this.user);
    this.user.theta = MathUtils.clamp(this.user.theta - dx * DRAG_SPEED, -LIMITS.theta, LIMITS.theta);
    this.user.phi = MathUtils.clamp(this.user.phi - dy * DRAG_SPEED, -0.5, 0.5);
  }

  /** Visitor scrolled; positive = zoom out. */
  zoom(delta: number) {
    this.user.zoom = MathUtils.clamp(this.user.zoom * (1 + delta * 0.001), LIMITS.zoomMin, LIMITS.zoomMax);
  }

  /** Keep the target centred in the area left of / above an open panel (pixels it covers). */
  setFrame(right: number, bottom: number, instant: boolean) {
    const to = { x: right / 2, y: bottom / 2 };
    gsap.killTweensOf(this.frame);
    if (instant) Object.assign(this.frame, to);
    else gsap.to(this.frame, { ...to, duration: 0.6, ease: 'power2.out' });
  }

  /**
   * Places the camera for this frame. `pointer` is the cursor in -1…1.
   * Returns whether anything changed, so the world only renders when needed.
   */
  update(camera: PerspectiveCamera, pointer: Vector2, width: number, height: number): boolean {
    if (!this.reducedMotion) {
      this.look.lerp(pointer, LOOK.smoothing);
      // Snap the last tiny bit, otherwise the easing never quite arrives and the world keeps rendering.
      if (this.look.distanceToSquared(pointer) < 1e-8) this.look.copy(pointer);
    }

    const target = new Vector3(this.state.tx, this.state.ty, this.state.tz);
    const visibleAspect = Math.max(width - this.frame.x * 2, 1) / Math.max(height - this.frame.y * 2, 1);
    const needed = Math.max(DESIGN_ASPECT / visibleAspect, 1); // how much wider the view must become
    const fovGain = Math.min(needed, Math.tan(MathUtils.degToRad(MAX_FOV / 2)) / Math.tan(MathUtils.degToRad(BASE_FOV / 2)));
    const fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(BASE_FOV / 2)) * fovGain));
    const stepBack = Math.min(needed / fovGain, MAX_STEP_BACK);
    this.spherical.set(
      this.state.radius * this.user.zoom * stepBack,
      MathUtils.clamp(this.state.phi + this.user.phi + this.look.y * LOOK.phi, LIMITS.phiMin, LIMITS.phiMax),
      this.state.theta + this.user.theta - this.look.x * LOOK.theta,
    );
    const position = new Vector3().setFromSpherical(this.spherical).add(target);

    const frameChanged =
      fov !== camera.fov ||
      this.frame.x !== this.lastFrame.x ||
      this.frame.y !== this.lastFrame.y ||
      width !== this.lastFrame.width ||
      height !== this.lastFrame.height;
    const moved = !position.equals(this.lastPosition) || !target.equals(this.lastTarget);
    if (!moved && !frameChanged) return false;

    camera.position.copy(position);
    camera.lookAt(target);
    if (frameChanged) {
      // The projection is made for the visible area only (the screen minus the panel), and the
      // canvas shows that image plus the strip behind the panel. So a bottom sheet doesn't zoom
      // the view in: the place stays framed in the part of the screen that is still visible.
      const visibleWidth = Math.max(width - this.frame.x * 2, 1);
      const visibleHeight = Math.max(height - this.frame.y * 2, 1);
      if (this.frame.x || this.frame.y) camera.setViewOffset(visibleWidth, visibleHeight, 0, 0, width, height);
      else camera.clearViewOffset();
      camera.aspect = visibleWidth / visibleHeight;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    this.lastPosition.copy(position);
    this.lastTarget.copy(target);
    this.lastFrame = { x: this.frame.x, y: this.frame.y, width, height };
    return true;
  }

  dispose() {
    gsap.killTweensOf([this.state, this.user, this.frame]);
  }
}
