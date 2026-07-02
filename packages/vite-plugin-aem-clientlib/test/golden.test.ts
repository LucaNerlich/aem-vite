import { readFile, mkdtemp, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vite-plus/test';

import {
  classifyFile,
  emitClientlib,
  renderContentXml,
  renderCssTxt,
  renderJsTxt,
} from '../src/index.js';
import type { ClientlibDefinition, SourceFile } from '../src/index.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const GOLDEN_DIR = join(HERE, '__golden__');

// Definitions that produced the captured golden reference.
const DEP_LIB: ClientlibDefinition = {
  name: 'dependencies',
  categories: ['aemvite.dependencies'],
};
const SITE_LIB: ClientlibDefinition = {
  name: 'site',
  categories: ['aemvite.site'],
  dependencies: ['aemvite.dependencies'],
};

async function readGolden(...parts: string[]): Promise<Buffer> {
  return readFile(join(GOLDEN_DIR, ...parts));
}

async function listTree(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push(relative(root, full).split(sep).join('/'));
    }
  }
  await walk(root);
  return out.sort();
}

describe('renderContentXml', () => {
  it('matches golden clientlib-dependencies/.content.xml byte-for-byte', async () => {
    const got = Buffer.from(renderContentXml(DEP_LIB), 'utf8');
    const want = await readGolden('clientlib-dependencies', '.content.xml');
    expect(got.equals(want)).toBe(true);
  });

  it('matches golden clientlib-site/.content.xml byte-for-byte', async () => {
    const got = Buffer.from(renderContentXml(SITE_LIB), 'utf8');
    const want = await readGolden('clientlib-site', '.content.xml');
    expect(got.equals(want)).toBe(true);
  });

  it('omits dependencies attribute when not provided', () => {
    const xml = renderContentXml({ name: 'x', categories: ['x'] });
    expect(xml).not.toContain('dependencies=');
  });

  it('omits dependencies attribute when empty array', () => {
    const xml = renderContentXml({ name: 'x', categories: ['x'], dependencies: [] });
    expect(xml).not.toContain('dependencies=');
  });

  it('throws when categories are missing', () => {
    expect(() => renderContentXml({ name: 'x', categories: [] })).toThrow();
  });
});

describe('renderJsTxt / renderCssTxt', () => {
  it('matches golden clientlib-site/js.txt byte-for-byte', async () => {
    const got = Buffer.from(renderJsTxt(['site.js']), 'utf8');
    const want = await readGolden('clientlib-site', 'js.txt');
    expect(got.equals(want)).toBe(true);
  });

  it('matches golden clientlib-site/css.txt byte-for-byte', async () => {
    const got = Buffer.from(renderCssTxt(['site.css']), 'utf8');
    const want = await readGolden('clientlib-site', 'css.txt');
    expect(got.equals(want)).toBe(true);
  });

  it('matches golden clientlib-dependencies/js.txt byte-for-byte (empty)', async () => {
    const got = Buffer.from(renderJsTxt([]), 'utf8');
    const want = await readGolden('clientlib-dependencies', 'js.txt');
    expect(got.equals(want)).toBe(true);
  });

  it('matches golden clientlib-dependencies/css.txt byte-for-byte (empty)', async () => {
    const got = Buffer.from(renderCssTxt([]), 'utf8');
    const want = await readGolden('clientlib-dependencies', 'css.txt');
    expect(got.equals(want)).toBe(true);
  });
});

describe('classifyFile', () => {
  it('routes by extension, case-insensitively', () => {
    expect(classifyFile('site.js')).toBe('js');
    expect(classifyFile('SITE.JS')).toBe('js');
    expect(classifyFile('site.css')).toBe('css');
    expect(classifyFile('logo.svg')).toBe('resources');
    expect(classifyFile('font.woff2')).toBe('resources');
  });

  it('routes sourcemap siblings to the resources bucket', () => {
    // `.map` files live under `resources/sourcemaps/` so AEM serves them as
    // plain static files (not aggregated like `js/`/`css/`).
    expect(classifyFile('site.js.map')).toBe('resources');
    expect(classifyFile('SITE.JS.MAP')).toBe('resources');
    expect(classifyFile('site.css.map')).toBe('resources');
    expect(classifyFile('SITE.CSS.MAP')).toBe('resources');
  });
});

