/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const backendUrl = (env.BACKEND_URL || 'http://127.0.0.1:8080').replace(
    /\/+$/,
    '',
  );
  const websocketUrl = backendUrl.replace(/^http/, 'ws');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/health': backendUrl,
        '/api': backendUrl,
        '/ws': {
          target: websocketUrl,
          ws: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
