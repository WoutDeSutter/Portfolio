import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Vector2 } from 'three';

/** A clickable area on a screen, in canvas pixels. */
export type Hotspot = { id: string; x: number; y: number; width: number; height: number };

/** Draws the screen; returns its clickable areas. `hovered` is the id of the hotspot under the pointer. */
export type DrawScreen = (context: CanvasRenderingContext2D, width: number, height: number, hovered: string | null) => Hotspot[];

const PIXELS_PER_METRE = 600;

/**
 * A screen in the world (the FOH desks) drawn on a canvas, with areas that can be hovered and
 * clicked like buttons. What it shows and does is decided by its draw function and its owner.
 */
export class CanvasScreen {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private hotspots: Hotspot[] = [];
  private hovered: string | null = null;

  constructor(
    width: number,
    height: number,
    private readonly drawScreen: DrawScreen,
  ) {
    this.canvas.width = Math.round(width * PIXELS_PER_METRE);
    this.canvas.height = Math.round(height * PIXELS_PER_METRE);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: this.texture, toneMapped: false }));
  }

  draw() {
    const context = this.canvas.getContext('2d')!;
    this.hotspots = this.drawScreen(context, this.canvas.width, this.canvas.height, this.hovered);
    this.texture.needsUpdate = true;
  }

  /** The hotspot at a point on the screen (texture coordinates from a raycast). */
  hotspotAt(uv: Vector2): Hotspot | null {
    const x = uv.x * this.canvas.width;
    const y = (1 - uv.y) * this.canvas.height;
    return this.hotspots.find((spot) => x >= spot.x && x < spot.x + spot.width && y >= spot.y && y < spot.y + spot.height) ?? null;
  }

  /** Returns whether the highlight changed (and the screen was redrawn). */
  setHovered(id: string | null): boolean {
    if (id === this.hovered) return false;
    this.hovered = id;
    this.draw();
    return true;
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
