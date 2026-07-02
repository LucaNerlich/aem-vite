import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';
import { aemViteGlob } from '@aemvite/vite-plugin-glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'src/main/webpack/static'),
  plugins: [aemViteGlob()],
  server: {
    proxy: {
      '/content': 'http://localhost:4502',
      '/etc.clientlibs': 'http://localhost:4502',
    },
  },
});
