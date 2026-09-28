import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Vector2 } from 'three';
import type { WorldColors } from './theme';

const PIXELS_PER_METRE = 320;

export type BoardRow = {
  label: string;
  /** Shown right-aligned, like the price on a menu (e.g. a project's status). */
  detail?: string;
  /** Route opened when the row is clicked. Rows without a path are not clickable. */
  path?: string;
};

export type BoardContent = {
  title: string;
  rows?: BoardRow[];
  /** Shown when there are no rows. */
  empty?: string;
  /** A large glyph instead of rows (the "i" of the info point). */
  icon?: string;
};

type RowRect = { top: number; bottom: number };

/**
 * The board on the back wall of a booth: the Projects menu, the Lab tap list, … Drawn on a
 * canvas from translated content, and rows with a path can be hovered and clicked.
 */
export class Board {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private content: BoardContent = { title: '' };
  private rowRects: RowRect[] = [];
  private hovered: number | null = null;

  constructor(
    width: number,
    height: number,
    private readonly colors: WorldColors,
  ) {
    this.canvas.width = Math.round(width * PIXELS_PER_METRE);
    this.canvas.height = Math.round(height * PIXELS_PER_METRE);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: this.texture }));
  }

  setContent(content: BoardContent) {
    this.content = content;
    this.hovered = null;
    this.draw();
  }

  /** The row under a point on the board (texture coordinates from a raycast), if it is clickable. */
  rowAt(uv: Vector2): BoardRow | null {
    const y = (1 - uv.y) * this.canvas.height;
    const index = this.rowRects.findIndex((rect) => y >= rect.top && y < rect.bottom);
    const row = this.content.rows?.[index];
    return row?.path ? row : null;
  }

  /** Highlight a row (or none). Returns whether anything changed. */
  setHovered(row: BoardRow | null): boolean {
    const index = row ? (this.content.rows ?? []).indexOf(row) : -1;
    const next = index >= 0 ? index : null;
    if (next === this.hovered) return false;
    this.hovered = next;
    this.draw();
    return true;
  }

  draw() {
    const { width, height } = this.canvas;
    const context = this.canvas.getContext('2d')!;
    const accent = `#${this.colors.accent.getHexString()}`;
    const text = '#f2f2ef';
    const muted = '#9a9a96';
    const pad = height * 0.09;
    const { title, rows = [], empty, icon } = this.content;

    context.fillStyle = '#0d0d0d';
    context.fillRect(0, 0, width, height);
    context.textBaseline = 'middle';
    this.rowRects = [];

    if (icon) {
      // Info point: a large glyph in a circle with the title below it
      const radius = height * 0.25;
      context.strokeStyle = accent;
      context.lineWidth = height * 0.03;
      context.beginPath();
      context.arc(width / 2, height * 0.4, radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = text;
      context.textAlign = 'center';
      context.font = `500 ${height * 0.34}px "IBM Plex Sans", system-ui, sans-serif`;
      context.fillText(icon, width / 2, height * 0.41);
      context.font = `400 ${height * 0.1}px "IBM Plex Mono", ui-monospace, monospace`;
      context.fillStyle = muted;
      context.fillText(title.toUpperCase(), width / 2, height * 0.83);
      this.texture.needsUpdate = true;
      return;
    }

    // Title band
    context.textAlign = 'left';
    context.fillStyle = accent;
    context.font = `500 ${height * 0.13}px "IBM Plex Mono", ui-monospace, monospace`;
    context.fillText(title.toUpperCase(), pad, pad + height * 0.06);
    const listTop = pad + height * 0.19;
    context.fillStyle = '#3d3d3d';
    context.fillRect(pad, listTop - height * 0.03, width - pad * 2, Math.max(2, height * 0.006));

    if (rows.length === 0) {
      context.fillStyle = muted;
      context.font = `400 ${height * 0.1}px "IBM Plex Sans", system-ui, sans-serif`;
      context.fillText(empty ?? '', pad, listTop + height * 0.12);
      this.texture.needsUpdate = true;
      return;
    }

    const rowHeight = Math.min((height - listTop - pad * 0.5) / rows.length, height * 0.2);
    const labelSize = rowHeight * 0.62;
    rows.forEach((row, index) => {
      const top = listTop + index * rowHeight;
      const middle = top + rowHeight / 2;
      const highlighted = index === this.hovered;
      this.rowRects.push({ top, bottom: top + rowHeight });

      const arrow = row.path ? ' →' : '';
      context.font = `400 ${labelSize * 0.62}px "IBM Plex Mono", ui-monospace, monospace`;
      const detail = `${(row.detail ?? '').toUpperCase()}${arrow}`;
      const detailWidth = context.measureText(detail).width;
      context.textAlign = 'right';
      context.fillStyle = highlighted ? accent : muted;
      context.fillText(detail, width - pad, middle);

      context.textAlign = 'left';
      context.font = `500 ${labelSize}px "IBM Plex Sans", system-ui, sans-serif`;
      context.fillStyle = highlighted ? accent : text;
      const label = fitText(context, row.label, width - pad * 3 - detailWidth);
      context.fillText(label, pad, middle);

      // Dotted leader between the label and the detail, like a menu
      const from = pad + context.measureText(label).width + labelSize * 0.4;
      const to = width - pad - detailWidth - labelSize * 0.4;
      context.fillStyle = highlighted ? accent : '#4a4a47';
      for (let x = from; x < to; x += labelSize * 0.35) context.fillRect(x, middle + labelSize * 0.2, 3, 3);
    });
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}

/** Shortens `text` with an ellipsis until it fits in `maxWidth`. */
function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}
