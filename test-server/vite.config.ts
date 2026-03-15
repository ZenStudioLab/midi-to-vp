import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@zen/midi-to-vp'],
  },
  server: {
    port: 3100,
    open: true
  }
});
