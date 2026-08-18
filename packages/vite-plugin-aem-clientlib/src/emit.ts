import { mkdir, copyFile, writeFile, rm, rename } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import { renderContentXml, renderCssTxt, renderJsTxt } from './descriptors.js';
import { classifyFile } from './layout.js';
import type {
  ClientlibDefinition,
  EmitClientlibOptions,
  EmitResult,
  SourceFile,
} from './types.js';

/**
 * Whether `name` is safe to use as a `clientlib-<name>` folder name:
 * non-empty, no path separators, and no `.`/`..` segments.
 */
export function isValidClientlibName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\\') &&
    basename(name) === name
  );
}

function assertValidClientlibName(name: string): void {
  if (!isValidClientlibName(name)) {
    throw new Error(
      `Invalid clientlib name ${JSON.stringify(name)}: ` +
        `must be a bare folder name without path separators or '..' segments`,
    );
  }
}

/**
 * Reject basenames that could escape the clientlib directory when joined
 * into a destination path (`..` segments, absolute paths) or corrupt the
 * `js.txt`/`css.txt` manifests (newlines / carriage returns, empty names).
 */
function assertSafeBasename(basename: string, clientlibDir: string): void {
  if (
    typeof basename !== 'string' ||
    basename.length === 0 ||
    basename === '.' ||
    basename === '..' ||
    /[\r\n]/.test(basename) ||
    isAbsolute(basename)
  ) {
    throw new Error(`Invalid source basename ${JSON.stringify(basename)}`);
  }
  const resolved = resolve(clientlibDir, basename);
  const rel = relative(clientlibDir, resolved);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(
      `Source basename ${JSON.stringify(basename)} escapes the clientlib directory`,
    );
  }
}

/**
 * Emit a single AEM clientlib folder to disk.
 *
 * Creates `<outDir>/clientlib-<name>/` containing:
 * - `.content.xml` (always)
 * - `js.txt`       (always)
 * - `css.txt`      (always)
 * - `js/<file>`         for each `*.js` source file (and `*.js.map` siblings)
 * - `css/<file>`        for each `*.css` source file (and `*.css.map` siblings)
 * - `resources/<file>`  for each other source file
 *
 * `js/`, `css/`, and `resources/` sub-folders are only created when at least
 * one file is bucketed into them — this matches the golden reference, which
 * has no empty directories.
 *
 * Sourcemap files (`*.map`) are routed to `resources/` (see `classifyFile`)
 * so AEM's clientlib aggregator never tries to load them as scripts and
 * Sling URL decomposition does not 404 them. They are also excluded from
 * `js.txt` / `css.txt` as a defensive measure should a caller pass a `.map`
 * with a non-default basename.
 *
 * The clientlib name and every file basename are validated before anything
 * touches the filesystem. Output is staged into a sibling temp directory and
 * swapped in atomically, so a failed copy mid-emit never leaves a
 * half-written clientlib or destroys the last good output.
 */
export async function emitClientlib(
  options: EmitClientlibOptions,
): Promise<EmitResult> {
  const { clientlib, outDir, files = [] } = options;
  assertValidClientlibName(clientlib.name);
  const clientlibDir = join(outDir, `clientlib-${clientlib.name}`);

  // Bucket files. Use the destination basename for classification so callers
  // can rename files via `basename` if they wish. Basenames are validated
  // here (the single choke point all emit paths funnel through).
  const jsFiles: SourceFile[] = [];
  const cssFiles: SourceFile[] = [];
  const resourceFiles: SourceFile[] = [];
  const seen = new Map<string, string>();
  for (const f of files) {
    assertSafeBasename(f.basename, clientlibDir);
    const key = f.basename.toLowerCase();
    const prev = seen.get(key);
    if (prev !== undefined) {
      throw new Error(
        `Duplicate basename ${JSON.stringify(f.basename)} in clientlib ` +
          `${JSON.stringify(clientlib.name)} (collides with ${JSON.stringify(prev)})`,
      );
    }
    seen.set(key, f.basename);
    const bucket = classifyFile(f.basename);
    if (bucket === 'js') jsFiles.push(f);
    else if (bucket === 'css') cssFiles.push(f);
    else resourceFiles.push(f);
  }

  // Render all descriptors before touching the filesystem so an invalid
  // definition (e.g. missing categories) never deletes an existing clientlib.
  const contentXml = renderContentXml(clientlib);
  // Sourcemap siblings live in the same bucket as their owner on disk, but
  // must not appear in the txt manifests — AEM would otherwise try to load
  // them as scripts/stylesheets.
  const jsTxtNames = jsFiles.map((f) => f.basename).filter((n) => !isMap(n));
  const cssTxtNames = cssFiles.map((f) => f.basename).filter((n) => !isMap(n));
  const jsTxt = renderJsTxt(jsTxtNames);
  const cssTxt = renderCssTxt(cssTxtNames);

  const stagingDir = `${clientlibDir}.tmp~`;
  await rm(stagingDir, { recursive: true, force: true });
  try {
    await mkdir(stagingDir, { recursive: true });
    await writeFile(join(stagingDir, '.content.xml'), contentXml, 'utf8');
    await writeFile(join(stagingDir, 'js.txt'), jsTxt, 'utf8');
    await writeFile(join(stagingDir, 'css.txt'), cssTxt, 'utf8');
    await copyBucket(stagingDir, 'js', jsFiles);
    await copyBucket(stagingDir, 'css', cssFiles);
    await copyBucket(stagingDir, 'resources', resourceFiles);
    await rm(clientlibDir, { recursive: true, force: true });
    await rename(stagingDir, clientlibDir);
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  return {
    clientlibDir,
    jsFiles: jsTxtNames,
    cssFiles: cssTxtNames,
    resourceFiles: resourceFiles.map((f) => f.basename),
  };
}

function isMap(basename: string): boolean {
  return basename.toLowerCase().endsWith('.map');
}

/**
 * Emit multiple clientlibs into the same `outDir`. Returns the per-clientlib
 * results in input order.
 */
export async function emitClientlibs(
  outDir: string,
  clientlibs: Array<{ clientlib: ClientlibDefinition; files?: SourceFile[] }>,
): Promise<EmitResult[]> {
  const results: EmitResult[] = [];
  for (const entry of clientlibs) {
    results.push(
      await emitClientlib({
        outDir,
        clientlib: entry.clientlib,
        files: entry.files,
      }),
    );
  }
  return results;
}

async function copyBucket(
  clientlibDir: string,
  bucket: 'js' | 'css' | 'resources',
  files: SourceFile[],
): Promise<void> {
  if (files.length === 0) return;
  const bucketDir = join(clientlibDir, bucket);
  await mkdir(bucketDir, { recursive: true });
  for (const f of files) {
    const dest = join(bucketDir, f.basename);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(f.source, dest);
  }
}
