import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
  server: {
    port: 3000,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
  plugins: [react(), tailwindcss()],
}));
