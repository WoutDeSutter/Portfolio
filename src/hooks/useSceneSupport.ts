import { useMediaQuery } from './useMediaQuery';

/** Same breakpoint as the CSS: below it the site uses flat mode without live 3D. */
const SCENE_MEDIA_QUERY = '(min-width: 48rem)';

let webGLSupported: boolean | undefined;

function supportsWebGL(): boolean {
  if (webGLSupported === undefined) {
    try {
      const canvas = document.createElement('canvas');
      webGLSupported = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      webGLSupported = false;
    }
  }
  return webGLSupported;
}

/** Whether the live 3D stage should be shown: wide enough screen and WebGL available. */
export function useSceneSupport(): boolean {
  const isWide = useMediaQuery(SCENE_MEDIA_QUERY);
  return isWide && supportsWebGL();
}
