import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineAemConfig } from '@aemvite/aem-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build options are layered: mode baseline → global `build` → per-clientlib
// `build`. With no overrides, production resolves to esbuild minify (JS+CSS)
// and no sourcemap — matching the historical webpack output and the captured
// golden descriptors. The values below explicitly pin that production-equivalent
// behavior and demonstrate the per-clientlib override on `clientlib-site`.
export default defineAemConfig({
  clientLibRoot: path.resolve(
    __dirname,
    '../ui.apps/src/main/content/jcr_root/apps/aemvite/clientlibs',
  ),
  build: {
    target: 'es2025',
  },
  clientlibs: [
    {
      name: 'dependencies',
      entry: '',
      categories: ['aemvite.dependencies'],
    },
    {
      name: 'site',
      entry: 'src/main/webpack/site/main.ts',
      categories: ['aemvite.site'],
      dependencies: ['aemvite.dependencies'],
      resources: ['src/main/webpack/resources'],
      // Per-clientlib override: explicitly request prod-style minify for JS and
      // CSS with no sourcemap. Flip `minify` or `sourcemap` here to change just
      // this clientlib's output without touching the global block.
      build: {
        minify: { js: false, css: false },
        sourcemap: true,
      },
    },
  ],
});
