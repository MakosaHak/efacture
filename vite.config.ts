import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { handleOcrRequest, type OcrRequestBody } from './netlify/functions/lib/gemini-ocr';

/** En développement, reproduit la fonction Netlify /api/ocr avec les variables du .env. */
function devOcrApi(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'efacture-dev-ocr-api',
    configureServer(server) {
      server.middlewares.use('/api/ocr', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          let body: OcrRequestBody | null = null;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as OcrRequestBody;
          } catch {
            body = null;
          }
          const auth = req.headers.authorization ?? null;
          void handleOcrRequest(body, typeof auth === 'string' ? auth : null, env).then(({ status, body: out }) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(out));
          });
        });
      });
    },
  };
}

// Certificat local généré par mkcert et approuvé par Windows : évite l'avertissement
// « Non sécurisé » du navigateur. Absent ailleurs → le serveur démarre en HTTP.
const certDir = path.join(os.homedir(), '.vite-plugin-mkcert');
const keyPath = path.join(certDir, 'dev.pem');
const certPath = path.join(certDir, 'cert.pem');
const https =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined;

export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 5173,
    https,
  },
  plugins: [
    react(),
    tailwindcss(),
    devOcrApi(loadEnv(mode, process.cwd(), '')),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/**/*', 'favicon.png'],
      manifest: {
        name: 'efacture — Scanner & Gérer Vos Achats',
        short_name: 'efacture',
        description: 'Scanner et gérer vos achats au Togo — commerçants TPME',
        theme_color: '#ffffff',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'efacture-google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'efacture-google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'efacture-supabase',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      // En dev, le service worker peut servir l'app en HTTP et afficher « Non sécurisé ».
      devOptions: {
        enabled: false,
      },
    }),
  ],
}));
