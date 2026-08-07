import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mini-market-simulation/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
