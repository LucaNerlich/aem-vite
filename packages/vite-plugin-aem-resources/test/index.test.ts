import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aemResources } from '../src/index.js';

type ConfigResolvedHook = (config: {
  root: string;
  build: { outDir: string };
}) => void;
type CloseBundleHook = () => Promise<void> | void;

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aemvite-resources-'));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeFile(p: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function runPlugin(plugin: ReturnType<typeof aemResources>, root: string, outDir: string): Promise<void> {
  const cfgHook = plugin.configResolved as ConfigResolvedHook;
  const closeHook = plugin.closeBundle as CloseBundleHook;
  cfgHook({ root, build: { outDir } });
  await closeHook();
}

describe('aemResources', () => {
  it('copies a fixture tree preserving structure and content', async () => {
    const root = tmpRoot;
    const from = path.join(root, 'src', 'resources');
    await writeFile(path.join(from, 'fonts', 'site.woff2'), 'FONT-BYTES');
    await writeFile(path.join(from, 'images', 'logo.svg'), '<svg/>');
    await writeFile(path.join(from, 'images', 'icons', 'star.svg'), '<svg id="star"/>');
    await writeFile(path.join(from, 'top-level.txt'), 'hello');

    const outDir = path.join(root, 'dist', 'clientlib-site');
    await fs.mkdir(outDir, { recursive: true });

    await runPlugin(aemResources({ from, to: 'resources' }), root, outDir);

    const dest = path.join(outDir, 'resources');
    expect(await exists(dest)).toBe(true);
    expect(await fs.readFile(path.join(dest, 'fonts', 'site.woff2'), 'utf8')).toBe('FONT-BYTES');
    expect(await fs.readFile(path.join(dest, 'images', 'logo.svg'), 'utf8')).toBe('<svg/>');
    expect(await fs.readFile(path.join(dest, 'images', 'icons', 'star.svg'), 'utf8')).toBe('<svg id="star"/>');
    expect(await fs.readFile(path.join(dest, 'top-level.txt'), 'utf8')).toBe('hello');

    const topEntries = (await fs.readdir(dest)).sort();
    expect(topEntries).toEqual(['fonts', 'images', 'top-level.txt']);
  });

  it('does NOT create a resources/ dir when the source has only .gitkeep placeholders', async () => {
    const root = tmpRoot;
    const from = path.join(root, 'src', 'resources');
    await writeFile(path.join(from, 'fonts', '.gitkeep'), '');
    await writeFile(path.join(from, 'images', '.gitkeep'), '');

    const outDir = path.join(root, 'dist', 'clientlib-site');
    await fs.mkdir(outDir, { recursive: true });

    await runPlugin(aemResources({ from, to: 'resources' }), root, outDir);

    expect(await exists(path.join(outDir, 'resources'))).toBe(false);
    expect((await fs.readdir(outDir)).length).toBe(0);
  });

  it('does NOT create a resources/ dir when the source does not exist', async () => {
    const root = tmpRoot;
    const outDir = path.join(root, 'dist', 'clientlib-site');
    await fs.mkdir(outDir, { recursive: true });

    await runPlugin(
      aemResources({ from: path.join(root, 'src', 'missing'), to: 'resources' }),
      root,
      outDir,
    );

    expect(await exists(path.join(outDir, 'resources'))).toBe(false);
  });

  it('skips .gitkeep files but still copies real siblings in the same directory', async () => {
    const root = tmpRoot;
    const from = path.join(root, 'src', 'resources');
    await writeFile(path.join(from, 'images', '.gitkeep'), '');
    await writeFile(path.join(from, 'images', 'logo.svg'), '<svg/>');

    const outDir = path.join(root, 'dist', 'clientlib-site');
    await fs.mkdir(outDir, { recursive: true });

    await runPlugin(aemResources({ from, to: 'resources' }), root, outDir);

    const dest = path.join(outDir, 'resources');
    expect(await fs.readdir(dest)).toEqual(['images']);
    expect(await fs.readdir(path.join(dest, 'images'))).toEqual(['logo.svg']);
  });

  it('accepts an array of entries and resolves relative paths against root', async () => {
    const root = tmpRoot;
    await writeFile(path.join(root, 'src', 'a', 'one.txt'), '1');
    await writeFile(path.join(root, 'src', 'b', 'two.txt'), '2');

    const outDir = path.join(root, 'dist');
    await fs.mkdir(outDir, { recursive: true });

    await runPlugin(
      aemResources([
        { from: 'src/a', to: 'resources/a' },
        { from: 'src/b', to: 'resources/b' },
      ]),
      root,
      outDir,
    );

    expect(await fs.readFile(path.join(outDir, 'resources', 'a', 'one.txt'), 'utf8')).toBe('1');
    expect(await fs.readFile(path.join(outDir, 'resources', 'b', 'two.txt'), 'utf8')).toBe('2');
  });

  it('defaults `to` to "resources"', async () => {
    const root = tmpRoot;
    const from = path.join(root, 'src', 'res');
    await writeFile(path.join(from, 'a.txt'), 'A');

    const outDir = path.join(root, 'dist');
    await fs.mkdir(outDir, { recursive: true });

    await runPlugin(aemResources({ from }), root, outDir);

    expect(await fs.readFile(path.join(outDir, 'resources', 'a.txt'), 'utf8')).toBe('A');
  });
});
