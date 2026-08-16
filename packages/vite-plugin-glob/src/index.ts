import path from 'node:path';
import type { ModuleNode, Plugin } from 'vite';
import { expandStyleGlobsWithResult } from './expand.js';

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
  // Directory → set of importers whose expansion depended on files in that
  // directory. Vite/Rollup only re-transform an importer when the importer
  // itself changes; adding or removing a matched partial would otherwise be
  // invisible in dev/watch. `handleHotUpdate` uses this map to invalidate
  // importers when the files their globs see change.
  const trackedDirs = new Map<string, Set<string>>();

  return {
    name: '@aemvite/vite-plugin-glob',
    enforce: 'pre',
    transform(code: string, id: string) {
      const cleanId = id.split('?')[0];
      if (!exts.some((ext) => cleanId.endsWith(ext))) return undefined;

      const result = expandStyleGlobsWithResult(code, cleanId);
      for (const specifier of result.unmatched) {
        this.warn(
          `Glob ${JSON.stringify(specifier)} in ${cleanId} matched no files — ` +
            `the statement was left as-is`,
        );
      }
      if (result.expanded > 0) {
        const baseDir = path.dirname(cleanId);
        let importers = trackedDirs.get(baseDir);
        if (!importers) {
          importers = new Set();
          trackedDirs.set(baseDir, importers);
        }
        importers.add(cleanId);
      }
      if (result.code === code) return undefined;

      return { code: result.code, map: null };
    },
    handleHotUpdate(ctx) {
      if (
        !ctx.file.endsWith('.scss') &&
        !ctx.file.endsWith('.sass') &&
        !ctx.file.endsWith('.css')
      ) {
        return;
      }
      const invalidated = new Set<ModuleNode>();
      for (const [baseDir, importers] of trackedDirs) {
        if (ctx.file !== baseDir && !ctx.file.startsWith(baseDir + path.sep)) {
          continue;
        }
        for (const importerId of importers) {
          const mod = ctx.server.moduleGraph.getModuleById(importerId);
          if (mod) invalidated.add(mod);
        }
      }
      if (invalidated.size === 0) return;
      return [...ctx.modules, ...invalidated];
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
