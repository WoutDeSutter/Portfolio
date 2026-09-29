import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { assetVersions } from './scripts/asset-versions.mjs';

// `base: './'` makes all asset paths relative. Combined with HashRouter the
// HTML file never moves, so the same build works on both
// `<user>.github.io/portfolio/` and the custom domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    // Content hashes of the models and music, so a changed file gets a new URL (src/utils/assetUrl.ts).
    __ASSET_VERSIONS__: JSON.stringify(assetVersions(['models', 'music'])),
  },
  build: {
    // Three.js is ~600 kB (~160 kB gzipped) on its own. It is loaded lazily in a
    // separate chunk, only when the 3D stage is shown, so this size is expected.
    chunkSizeWarningLimit: 700,
  },
});
