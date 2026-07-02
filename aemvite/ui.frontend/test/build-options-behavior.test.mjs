import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { describe, it, beforeAll, expect } from 'vite-plus/test';
import { build as viteBuild } from 'vite-plus';
import { resolveBuildOptions } from '@aemvite/aem-config';

/**
 * Drive real per-entry Vite builds via the resolveBuildOptions resolver and
 * assert that minify + sourcemap toggles produce real differences in output.
 *
 * The fixture is tiny but contains comments + whitespace so the minified
 * output is meaningfully shorter than the unminified output. CSS uses an
 * @import via `import { ... } from './style.css'` so esbuild bundles it.
 */

const FIXTURE_JS = `// fixture comment that should be removed by minify
export function   greeting (name) {
    const   message  =  "Hello, "  +  name  +  "!" ;
    return    message ;
}

export const value =   42  ;
`;

const FIXTURE_CSS = `/* fixture comment that minify should strip */
.fixture {
    color :  red ;
    background :  white ;
    padding  :  10px ;
}

.fixture > .child {
    margin  :  20px ;
}
`;

const FIXTURE_ENTRY = `import './fixture.css';
export { greeting, value } from './fixture-lib.js';
`;

async function runBuild(workDir, resolved) {
  const outDir = path.join(workDir, 'out');
  await rm(outDir, { recursive: true, force: true });
  await viteBuild({
    configFile: false,
    root: workDir,
    logLevel: 'silent',
    build: {
      outDir,
      emptyOutDir: true,
      write: true,
      minify: resolved.minify.js ? 'esbuild' : false,
      cssMinify: resolved.minify.css ? 'esbuild' : false,
      sourcemap: resolved.sourcemap,
      target: resolved.target,
      lib: {
        entry: path.join(workDir, 'entry.js'),
        formats: ['es'],
        fileName: () => 'bundle.js',
        cssFileName: 'bundle',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: (info) =>
            (info.name ?? '').toLowerCase().endsWith('.css')
              ? 'bundle.css'
              : '[name][extname]',
        },
      },
    },
  });
  return outDir;
}

async function readOutput(outDir) {
  const files = await readdir(outDir);
  const out = {};
  for (const f of files) {
    out[f] = await readFile(path.join(outDir, f), 'utf8');
  }
  return out;
}

describe('build-options API: minify + sourcemap actually change output', () => {
  let workDir;

  beforeAll(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), 'aemvite-build-opts-'));
    await mkdir(workDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(workDir, 'entry.js'), FIXTURE_ENTRY),
      writeFile(path.join(workDir, 'fixture-lib.js'), FIXTURE_JS),
      writeFile(path.join(workDir, 'fixture.css'), FIXTURE_CSS),
    ]);
  });

  it('minify=true produces strictly smaller JS and CSS than minify=false', async () => {
    const off = resolveBuildOptions('production', undefined, { minify: false, sourcemap: false });
    const on = resolveBuildOptions('production', undefined, { minify: true, sourcemap: false });
    const offDir = await runBuild(workDir, off);
    const offFiles = await readOutput(offDir);
    const onDir = await runBuild(workDir, on);
    const onFiles = await readOutput(onDir);
    expect(offFiles['bundle.js']).toBeTruthy();
    expect(onFiles['bundle.js']).toBeTruthy();
    expect(offFiles['bundle.css']).toBeTruthy();
    expect(onFiles['bundle.css']).toBeTruthy();
    expect(onFiles['bundle.js'].length).toBeLessThan(offFiles['bundle.js'].length);
    expect(onFiles['bundle.css'].length).toBeLessThan(offFiles['bundle.css'].length);
    // JS: unminified keeps the original `greeting(name)` identifiers; minified
    // mangles top-level names so the original signature is gone.
    expect(offFiles['bundle.js']).toMatch(/function\s+greeting\s*\(\s*name\s*\)/);
    expect(onFiles['bundle.js']).not.toMatch(/function\s+greeting\s*\(\s*name\s*\)/);
    // CSS: unminified preserves whitespace around braces and properties;
    // minified collapses it (`.fixture {` → `.fixture{`).
    expect(offFiles['bundle.css']).toMatch(/\.fixture\s+\{/);
    expect(onFiles['bundle.css']).toMatch(/\.fixture\{/);
  }, 60_000);

  it('sourcemap=true emits .map sidecars; sourcemap=false omits them', async () => {
    const off = resolveBuildOptions('production', undefined, { minify: true, sourcemap: false });
    const on = resolveBuildOptions('production', undefined, { minify: true, sourcemap: true });
    const offDir = await runBuild(workDir, off);
    const offNames = await readdir(offDir);
    const onDir = await runBuild(workDir, on);
    const onNames = await readdir(onDir);
    expect(offNames.some((n) => n.endsWith('.map'))).toBe(false);
    expect(onNames.some((n) => n === 'bundle.js.map')).toBe(true);
  }, 60_000);

  it('sourcemap="inline" embeds a sourceMappingURL comment in the JS', async () => {
    const inline = resolveBuildOptions('development', undefined, { sourcemap: 'inline' });
    const dir = await runBuild(workDir, inline);
    const files = await readOutput(dir);
    expect(files['bundle.js']).toMatch(/sourceMappingURL=data:application\/json/);
    const names = await readdir(dir);
    expect(names.some((n) => n.endsWith('.map'))).toBe(false);
  }, 60_000);
});
