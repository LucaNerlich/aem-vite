import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { renderContentXml, renderCssTxt, renderJsTxt } from './descriptors.js';
import { classifyFile } from './layout.js';
import type {
  ClientlibDefinition,
  EmitClientlibOptions,
  EmitResult,
  SourceFile,
} from './types.js';

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
 * The target clientlib directory is wiped before writing to guarantee a
 * clean, deterministic layout per build.
 */
export async function emitClientlib(
  options: EmitClientlibOptions,
): Promise<EmitResult> {
  const { clientlib, outDir, files = [] } = options;
  const clientlibDir = join(outDir, `clientlib-${clientlib.name}`);

  // Bucket files. Use the destination basename for classification so callers
  // can rename files via `basename` if they wish.
  const jsFiles: SourceFile[] = [];
  const cssFiles: SourceFile[] = [];
  const resourceFiles: SourceFile[] = [];
  for (const f of files) {
    const bucket = classifyFile(f.basename);
    if (bucket === 'js') jsFiles.push(f);
    else if (bucket === 'css') cssFiles.push(f);
    else resourceFiles.push(f);
  }

  await rm(clientlibDir, { recursive: true, force: true });
  await mkdir(clientlibDir, { recursive: true });

  await writeFile(
    join(clientlibDir, '.content.xml'),
    renderContentXml(clientlib),
    'utf8',
  );
  // Sourcemap siblings live in the same bucket as their owner on disk, but
  // must not appear in the txt manifests — AEM would otherwise try to load
  // them as scripts/stylesheets.
  const jsTxtNames = jsFiles.map((f) => f.basename).filter((n) => !isMap(n));
  const cssTxtNames = cssFiles.map((f) => f.basename).filter((n) => !isMap(n));
  await writeFile(join(clientlibDir, 'js.txt'), renderJsTxt(jsTxtNames), 'utf8');
  await writeFile(join(clientlibDir, 'css.txt'), renderCssTxt(cssTxtNames), 'utf8');

  await copyBucket(clientlibDir, 'js', jsFiles);
  await copyBucket(clientlibDir, 'css', cssFiles);
  await copyBucket(clientlibDir, 'resources', resourceFiles);

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