describe('emitClientlib (file layout)', () => {
  let workDir: string;
  let siteSrcJs: string;
  let siteSrcCss: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'aemvite-clientlib-'));
    // Synthetic source files; the golden reference only ships descriptors,
    // not the bundled .js/.css. We only assert the emitted tree shape and
    // descriptor bytes — file contents are produced by upstream Vite builds.
    const fakeSrc = join(workDir, 'fake-src');
    await import('node:fs').then((m) => m.promises.mkdir(fakeSrc, { recursive: true }));
    siteSrcJs = join(fakeSrc, 'site.js');
    siteSrcCss = join(fakeSrc, 'site.css');
    await writeFile(siteSrcJs, '/* fake js */\n', 'utf8');
    await writeFile(siteSrcCss, '/* fake css */\n', 'utf8');
  });

  it('produces a tree that matches the golden tree.txt listing', async () => {
    const outDir = join(workDir, 'out');
    const siteFiles: SourceFile[] = [
      { source: siteSrcJs, basename: 'site.js' },
      { source: siteSrcCss, basename: 'site.css' },
    ];
    await emitClientlib({ outDir, clientlib: DEP_LIB, files: [] });
    await emitClientlib({ outDir, clientlib: SITE_LIB, files: siteFiles });

    const got = await listTree(outDir);
    const wantText = (await readGolden('tree.txt')).toString('utf8').trim();
    const want = wantText.split('\n').filter(Boolean).sort();
    expect(got).toEqual(want);
  });

  it('emitted descriptor files are byte-identical to the golden files', async () => {
    const outDir = join(workDir, 'out2');
    await emitClientlib({ outDir, clientlib: DEP_LIB, files: [] });
    await emitClientlib({
      outDir,
      clientlib: SITE_LIB,
      files: [
        { source: siteSrcJs, basename: 'site.js' },
        { source: siteSrcCss, basename: 'site.css' },
      ],
    });

    for (const lib of ['clientlib-dependencies', 'clientlib-site']) {
      for (const f of ['.content.xml', 'js.txt', 'css.txt']) {
        const got = await readFile(join(outDir, lib, f));
        const want = await readFile(join(GOLDEN_DIR, lib, f));
        expect(got.equals(want), `${lib}/${f}`).toBe(true);
      }
    }
  });

  it('does not create a resources/ directory when no resource files are given', async () => {
    const outDir = join(workDir, 'out3');
    await emitClientlib({ outDir, clientlib: SITE_LIB, files: [] });
    let resourcesExists = false;
    try {
      await stat(join(outDir, 'clientlib-site', 'resources'));
      resourcesExists = true;
    } catch {
      /* expected */
    }
    expect(resourcesExists).toBe(false);
  });

  it('routes .js.map / .css.map under resources/sourcemaps/ and excludes them from txt manifests', async () => {
    const outDir = join(workDir, 'out4');
    const fakeSrc = join(workDir, 'fake-src');
    const siteSrcJsMap = join(fakeSrc, 'site.js.map');
    const siteSrcCssMap = join(fakeSrc, 'site.css.map');
    await writeFile(siteSrcJsMap, '{"version":3,"sources":[]}\n', 'utf8');
    await writeFile(siteSrcCssMap, '{"version":3,"sources":[]}\n', 'utf8');

    const result = await emitClientlib({
      outDir,
      clientlib: SITE_LIB,
      // Callers stage maps with a nested basename so they nest under
      // `resources/sourcemaps/` in the emitted layout.
      files: [
        { source: siteSrcJs, basename: 'site.js' },
        { source: siteSrcCss, basename: 'site.css' },
        { source: siteSrcJsMap, basename: 'sourcemaps/site.js.map' },
        { source: siteSrcCssMap, basename: 'sourcemaps/site.css.map' },
      ],
    });

    // Maps land under resources/sourcemaps/, not in the js/ or css/ buckets.
    await stat(join(outDir, 'clientlib-site', 'resources', 'sourcemaps', 'site.js.map'));
    await stat(join(outDir, 'clientlib-site', 'resources', 'sourcemaps', 'site.css.map'));

    // txt manifests must not list the maps — AEM would try to load them.
    const jsTxt = await readFile(join(outDir, 'clientlib-site', 'js.txt'), 'utf8');
    const cssTxt = await readFile(join(outDir, 'clientlib-site', 'css.txt'), 'utf8');
    expect(jsTxt).toBe('#base=js\n\nsite.js');
    expect(cssTxt).toBe('#base=css\n\nsite.css');

    // EmitResult should expose only the txt-listed code files (no maps).
    expect(result.jsFiles).toEqual(['site.js']);
    expect(result.cssFiles).toEqual(['site.css']);
    expect(result.resourceFiles).toEqual([
      'sourcemaps/site.js.map',
      'sourcemaps/site.css.map',
    ]);
  });
});
