import type { FileBucket } from './types.js';

/**
 * Classify a file (by basename or path) into the bucket that determines its
 * destination directory inside the clientlib output:
 *
 * - `*.js`      → `js/`
 * - `*.css`     → `css/`
 * - `*.js.map`  → `resources/`  (sourcemap; the orchestrator nests it under
 *                                `resources/sourcemaps/` via its `basename`)
 * - `*.css.map` → `resources/`  (same as above)
 * - other       → `resources/`
 *
 * `.map` files route to `resources/` because AEM's clientlib aggregator
 * concatenates everything in `js/` / `css/` and Sling URL decomposition
 * (`.js.map` → selectors=[js], extension=map) trips 404s when fetched at
 * the top-level clientlib proxy path. The `resources/` subfolder is served
 * as plain static files, so `<lib-folder>/resources/sourcemaps/*.map` is
 * reachable by the browser when `allowProxy=true`. The orchestrator
 * additionally rewrites the `sourceMappingURL` comment in `.js` / `.css`
 * so the relative URL resolves to that resources path.
 *
 * Classification is case-insensitive on the extension.
 */
export function classifyFile(filename: string): FileBucket {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.js.map')) return 'resources';
  if (lower.endsWith('.css.map')) return 'resources';
  if (lower.endsWith('.js')) return 'js';
  if (lower.endsWith('.css')) return 'css';
  return 'resources';
}
