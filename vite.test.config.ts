import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/renderer',
  publicDir: 'public',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    port: 5173,
    open: true
  }
});
