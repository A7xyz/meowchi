import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    target: 'es2022',
    sourcemap: true
  },
  test: {
    environment: 'node',
    globals: true
  }
});
