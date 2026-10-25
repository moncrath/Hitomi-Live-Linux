import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Aset seni tinggal di repo (../assets), bukan di dalam app/.
// publicDir absolut -> isinya dilayani di root URL (/avatar/hitomi/...) saat dev
// dan otomatis disalin ke dist/ saat build. Tanpa duplikasi 33 PNG.
const publicDir = fileURLToPath(new URL('../assets', import.meta.url));

export default defineConfig({
  publicDir,
  server: { port: 5173, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true },
});
