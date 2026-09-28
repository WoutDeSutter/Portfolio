import { useMediaQuery } from './useMediaQuery';

/**
 * Below 64rem (tablet portrait, phones) the site uses flat mode without live 3D:
 * next to the text column there would only be a narrow strip left for the stage.
 */
const SCENE_MEDIA_QUERY = '(min-width: 64rem)';

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
