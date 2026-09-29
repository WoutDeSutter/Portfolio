import { BoxGeometry, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { LIGHT_COLORS, LIGHT_COLOR_IDS, LIGHT_MODES, type LightColor, type LightMode, type LightState } from '../festival/lights';
import { CanvasScreen, type Hotspot } from './screen';

/**
 * The screens on the two FOH desks: the audio desk shows the tracks and what is playing (with a
 * level meter and transport buttons), the lighting desk the light modes and colours. Clicking a
 * screen asks the site to act (onAction); the site answers with setState(). The FOH panel offers
 * the same controls as HTML.
 */

export type FohTrack = { id: string; title: string; artist: string; credit: string };

export type FohLabels = {
  tracks: FohTrack[];
  music: string;
  lights: string;
  colors: string;
  volume: string;
  noTracks: string;
  nowPlaying: string;
  paused: string;
  idle: string;
  modes: Record<LightMode, string>;
};

export type FohState = { track: string | null; playing: boolean; volume: number; lights: LightState };

export type FohAction =
  | { type: 'track'; id: string }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'volume'; value: number }
  | { type: 'mode'; mode: LightMode }
  | { type: 'color'; color: LightColor };

// Positions in FOH space; the black bezels in build_foh() (build_festival.py) sit right behind them.
const SCREENS = {
  tracks: { x: -0.55, y: 1.7, z: -1.17, width: 1.0, height: 0.58, tilt: -0.2 },
  now: { x: 0.55, y: 1.7, z: -1.17, width: 1.0, height: 0.58, tilt: -0.2 },
  lights: { x: 1.8, y: 1.56, z: -1.08, width: 0.8, height: 0.48, tilt: -0.25 },
};

const TRACKS_PER_PAGE = 3;
const VOLUME_STEPS = 10;

/**
 * The channel faders on the audio desk (FOH space). They follow the volume: at 100 % they stand
 * in their mix positions, at 0 % they are all down. The slots are in the Blender model
 * (build_foh()); these numbers describe the same control surface.
 */
const DESK = { near: 0.78, far: 0.98, depth: 1.05, base: 0.3, edge: -0.25, channels: 20 };
const SLOT = { bottom: 0.08, top: 0.32 };
const deskSlope = Math.atan2(DESK.far - DESK.near, DESK.depth);
const mixPosition = (channel: number) => 0.1 + (0.2 * ((channel * 7) % 10)) / 10;

type Icon = 'prev' | 'next' | 'play' | 'pause' | 'stop';

const INK = { bg: '#07080a', text: '#f2f2ef', muted: '#8d8d89', line: '#26272a', hover: '#16171a', accent: '#e5231b' };
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export type FohDesk = {
  screens: CanvasScreen[];
  setLabels: (labels: FohLabels) => void;
  setState: (state: FohState) => void;
  /**
   * A click on a hotspot. Paging is handled by the desk itself (it redraws); everything else is
   * returned as an action for the site.
   */
  press: (hotspot: Hotspot) => FohAction | null;
  /** Animates the level meter while music plays and the FOH is open; returns whether it redrew. */
  update: (level: number, active: boolean) => boolean;
  dispose: () => void;
};

