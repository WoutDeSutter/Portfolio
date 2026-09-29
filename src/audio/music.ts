import { tracks } from '../content/content';
import type { Track } from '../content/types';
import { assetUrl } from '../utils/assetUrl';

/**
 * The FOH music: one audio element, played through Web Audio so the 3D world can route it to
 * the speakers on the stage (positional audio). Nothing loads or plays until a visitor presses
 * play in the FOH — never autoplay.
 *
 * React reads the state with useMusic() (useSyncExternalStore); the world plugs in with
 * setSpatializer() and reads the level with getLevel() to make the lights react.
 */

export type MusicState = {
  track: Track | null;
  playing: boolean;
  muted: boolean;
  /** 0…1, kept while muted. */
  volume: number;
};

/** Connects the music to the speakers in the world; returns a function that disconnects it again. */
export type Spatializer = (context: AudioContext, input: AudioNode) => () => void;

let state: MusicState = { track: null, playing: false, muted: false, volume: 0.8 };
const listeners = new Set<() => void>();

let audio: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let output: GainNode | null = null; // mute lives here
let analyser: AnalyserNode | null = null;
let levels: Uint8Array<ArrayBuffer> | null = null;
let spatializer: Spatializer | null = null;
let disconnect: (() => void) | null = null;

function setState(next: Partial<MusicState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): MusicState {
  return state;
}

/** Builds the audio graph on the first play (browsers only allow audio after a click). */
function ensureGraph() {
  if (audio && context && output) return;
  audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('ended', () => playNext());
  audio.addEventListener('pause', () => setState({ playing: false }));
  audio.addEventListener('play', () => setState({ playing: true }));

  context = new AudioContext();
  const source = context.createMediaElementSource(audio);
  output = context.createGain();
  output.gain.value = state.muted ? 0 : state.volume;
  analyser = context.createAnalyser();
  analyser.fftSize = 256;
  levels = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  source.connect(output);
  route();
}

/** Send the music to the world's speakers when there is a world, otherwise straight out. */
function route() {
  if (!context || !output) return;
  disconnect?.();
  output.disconnect();
  if (spatializer) {
    disconnect = spatializer(context, output);
  } else {
    output.connect(context.destination);
    disconnect = null;
  }
}

/** Called by the world when it starts (with its speakers) and when it is removed (null). */
export function setSpatializer(next: Spatializer | null) {
  spatializer = next;
  route();
}

export function play(track: Track) {
  ensureGraph();
  void context!.resume();
  if (state.track?.id !== track.id) {
    audio!.src = assetUrl(track.file);
    setState({ track });
  }
  audio!.play().catch((error: unknown) => {
    console.warn('[music] Could not play', track.file, error);
    setState({ playing: false });
  });
}

export function pause() {
  audio?.pause();
}

export function stop() {
  if (!audio) return;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  setState({ track: null, playing: false });
}

function playNext() {
  if (!state.track) return;
  const index = tracks.findIndex((track) => track.id === state.track!.id);
  play(tracks[(index + 1) % tracks.length]);
}

function applyGain() {
  if (output && context) output.gain.setTargetAtTime(state.muted ? 0 : state.volume, context.currentTime, 0.05);
}

export function setMuted(muted: boolean) {
  setState({ muted });
  applyGain();
}

export function setVolume(volume: number) {
  setState({ volume: Math.min(1, Math.max(0, volume)) });
  applyGain();
}

/** Loudness of the music right now, 0…1 (0 when nothing plays). */
export function getLevel(): number {
  if (!analyser || !levels || !state.playing) return 0;
  analyser.getByteFrequencyData(levels);
  // The low end (kick and bass) drives the lights best.
  let sum = 0;
  const bins = Math.min(12, levels.length);
  for (let i = 0; i < bins; i++) sum += levels[i];
  return sum / (bins * 255);
}
