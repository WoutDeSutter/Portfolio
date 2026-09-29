import { useSyncExternalStore } from 'react';

/**
 * The stage lights, set at the lighting desk in the FOH (3D screen or the panel):
 * a mode plus one or more colours. The show alternates the chosen colours over the lights.
 */
export const LIGHT_MODES = ['wash', 'beams', 'show', 'blackout'] as const;
export type LightMode = (typeof LIGHT_MODES)[number];

export const LIGHT_COLORS = {
  red: '#e5231b',
  orange: '#ff7a1a',
  yellow: '#ffd21a',
  green: '#2ee66b',
  cyan: '#1ad6ff',
  blue: '#2b5bff',
  purple: '#9b3bff',
  pink: '#ff3bb0',
  white: '#fff4e6',
} as const;
export type LightColor = keyof typeof LIGHT_COLORS;
export const LIGHT_COLOR_IDS = Object.keys(LIGHT_COLORS) as LightColor[];

export type LightState = { mode: LightMode; colors: LightColor[] };

let state: LightState = { mode: 'wash', colors: ['red'] };
const listeners = new Set<() => void>();

function setState(next: LightState) {
  state = next;
  for (const listener of listeners) listener();
}

export function setLightMode(mode: LightMode) {
  setState({ ...state, mode });
}

/** Add or remove a colour; at least one colour always stays selected. */
export function toggleLightColor(color: LightColor) {
  const selected = state.colors.includes(color);
  if (selected && state.colors.length === 1) return;
  const colors = selected ? state.colors.filter((c) => c !== color) : [...state.colors, color];
  // Keep the palette order, so "red + blue" looks the same whichever was picked first.
  setState({ ...state, colors: LIGHT_COLOR_IDS.filter((id) => colors.includes(id)) });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLights(): LightState {
  return useSyncExternalStore(subscribe, () => state);
}
