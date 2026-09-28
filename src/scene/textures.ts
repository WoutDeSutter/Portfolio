import { CanvasTexture, SRGBColorSpace } from 'three';

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext('2d')! };
}

/** White centre fading to transparent: light pools on the floor. */
export function createRadialTexture(): CanvasTexture {
  const size = 256;
  const { canvas, context } = createCanvas(size, size);
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** Black at the top to white at the bottom: used as alpha map for beams that fade out upwards. */
export function createVerticalFadeTexture(): CanvasTexture {
  const { canvas, context } = createCanvas(4, 128);
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#000');
  gradient.addColorStop(1, '#fff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return new CanvasTexture(canvas);
}

/**
 * A projector alignment pattern, shown on a screen while a project has no image yet —
 * exactly what a projector shows during a stage setup. No text, so nothing to translate.
 */
export function createTestPatternTexture(colors: { bg: string; line: string; accent: string }): CanvasTexture {
  const width = 640;
  const height = 360;
  const { canvas, context } = createCanvas(width, height);

  context.fillStyle = colors.bg;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = colors.line;
  context.lineWidth = 1;
  const cell = 40;
  for (let x = cell; x < width; x += cell) line(context, x, 0, x, height);
  for (let y = cell; y < height; y += cell) line(context, 0, y, width, y);

  context.lineWidth = 2;
  context.strokeRect(1, 1, width - 2, height - 2);
  line(context, 0, 0, width, height);
  line(context, width, 0, 0, height);

  context.strokeStyle = colors.accent;
  context.beginPath();
  context.arc(width / 2, height / 2, height * 0.3, 0, Math.PI * 2);
  context.stroke();
  line(context, width / 2 - 24, height / 2, width / 2 + 24, height / 2);
  line(context, width / 2, height / 2 - 24, width / 2, height / 2 + 24);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}
