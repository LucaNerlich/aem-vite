import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/**
 * A single copy mapping.
 *
 * - `from`: source directory (absolute, or relative to the Vite project root).
 * - `to`: destination directory, relative to the Vite build `outDir`.
 *   Defaults to `'resources'` to match the AEM clientlib convention.
 */
export interface ResourceCopy {
  from: string;
  to?: string;
}

export type AemResourcesOptions =
  | ResourceCopy
  | ResourceCopy[]
  | { entries: ResourceCopy | ResourceCopy[] };

const DEFAULT_TO = 'resources';
const PLACEHOLDER_NAMES = new Set(['.gitkeep']);

function normalizeEntries(options: AemResourcesOptions): ResourceCopy[] {
  if (Array.isArray(options)) return options;
  if ('entries' in options) {
    return Array.isArray(options.entries) ? options.entries : [options.entries];
  }
  return [options];
}

/**
 * Recursively count "real" files under `src`, skipping placeholder
 * markers like `.gitkeep`. Returns 0 if `src` is missing or empty.
 */
async function countRealFiles(src: string): Promise<number> {
  let entries;
  try {
    entries = await fs.readdir(src, { withFileTypes: true });
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    const child = path.join(src, entry.name);
    if (entry.isDirectory()) {
      count += await countRealFiles(child);
    } else if (entry.isFile() && !PLACEHOLDER_NAMES.has(entry.name)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Copy `src` → `dest` recursively. Skips `.gitkeep` placeholders and
 * directories that contain only placeholders, so empty trees never
 * materialize on disk. Returns the number of files copied.
 */
async function copyTree(src: string, dest: string): Promise<number> {
  let entries;
  try {
    entries = await fs.readdir(src, { withFileTypes: true });
  } catch {
    return 0;
  }
  let copied = 0;
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied += await copyTree(s, d);
    } else if (entry.isFile() && !PLACEHOLDER_NAMES.has(entry.name)) {
      await fs.mkdir(dest, { recursive: true });
      await fs.copyFile(s, d);
      copied += 1;
    }
  }
  return copied;
}

/**
 * Vite plugin that copies one or more resource trees into the build
 * output at the end of the build. Drop-in replacement for
 * `copy-webpack-plugin` in AEM clientlib builds.
 *
 * Behavior:
 * - No URL rewriting; files are byte-copied.
 * - `.gitkeep` placeholders are skipped.
 * - A `from` that contains only placeholders (or does not exist) is a
 *   no-op: no destination directory is created.
 */
export function aemResources(options: AemResourcesOptions): Plugin {
  const entries = normalizeEntries(options);
  let resolved: ResolvedConfig | undefined;

  return {
    name: 'aemvite:aem-resources',
    apply: 'build',
    configResolved(config) {
      resolved = config;
    },
    async closeBundle() {
      const root = resolved?.root ?? process.cwd();
      const outDirRaw = resolved?.build.outDir ?? 'dist';
      const outDir = path.isAbsolute(outDirRaw)
        ? outDirRaw
        : path.resolve(root, outDirRaw);

      for (const entry of entries) {
        const fromAbs = path.isAbsolute(entry.from)
          ? entry.from
          : path.resolve(root, entry.from);
        const toRel = entry.to ?? DEFAULT_TO;
        const toAbs = path.isAbsolute(toRel)
          ? toRel
          : path.resolve(outDir, toRel);

        if ((await countRealFiles(fromAbs)) === 0) continue;
        await copyTree(fromAbs, toAbs);
      }
    },
  };
}

export default aemResources;
