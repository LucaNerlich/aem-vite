import { emitClientlibs } from './emit.js';
import type { ClientlibDefinition, SourceFile } from './types.js';

/**
 * Minimal Vite plugin shape — locally typed to avoid a hard runtime dep on
 * `vite` (the package is tested with `vitest` only and consumed by the
 * orchestrator in `@aemvite/aem-config`).
 */
export interface VitePluginLike {
  name: string;
  apply?: 'build';
  closeBundle: () => Promise<void> | void;
}

/** Options for {@link aemClientlibPlugin}. */
export interface AemClientlibPluginOptions {
  /** Absolute directory in which `clientlib-<name>` folders will be created. */
  outDir: string;
  /** Clientlibs and their file lists to emit. */
  clientlibs: Array<{ clientlib: ClientlibDefinition; files?: SourceFile[] }>;
}

/**
 * Thin Vite plugin wrapper. The plugin is intentionally dumb: the orchestrator
 * does the per-entry Vite `build()` runs, decides which files belong to which
 * clientlib, and then this plugin writes the descriptors and lays out files
 * at `closeBundle`. All real work lives in {@link emitClientlibs}.
 */
export function aemClientlibPlugin(
  options: AemClientlibPluginOptions,
): VitePluginLike {
  return {
    name: 'aemvite:aem-clientlib',
    apply: 'build',
    async closeBundle() {
      await emitClientlibs(options.outDir, options.clientlibs);
    },
  };
}
