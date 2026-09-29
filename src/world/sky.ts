import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace } from 'three';
import type { WorldColors } from './theme';

/**
 * The night sky behind the festival: near-black overhead, a faint glow along the horizon (the
 * festival lighting up the air) and a scatter of stars. Painted once on a canvas and used as the
 * scene background, so it costs nothing per frame.
 */
export function createSky(colors: WorldColors): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const horizon = height / 2;
  const ground = `#${colors.bg.getHexString()}`;

  const gradient = context.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, '#020204');
  gradient.addColorStop(0.55, '#06070c');
  gradient.addColorStop(0.88, '#0f1120');
  gradient.addColorStop(1, '#1a1622');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, horizon);
  context.fillStyle = ground;
  context.fillRect(0, horizon, width, height - horizon);

  // Stars: fewer and fainter towards the horizon, where the glow washes them out
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900; i++) {
    const y = horizon * Math.pow(random(), 1.6) * 0.92;
    const x = random() * width;
    const fade = 1 - y / horizon;
    const size = random() < 0.08 ? 2.2 : 1.2;
    context.fillStyle = `rgba(230, 232, 255, ${(0.25 + random() * 0.6) * fade})`;
    context.fillRect(x, y, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
