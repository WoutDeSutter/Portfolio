import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { WorldColors } from './theme';

const PIXELS_PER_METRE = 160;

/**
 * A flat sign (booth board, LED wall, entrance banner) whose text is drawn on a canvas.
 * Text comes from the translation files, so it is set from outside with setText().
 */
export class Sign {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private lines: string[] = [];
  private highlighted = false;

  constructor(
    width: number,
    height: number,
    private readonly colors: WorldColors,
  ) {
    this.canvas.width = Math.round(width * PIXELS_PER_METRE);
    this.canvas.height = Math.round(height * PIXELS_PER_METRE);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: this.texture }));
  }

  /** One or more lines; the first line is large, the others smaller. */
  setText(...lines: string[]) {
    this.lines = lines;
    this.draw();
  }

  setHighlighted(highlighted: boolean) {
    if (highlighted === this.highlighted) return;
    this.highlighted = highlighted;
    this.draw();
  }

  /** Redraw, e.g. after the web fonts finished loading. */
  draw() {
    const { width, height } = this.canvas;
    const context = this.canvas.getContext('2d')!;
    const accent = `#${this.colors.accent.getHexString()}`;

    context.fillStyle = '#0d0d0d';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = this.highlighted ? accent : '#3d3d3d';
    context.lineWidth = Math.max(4, height * 0.04);
    context.strokeRect(0, 0, width, height);

    const [title = '', ...rest] = this.lines;
    const titleSize = rest.length ? height * 0.36 : height * 0.5;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = this.highlighted ? accent : '#f2f2ef';
    context.font = `500 ${fitFontSize(context, title, titleSize, width * 0.86)}px "IBM Plex Sans", system-ui, sans-serif`;
    context.fillText(title.toUpperCase(), width / 2, rest.length ? height * 0.4 : height / 2);

    if (rest.length) {
      context.fillStyle = accent;
      const subtitle = rest.join(' · ');
      context.font = `400 ${fitFontSize(context, subtitle, height * 0.16, width * 0.86, 'mono')}px "IBM Plex Mono", ui-monospace, monospace`;
      context.fillText(subtitle.toUpperCase(), width / 2, height * 0.72);
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}

/** Largest font size (up to `max`) at which `text` fits in `maxWidth`. */
function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  max: number,
  maxWidth: number,
  family: 'sans' | 'mono' = 'sans',
): number {
  const font = family === 'mono' ? '"IBM Plex Mono", monospace' : '"IBM Plex Sans", sans-serif';
  context.font = `500 ${max}px ${font}`;
  const width = context.measureText(text.toUpperCase()).width;
  return width > maxWidth ? Math.floor((max * maxWidth) / width) : max;
}
