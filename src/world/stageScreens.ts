import type { Object3D } from 'three';
import { CanvasScreen } from './screen';

/**
 * The side screens (IMAG) left and right of the main stage, showing "about me" as short slides:
 * the introduction on the left, the technologies per group on the right. Slides change every few
 * seconds; with reduced motion they stay on the first slide. The full text is in the About panel.
 */

export type AboutLabels = {
  name: string;
  role: string;
  title: string;
  intro: string;
  technologies: string;
  groups: { title: string; items: string[] }[];
};

// Stage space; the frames and stands are in build_stage() (build_festival.py).
const SIDE_SCREENS = [
  { x: -11.55, y: 5.4, z: 2.6, turn: 0.12 },
  { x: 11.55, y: 5.4, z: 2.6, turn: -0.12 },
];
const SIZE = { width: 3.8, height: 2.2 };
const SLIDE_SECONDS = 7;

const INK = { bg: '#050507', text: '#f2f2ef', muted: '#9a9a96', accent: '#e5231b' };
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

type Slide = (context: CanvasRenderingContext2D, width: number, height: number) => void;

export type StageScreens = {
  setLabels: (labels: AboutLabels) => void;
  dispose: () => void;
};

export function createStageScreens(stage: Object3D, reducedMotion: boolean, invalidate: () => void): StageScreens {
  let labels: AboutLabels = { name: '', role: '', title: '', intro: '', technologies: '', groups: [] };
  let slide = 0;

  const frame = (context: CanvasRenderingContext2D, width: number, height: number, kicker: string) => {
    context.fillStyle = INK.bg;
    context.fillRect(0, 0, width, height);
    context.fillStyle = INK.accent;
    context.fillRect(0, height - height * 0.02, width, height * 0.02);
    context.font = `500 ${height * 0.06}px ${MONO}`;
    context.textBaseline = 'top';
    context.textAlign = 'left';
    context.fillText(kicker.toUpperCase(), width * 0.07, height * 0.09);
  };

  const leftSlides: Slide[] = [
    (context, width, height) => {
      frame(context, width, height, labels.title);
      context.fillStyle = INK.text;
      wrap(context, labels.intro, width * 0.07, height * 0.25, width * 0.86, height * 0.66, 500, SANS);
    },
    (context, width, height) => {
      frame(context, width, height, labels.title);
      context.fillStyle = INK.text;
      context.font = `500 ${height * 0.17}px ${SANS}`;
      context.textBaseline = 'middle';
      context.fillText(labels.name.toUpperCase(), width * 0.07, height * 0.45, width * 0.86);
      context.fillStyle = INK.accent;
      context.font = `400 ${height * 0.09}px ${MONO}`;
      context.fillText(labels.role.toUpperCase(), width * 0.07, height * 0.65, width * 0.86);
    },
  ];

  const groupSlide =
    (index: number): Slide =>
    (context, width, height) => {
      const group = labels.groups[index];
      frame(context, width, height, `${labels.technologies} · ${group?.title ?? ''}`);
      if (!group) return;
      const columns = group.items.length > 4 ? 2 : 1;
      const perColumn = Math.ceil(group.items.length / columns);
      const lineHeight = Math.min((height * 0.62) / perColumn, height * 0.16);
      context.fillStyle = INK.text;
      context.font = `500 ${lineHeight * 0.72}px ${SANS}`;
      context.textBaseline = 'top';
      group.items.forEach((item, i) => {
        const column = Math.floor(i / perColumn);
        const row = i % perColumn;
        context.fillText(item, width * (0.07 + column * 0.45), height * 0.27 + row * lineHeight, width * 0.42);
      });
    };

  const screens = SIDE_SCREENS.map((spot, index) => {
    const screen = new CanvasScreen(SIZE.width, SIZE.height, (context, width, height) => {
      if (index === 0) leftSlides[slide % leftSlides.length](context, width, height);
      else if (labels.groups.length) groupSlide(slide % labels.groups.length)(context, width, height);
      return [];
    });
    // Just in front of the black frame, facing the field
    screen.mesh.position.set(spot.x + Math.sin(spot.turn) * 0.09, spot.y, spot.z + Math.cos(spot.turn) * 0.09);
    screen.mesh.rotation.y = spot.turn;
    stage.add(screen.mesh);
    return screen;
  });

  const drawAll = () => {
    for (const screen of screens) screen.draw();
    invalidate();
  };

  // Changing slides needs only one new frame each time, so the world still renders on demand.
  const timer = reducedMotion
    ? undefined
    : window.setInterval(() => {
        slide += 1;
        drawAll();
      }, SLIDE_SECONDS * 1000);

  return {
    setLabels(next) {
      labels = next;
      drawAll();
    },
    dispose() {
      window.clearInterval(timer);
      for (const screen of screens) screen.dispose();
    },
  };
}

/** Draws `text` wrapped to `maxWidth`, as large as fits in the box (up to a readable maximum). */
function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  weight: number,
  family: string,
) {
  let size = maxHeight * 0.2;
  let lines: string[] = [];
  while (size > 12) {
    context.font = `${weight} ${size}px ${family}`;
    lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length * size * 1.3 <= maxHeight) break;
    size *= 0.9;
  }
  context.textBaseline = 'top';
  lines.forEach((line, i) => context.fillText(line, x, y + i * size * 1.3));
}
