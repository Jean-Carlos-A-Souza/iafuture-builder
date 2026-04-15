import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('src/renderer-react'),
  base: './',
  publicDir: path.resolve('src/renderer-react/public'),
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    outDir: path.resolve('src/renderer-dist'),
    emptyOutDir: true,
  },
  server: {
    port: 4173,
    strictPort: true,
  },
});
