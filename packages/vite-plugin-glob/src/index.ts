import type { Plugin } from 'vite';
import { expandStyleGlobs } from './expand.js';

export interface AemViteGlobOptions {
  /**
   * File extensions this plugin transforms. Defaults to `['.scss', '.sass', '.css']`.
   */
  extensions?: string[];
}

const DEFAULT_EXTS = ['.scss', '.sass', '.css'];

/**
 * Vite plugin that expands glob `@import` / `@use` / `@forward` statements in
 * `.scss`, `.sass`, and `.css` source files before Vite's CSS pipeline runs
 * Sass / esbuild.
 *
 * Replaces the webpack `glob-import-loader` for styles. Does not handle JS
 * glob imports (use `import.meta.glob` for those).
 */
export function aemViteGlob(options: AemViteGlobOptions = {}): Plugin {
  const exts = options.extensions ?? DEFAULT_EXTS;

  return {
    name: '@aemvite/vite-plugin-glob',
    enforce: 'pre',
    transform(code: string, id: string) {
      const cleanId = id.split('?')[0];
      if (!exts.some((ext) => cleanId.endsWith(ext))) return undefined;

      const transformed = expandStyleGlobs(code, cleanId);
      if (transformed === code) return undefined;

      return { code: transformed, map: null };
    },
  };
}

export default aemViteGlob;
export {
  expandStyleGlobs,
  expandStyleGlobsWithResult,
  hasGlobMagic,
} from './expand.js';
export type { ExpandOptions, ExpandResult } from './expand.js';
