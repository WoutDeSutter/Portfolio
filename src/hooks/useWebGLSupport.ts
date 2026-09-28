let webGLSupported: boolean | undefined;

/**
 * Whether the browser can show the 3D festival. The world runs at every screen size;
 * only without WebGL does the site fall back to its text version.
 *
 * During development, `?text` in the URL (e.g. `localhost:5173/?text#/about`) pretends
 * WebGL is missing, so the text version can be tested.
 */
export function useWebGLSupport(): boolean {
  if (webGLSupported === undefined) {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('text')) {
      webGLSupported = false;
      return webGLSupported;
    }
    try {
      const canvas = document.createElement('canvas');
      webGLSupported = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      webGLSupported = false;
    }
  }
  return webGLSupported;
}
