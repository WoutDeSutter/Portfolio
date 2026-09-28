import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes all asset paths relative. Combined with HashRouter the
// HTML file never moves, so the same build works on both
// `<user>.github.io/portfolio/` and the custom domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
});
