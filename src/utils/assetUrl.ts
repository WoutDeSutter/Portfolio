/** Content hashes of the files in public/models and public/music, filled in at build time (vite.config.ts). */
declare const __ASSET_VERSIONS__: Record<string, string>;

/**
 * URL of a file in public/, e.g. assetUrl('models/stage.glb'). It carries the file's content hash,
 * so a changed model or track is never served from an old browser cache.
 */
export function assetUrl(path: string): string {
  const version = __ASSET_VERSIONS__[path];
  return `${import.meta.env.BASE_URL}${path}${version ? `?v=${version}` : ''}`;
}
