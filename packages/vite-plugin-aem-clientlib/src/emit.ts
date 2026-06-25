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
 * - `js/<file>`         for each `*.js` source file
 * - `css/<file>`        for each `*.css` source file
 * - `resources/<file>`  for each other source file
 *
 * `js/`, `css/`, and `resources/` sub-folders are only created when at least
 * one file is bucketed into them — this matches the golden reference, which
 * has no empty directories.
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
  const jsNames = jsFiles.map((f) => f.basename);
  const cssNames = cssFiles.map((f) => f.basename);
  await writeFile(join(clientlibDir, 'js.txt'), renderJsTxt(jsNames), 'utf8');
  await writeFile(join(clientlibDir, 'css.txt'), renderCssTxt(cssNames), 'utf8');

  await copyBucket(clientlibDir, 'js', jsFiles);
  await copyBucket(clientlibDir, 'css', cssFiles);
  await copyBucket(clientlibDir, 'resources', resourceFiles);

  return {
    clientlibDir,
    jsFiles: jsNames,
    cssFiles: cssNames,
    resourceFiles: resourceFiles.map((f) => f.basename),
  };
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

