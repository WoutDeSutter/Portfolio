/**
 * Runs `callback` when the browser has nothing more urgent to do (after the first paint),
 * or after `timeout` ms at the latest. Falls back to a short timer where
 * requestIdleCallback is not available (Safari).
 */
export function whenIdle(callback: () => void, timeout = 1200): { cancel: () => void } {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout });
    return { cancel: () => window.cancelIdleCallback(id) };
  }
  const id = setTimeout(callback, 200);
  return { cancel: () => clearTimeout(id) };
}
