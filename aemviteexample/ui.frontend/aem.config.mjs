import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineAemConfig } from '@aemvite/aem-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineAemConfig({
  clientLibRoot: path.resolve(
    __dirname,
    '../ui.apps/src/main/content/jcr_root/apps/aemviteexample/clientlibs',
  ),
  build: {
    target: 'es2025',
  },
  clientlibs: [
    {
      name: 'dependencies',
      entry: '',
      categories: ['aemviteexample.dependencies'],
    },
    {
      name: 'site',
      entry: 'src/main/frontend/site/main.ts',
      categories: ['aemviteexample.site'],
      dependencies: ['aemviteexample.dependencies'],
      resources: ['src/main/frontend/resources'],
      build: {
        minify: { js: true, css: true },
        sourcemap: true,
      },
    },
  ],
});
