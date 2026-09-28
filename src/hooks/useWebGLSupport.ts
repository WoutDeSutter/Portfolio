let webGLSupported: boolean | undefined;

/**
 * Whether the browser can show the 3D festival. The world runs at every screen size;
 * only without WebGL does the site fall back to its text version.
 */
export function useWebGLSupport(): boolean {
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
