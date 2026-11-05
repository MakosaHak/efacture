import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** HTTP, sans SSL ni plugin PWA — pour les captures d'écran du mémoire. */
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,
  },
  resolve: {
    alias: {
      'virtual:pwa-register/react': path.join(dir, 'scripts/pwa-register-stub.ts'),
    },
  },
  plugins: [react(), tailwindcss()],
});
