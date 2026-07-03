import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (
            id.includes('/recharts/') ||
            id.includes('/victory-vendor/') ||
            id.includes('/d3-') ||
            id.includes('/react-smooth/')
          ) {
            return 'charts';
          }
          if (id.includes('/lucide-react/')) return 'icons';
          if (id.includes('/qrcode/')) return 'qrcode';
          return 'vendor';
        },
      },
    },
  }
}));
