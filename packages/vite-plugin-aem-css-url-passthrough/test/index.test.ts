import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aemCssUrlPassthrough } from '../src/index.js';

type ConfigResolvedHook = (config: {
  root: string;
  build: { outDir: string };
}) => void;
type WriteBundleHook = (options: { dir?: string }) => Promise<void> | void;

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aemvite-css-url-'));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeCss(dir: string, name: string, content: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), content);
}

async function runPlugin(
  plugin: ReturnType<typeof aemCssUrlPassthrough>,
  outDir: string,
): Promise<void> {
  const cfgHook = plugin.configResolved as ConfigResolvedHook;
  const writeHook = plugin.writeBundle as WriteBundleHook;
  cfgHook({ root: outDir, build: { outDir } });
  await writeHook({ dir: outDir });
}

describe('aemCssUrlPassthrough', () => {
  it('rewrites url() paths through configured resource subdirs back to ../resources/<sub>/<file>', async () => {
    const dir = path.join(tmpRoot, 'dist');
    await writeCss(
      dir,
      'site.css',
      [
        '.a{background:url(../../components/header/resources/images/icon.svg)}',
        ".b{background:url('../../foo/resources/fonts/Site.woff2')}",
        '.c{background:url("../resources/images/already.svg")}',
      ].join('\n'),
    );

    await runPlugin(aemCssUrlPassthrough(), dir);

    const out = await fs.readFile(path.join(dir, 'site.css'), 'utf8');
    expect(out).toContain('url(../resources/images/icon.svg)');
    expect(out).toContain("url('../resources/fonts/Site.woff2')");
    expect(out).toContain('url("../resources/images/already.svg")');
  });

  it('leaves data:, absolute, and protocol-relative URLs alone', async () => {
    const dir = path.join(tmpRoot, 'dist');
    const css = [
      '.a{background:url(data:image/svg+xml;base64,PHN2Zy8+)}',
      '.b{background:url(https://cdn.example.com/resources/images/external.svg)}',
      '.c{background:url(//cdn.example.com/resources/images/proto-rel.svg)}',
      '.d{background:url(http://example.com/resources/fonts/Foo.woff2)}',
    ].join('\n');
    await writeCss(dir, 'site.css', css);

    await runPlugin(aemCssUrlPassthrough(), dir);

    expect(await fs.readFile(path.join(dir, 'site.css'), 'utf8')).toBe(css);
  });

  it('leaves url()s that do not pass through a configured resource dir alone', async () => {
    const dir = path.join(tmpRoot, 'dist');
    const css = [
      '.a{background:url(../assets/images/icon.svg)}',
      '.b{background:url(./other/file.svg)}',
      '.c{background:url(../resources/icons/extra.svg)}',
    ].join('\n');
    await writeCss(dir, 'site.css', css);

    await runPlugin(aemCssUrlPassthrough(), dir);

    expect(await fs.readFile(path.join(dir, 'site.css'), 'utf8')).toBe(css);
  });

  it('respects a custom resourceDirs list', async () => {
    const dir = path.join(tmpRoot, 'dist');
    await writeCss(
      dir,
      'site.css',
      [
        '.a{background:url(../foo/resources/icons/star.svg)}',
        '.b{background:url(../bar/resources/images/photo.png)}',
      ].join('\n'),
    );

    await runPlugin(
      aemCssUrlPassthrough({ resourceDirs: ['icons'] }),
      dir,
    );

    const out = await fs.readFile(path.join(dir, 'site.css'), 'utf8');
    expect(out).toContain('url(../resources/icons/star.svg)');
    expect(out).toContain('url(../bar/resources/images/photo.png)');
  });

  it('processes every .css file in the output directory and skips non-css files', async () => {
    const dir = path.join(tmpRoot, 'dist');
    await writeCss(dir, 'a.css', '.x{background:url(../foo/resources/images/a.svg)}');
    await writeCss(dir, 'b.css', '.y{background:url(../bar/resources/fonts/b.woff2)}');
    await writeCss(dir, 'c.txt', 'url(../foo/resources/images/c.svg)');

    await runPlugin(aemCssUrlPassthrough(), dir);

    expect(await fs.readFile(path.join(dir, 'a.css'), 'utf8')).toContain(
      'url(../resources/images/a.svg)',
    );
    expect(await fs.readFile(path.join(dir, 'b.css'), 'utf8')).toContain(
      'url(../resources/fonts/b.woff2)',
    );
    expect(await fs.readFile(path.join(dir, 'c.txt'), 'utf8')).toBe(
      'url(../foo/resources/images/c.svg)',
    );
  });

  it('is a no-op when the output directory does not exist', async () => {
    const missing = path.join(tmpRoot, 'never-built');
    await expect(
      runPlugin(aemCssUrlPassthrough(), missing),
    ).resolves.toBeUndefined();
  });
});
