import type { FileBucket } from './types.js';

/**
 * Classify a file (by basename or path) into the bucket that determines its
 * destination directory inside the clientlib output:
 *
 * - `*.js`  → `js/`
 * - `*.css` → `css/`
 * - other   → `resources/`
 *
 * Classification is case-insensitive on the extension.
 */
export function classifyFile(filename: string): FileBucket {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.js')) return 'js';
  if (lower.endsWith('.css')) return 'css';
  return 'resources';
}
