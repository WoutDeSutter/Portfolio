import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes all asset paths relative. Combined with HashRouter the
// HTML file never moves, so the same build works on both
// `<user>.github.io/portfolio/` and the custom domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Three.js is ~600 kB (~160 kB gzipped) on its own. It is loaded lazily in a
    // separate chunk, only when the 3D stage is shown, so this size is expected.
    chunkSizeWarningLimit: 700,
  },
});
