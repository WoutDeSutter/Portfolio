import { Color } from 'three';

export type SceneColors = {
  bg: Color;
  surface: Color;
  line: Color;
  lineStrong: Color;
  text: Color;
  accent: Color;
};

/** Reads the theme from the CSS variables in tokens.css, so colors are defined in one place. */
export function readSceneColors(): SceneColors {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => new Color(styles.getPropertyValue(name).trim());

  return {
    bg: token('--color-bg'),
    surface: token('--color-surface'),
    line: token('--color-line'),
    lineStrong: token('--color-line-strong'),
    text: token('--color-text'),
    accent: token('--color-accent'),
  };
}