export function createFohDesk(parent: Object3D, reducedMotion: boolean): FohDesk {
  let labels: FohLabels = {
    tracks: [],
    music: '',
    lights: '',
    colors: '',
    volume: '',
    noTracks: '',
    nowPlaying: '',
    paused: '',
    idle: '',
    modes: { wash: '', beams: '', show: '', blackout: '' },
  };
  let state: FohState = { track: null, playing: false, volume: 0.8, lights: { mode: 'wash', colors: ['red'] } };
  let meter = new Array<number>(18).fill(0);

  // Fader caps, positioned along their slots on the sloped surface
  const capGeometry = new BoxGeometry(0.05, 0.03, 0.035);
  const capMaterials = [
    new MeshStandardMaterial({ color: 0x66676b, metalness: 0.85, roughness: 0.45 }),
    new MeshStandardMaterial({ color: 0x730505, roughness: 0.8 }),
  ];
  const faders = Array.from({ length: DESK.channels }, (_, channel) => {
    const accent = channel === 0 || channel === 9 || channel === DESK.channels - 1;
    const cap = new Mesh(capGeometry, capMaterials[accent ? 1 : 0]);
    cap.rotation.x = deskSlope;
    cap.position.x = -1.0 + (channel * 2.0) / (DESK.channels - 1);
    parent.add(cap);
    return { cap, position: -1 };
  });
  let faderTarget = 1;

  /** Put the faders at `amount` (0…1) of their mix positions; returns whether one moved. */
  function placeFaders(amount: number, smoothing: number): boolean {
    let moved = false;
    faders.forEach((fader, channel) => {
      const target = SLOT.bottom + (mixPosition(channel) - SLOT.bottom) * amount;
      const next = fader.position < 0 ? target : fader.position + (target - fader.position) * smoothing;
      const settled = Math.abs(next - target) < 0.0005 ? target : next;
      if (settled === fader.position) return;
      fader.position = settled;
      fader.cap.position.y = DESK.base + DESK.near + (settled * (DESK.far - DESK.near)) / DESK.depth + 0.03;
      fader.cap.position.z = DESK.edge - settled;
      moved = true;
    });
    return moved;
  }
  placeFaders(faderTarget, 1);

  function header(context: CanvasRenderingContext2D, width: number, height: number, text: string) {
    context.fillStyle = INK.bg;
    context.fillRect(0, 0, width, height);
    context.fillStyle = INK.accent;
    context.font = `500 ${height * 0.075}px ${MONO}`;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    context.fillText(text.toUpperCase(), width * 0.05, height * 0.1);
    context.fillStyle = INK.line;
    context.fillRect(width * 0.05, height * 0.17, width * 0.9, 2);
  }

  function button(context: CanvasRenderingContext2D, spot: Hotspot, hovered: boolean, active: boolean) {
    context.fillStyle = hovered ? INK.hover : INK.bg;
    context.fillRect(spot.x, spot.y, spot.width, spot.height);
    context.strokeStyle = active || hovered ? INK.accent : '#3a3b3f';
    context.lineWidth = 3;
    context.strokeRect(spot.x + 1.5, spot.y + 1.5, spot.width - 3, spot.height - 3);
  }

  // The track list shows a few tracks per page, with page buttons and stop at the bottom.
  let page = 0;
  const pageCount = () => Math.max(1, Math.ceil(labels.tracks.length / TRACKS_PER_PAGE));

  function drawIcon(context: CanvasRenderingContext2D, icon: Icon, spot: Hotspot, color: string) {
    const cx = spot.x + spot.width / 2;
    const cy = spot.y + spot.height / 2;
    const s = spot.height * 0.22;
    context.fillStyle = color;
    if (icon === 'stop') {
      context.fillRect(cx - s, cy - s, s * 2, s * 2);
      return;
    }
    if (icon === 'pause') {
      context.fillRect(cx - s, cy - s, s * 0.7, s * 2);
      context.fillRect(cx + s * 0.3, cy - s, s * 0.7, s * 2);
      return;
    }
    const direction = icon === 'prev' ? -1 : 1;
    context.beginPath();
    context.moveTo(cx - s * 0.8 * direction, cy - s);
    context.lineTo(cx + s * direction, cy);
    context.lineTo(cx - s * 0.8 * direction, cy + s);
    context.fill();
  }

  const tracksScreen = new CanvasScreen(SCREENS.tracks.width, SCREENS.tracks.height, (context, width, height, hovered) => {
    header(context, width, height, labels.music);
    const hotspots: Hotspot[] = [];
    if (labels.tracks.length === 0) {
      context.fillStyle = INK.muted;
      context.font = `400 ${height * 0.07}px ${SANS}`;
      context.fillText(labels.noTracks, width * 0.05, height * 0.3);
      return hotspots;
    }
    page = Math.min(page, pageCount() - 1);
    if (pageCount() > 1) {
      context.textAlign = 'right';
      context.fillStyle = INK.muted;
      context.font = `500 ${height * 0.065}px ${MONO}`;
      context.fillText(`${page + 1}/${pageCount()}`, width * 0.95, height * 0.1);
    }

    const rowHeight = height * 0.2;
    labels.tracks.slice(page * TRACKS_PER_PAGE, (page + 1) * TRACKS_PER_PAGE).forEach((track, index) => {
      const spot = { id: `track:${track.id}`, x: width * 0.04, y: height * 0.2 + index * rowHeight, width: width * 0.92, height: rowHeight - 6 };
      hotspots.push(spot);
      const current = track.id === state.track;
      context.fillStyle = spot.id === hovered ? INK.hover : INK.bg;
      context.fillRect(spot.x, spot.y, spot.width, spot.height);
      if (current) {
        context.fillStyle = INK.accent;
        context.fillRect(spot.x, spot.y, 6, spot.height);
      }
      const middle = spot.y + spot.height / 2;
      context.textAlign = 'left';
      context.fillStyle = current || spot.id === hovered ? INK.text : '#cfcfcb';
      context.font = `500 ${rowHeight * 0.34}px ${SANS}`;
      context.fillText(fit(context, track.title, spot.width * 0.8), spot.x + 22, middle - rowHeight * 0.14);
      context.fillStyle = INK.muted;
      context.font = `400 ${rowHeight * 0.24}px ${SANS}`;
      context.fillText(fit(context, track.artist, spot.width * 0.8), spot.x + 22, middle + rowHeight * 0.2);
      context.textAlign = 'right';
      context.fillStyle = current ? INK.accent : INK.muted;
      context.font = `500 ${rowHeight * 0.3}px ${MONO}`;
      context.fillText(current && state.playing ? '❚❚' : '▶', spot.x + spot.width - 18, middle);
    });

    // Bottom row: previous / next page
    const size = height * 0.14;
    const y = height * 0.83;
    const buttons: { id: string; icon: Icon; x: number; enabled: boolean }[] = [
      { id: 'page:prev', icon: 'prev', x: width * 0.04, enabled: page > 0 },
      { id: 'page:next', icon: 'next', x: width * 0.04 + size * 1.7, enabled: page < pageCount() - 1 },
    ];
    for (const item of buttons) {
      if (pageCount() === 1) continue;
      const spot = { id: item.id, x: item.x, y, width: size * 1.5, height: size };
      if (item.enabled) hotspots.push(spot);
      const isHovered = item.enabled && spot.id === hovered;
      button(context, spot, isHovered, false);
      drawIcon(context, item.icon, spot, !item.enabled ? '#3a3b3f' : isHovered ? INK.accent : INK.text);
    }
    return hotspots;
  });

  // What is playing, with a level meter and play/pause and stop
  const nowScreen = new CanvasScreen(SCREENS.now.width, SCREENS.now.height, (context, width, height, hovered) => {
    const track = labels.tracks.find((candidate) => candidate.id === state.track);
    header(context, width, height, track ? (state.playing ? labels.nowPlaying : labels.paused) : labels.idle);
    context.textAlign = 'left';
    if (track) {
      context.fillStyle = INK.text;
      context.font = `500 ${height * 0.12}px ${SANS}`;
      context.fillText(fit(context, track.title, width * 0.9), width * 0.05, height * 0.31);
      context.fillStyle = '#cfcfcb';
      context.font = `400 ${height * 0.075}px ${SANS}`;
      context.fillText(fit(context, track.artist, width * 0.9), width * 0.05, height * 0.44);
      context.fillStyle = INK.muted;
      context.font = `400 ${height * 0.05}px ${SANS}`;
      context.fillText(track.credit, width * 0.05, height * 0.53);
    }
    // Level meter: bars from green-grey to red, like the meters on a real desk
    const bars = meter.length;
    const barWidth = (width * 0.5) / bars;
    meter.forEach((value, index) => {
      const x = width * 0.05 + index * barWidth;
      const full = height * 0.16;
      context.fillStyle = INK.line;
      context.fillRect(x, height * 0.6, barWidth - 4, full);
      const lit = full * value;
      context.fillStyle = value > 0.8 ? INK.accent : value > 0.55 ? '#d8a23a' : '#7fb08a';
      context.fillRect(x, height * 0.6 + full - lit, barWidth - 4, lit);
    });

    // Volume: ten blocks, click one to set the volume (the faders on the desk follow)
    const spots: Hotspot[] = [];
    context.textAlign = 'left';
    context.fillStyle = INK.muted;
    context.font = `500 ${height * 0.055}px ${MONO}`;
    context.fillText(`${labels.volume.toUpperCase()} ${Math.round(state.volume * 100)}%`, width * 0.05, height * 0.84);
    const blockGap = width * 0.008;
    const blocksX = width * 0.36;
    const blockWidth = (width * 0.59 - blockGap * (VOLUME_STEPS - 1)) / VOLUME_STEPS;
    for (let step = 1; step <= VOLUME_STEPS; step++) {
      const spot = { id: `volume:${step}`, x: blocksX + (step - 1) * (blockWidth + blockGap), y: height * 0.8, width: blockWidth, height: height * 0.09 };
      spots.push(spot);
      const on = Math.round(state.volume * VOLUME_STEPS) >= step;
      context.fillStyle = spot.id === hovered ? INK.accent : on ? (step > 8 ? INK.accent : INK.text) : INK.line;
      context.fillRect(spot.x, spot.y, spot.width, spot.height);
    }

    if (!track) return spots;
    const size = height * 0.16;
    const transport: (Hotspot & { icon: Icon })[] = [
      { id: state.playing ? 'pause' : 'play', icon: state.playing ? 'pause' : 'play', x: width * 0.62, y: height * 0.6, width: size * 1.6, height: size },
      { id: 'stop', icon: 'stop', x: width * 0.62 + size * 1.75, y: height * 0.6, width: size * 1.6, height: size },
    ];
    for (const spot of transport) {
      button(context, spot, spot.id === hovered, false);
      drawIcon(context, spot.icon, spot, spot.id === hovered ? INK.accent : INK.text);
    }
    return [...spots, ...transport];
  });

  const lightsScreen = new CanvasScreen(SCREENS.lights.width, SCREENS.lights.height, (context, width, height, hovered) => {
    header(context, width, height, labels.lights);
    const hotspots: Hotspot[] = [];
    // Modes
    const gap = width * 0.02;
    const modeWidth = (width * 0.9 - gap * (LIGHT_MODES.length - 1)) / LIGHT_MODES.length;
    LIGHT_MODES.forEach((mode, index) => {
      const spot = { id: `mode:${mode}`, x: width * 0.05 + index * (modeWidth + gap), y: height * 0.23, width: modeWidth, height: height * 0.2 };
      hotspots.push(spot);
      const active = state.lights.mode === mode;
      button(context, spot, spot.id === hovered, active);
      context.fillStyle = active ? INK.accent : INK.text;
      context.textAlign = 'center';
      context.font = `500 ${height * 0.06}px ${MONO}`;
      context.fillText(labels.modes[mode].toUpperCase(), spot.x + spot.width / 2, spot.y + spot.height / 2);
    });
    // Colours
    context.textAlign = 'left';
    context.fillStyle = INK.muted;
    context.font = `500 ${height * 0.055}px ${MONO}`;
    context.fillText(labels.colors.toUpperCase(), width * 0.05, height * 0.53);
    const count = LIGHT_COLOR_IDS.length;
    const swatch = (width * 0.9 - gap * (count - 1)) / count;
    LIGHT_COLOR_IDS.forEach((color, index) => {
      const spot = { id: `color:${color}`, x: width * 0.05 + index * (swatch + gap), y: height * 0.6, width: swatch, height: swatch * 1.3 };
      hotspots.push(spot);
      const selected = state.lights.colors.includes(color);
      context.fillStyle = LIGHT_COLORS[color];
      context.globalAlpha = selected ? 1 : 0.35;
      context.fillRect(spot.x, spot.y, spot.width, spot.height);
      context.globalAlpha = 1;
      if (selected || spot.id === hovered) {
        context.strokeStyle = spot.id === hovered ? INK.text : '#f2f2ef';
        context.lineWidth = selected ? 5 : 3;
        context.strokeRect(spot.x + 2.5, spot.y + 2.5, spot.width - 5, spot.height - 5);
      }
    });
    return hotspots;
  });

  const placed = [
    [tracksScreen, SCREENS.tracks],
    [nowScreen, SCREENS.now],
    [lightsScreen, SCREENS.lights],
  ] as const;
  for (const [screen, spot] of placed) {
    screen.mesh.position.set(spot.x, spot.y, spot.z);
    screen.mesh.rotation.x = spot.tilt;
    parent.add(screen.mesh);
  }
  const screens = placed.map(([screen]) => screen);
  const drawAll = () => screens.forEach((screen) => screen.draw());

  return {
    screens,
    setLabels(next) {
      labels = next;
      drawAll();
    },
    setState(next) {
      // When a new track starts (from the screen or the panel), show the page it is on.
      if (next.track && next.track !== state.track) {
        const index = labels.tracks.findIndex((track) => track.id === next.track);
        if (index >= 0) page = Math.floor(index / TRACKS_PER_PAGE);
      }
      state = next;
      faderTarget = next.volume;
      if (reducedMotion) placeFaders(faderTarget, 1);
      if (!next.playing) meter = meter.map(() => 0);
      drawAll();
    },
    press(hotspot) {
      const [type, value] = hotspot.id.split(':');
      if (type === 'page') {
        page = Math.max(0, Math.min(pageCount() - 1, page + (value === 'next' ? 1 : -1)));
        tracksScreen.draw();
        return null;
      }
      if (type === 'track') return { type: 'track', id: value };
      if (type === 'volume') return { type: 'volume', value: Number(value) / VOLUME_STEPS };
      if (type === 'mode') return { type: 'mode', mode: value as LightMode };
      if (type === 'color') return { type: 'color', color: value as LightColor };
      if (type === 'play' || type === 'pause' || type === 'stop') return { type };
      return null;
    },
    update(level, active) {
      // Faders glide to the volume (they are on the desk, so only while the FOH is open)
      const faded = active && !reducedMotion && placeFaders(faderTarget, 0.18);
      if (!active || !state.playing) return faded;
      // Shift the meter along and add the newest level, smoothed a little
      const last = meter[meter.length - 1];
      // Post-fader, like a real desk: the meter shows the level after the volume
      meter = [...meter.slice(1), Math.min(1, last * 0.4 + level * state.volume * 1.2 * 0.6)];
      nowScreen.draw();
      return true;
    },
    dispose() {
      for (const screen of screens) screen.dispose();
      capGeometry.dispose();
      for (const material of capMaterials) material.dispose();
    },
  };
}

/** Shortens `text` with an ellipsis until it fits in `maxWidth` (in the current font). */
function fit(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}
