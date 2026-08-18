import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, it, expect } from 'vite-plus/test';

import { emitClientlib, isValidClientlibName } from '../src/index.js';
import type { ClientlibDefinition } from '../src/index.js';

const SITE_LIB: ClientlibDefinition = {
  name: 'site',
  categories: ['aemvite.site'],
};

describe('isValidClientlibName', () => {
  it('accepts bare folder names', () => {
    expect(isValidClientlibName('site')).toBe(true);
    expect(isValidClientlibName('clientlib-site')).toBe(true);
    expect(isValidClientlibName('site_2.x')).toBe(true);
  });

  it('rejects names that could escape the output directory', () => {
    expect(isValidClientlibName('')).toBe(false);
    expect(isValidClientlibName('.')).toBe(false);
    expect(isValidClientlibName('..')).toBe(false);
    expect(isValidClientlibName('a/b')).toBe(false);
    expect(isValidClientlibName('a\\b')).toBe(false);
    expect(isValidClientlibName('../../evil')).toBe(false);
    expect(isValidClientlibName('/abs/evil')).toBe(false);
    expect(isValidClientlibName('x/..')).toBe(false);
  });
});

describe('emitClientlib (input safety)', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'aemvite-clientlib-safety-'));
  });

  afterAll(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(workDir, { recursive: true, force: true });
  });

  it('rejects clientlib names that escape outDir without touching the filesystem', async () => {
    const outDir = join(workDir, 'out-name');
    await expect(
      emitClientlib({
        outDir,
        clientlib: { name: '../../evil', categories: ['x'] },
        files: [],
      }),
    ).rejects.toThrow(/name/);
    expect(existsSync(join(workDir, 'evil'))).toBe(false);
    expect(existsSync(outDir)).toBe(false);
  });

  it('rejects basenames with path traversal or absolute segments', async () => {
    const outDir = join(workDir, 'out-basename');
    const src = join(workDir, 'src.js');
    await writeFile(src, '/* js */\n', 'utf8');

    for (const bad of ['../../evil.js', '/etc/passwd', 'a/../../evil.js', '..', '.', '']) {
      await expect(
        emitClientlib({
          outDir,
          clientlib: SITE_LIB,
          files: [{ source: src, basename: bad }],
        }),
      ).rejects.toThrow(/basename|Source/);
    }
    expect(existsSync(outDir)).toBe(false);
  });

  it('rejects basenames containing newlines or carriage returns', async () => {
    const outDir = join(workDir, 'out-newline');
    const src = join(workDir, 'src.js');
    await writeFile(src, '/* js */\n', 'utf8');

    for (const bad of ['site.js\n#base=evil', 'a\r\nb.js']) {
      await expect(
        emitClientlib({
          outDir,
          clientlib: SITE_LIB,
          files: [{ source: src, basename: bad }],
        }),
      ).rejects.toThrow(/basename/);
    }
    expect(existsSync(outDir)).toBe(false);
  });

  it('rejects duplicate basenames, case-insensitively', async () => {
    const outDir = join(workDir, 'out-dup');
    const src = join(workDir, 'src.js');
    await writeFile(src, '/* js */\n', 'utf8');

    await expect(
      emitClientlib({
        outDir,
        clientlib: SITE_LIB,
        files: [
          { source: src, basename: 'site.js' },
          { source: src, basename: 'SITE.JS' },
        ],
      }),
    ).rejects.toThrow(/Duplicate basename/);
    expect(existsSync(outDir)).toBe(false);
  });

  it('preserves the previous good output when a later emit fails mid-copy', async () => {
    const outDir = join(workDir, 'out-atomic');
    const src = join(workDir, 'src.js');
    await writeFile(src, 'GOOD', 'utf8');

    await emitClientlib({
      outDir,
      clientlib: SITE_LIB,
      files: [{ source: src, basename: 'site.js' }],
    });

    await expect(
      emitClientlib({
        outDir,
        clientlib: SITE_LIB,
        files: [
          { source: src, basename: 'site.js' },
          { source: join(workDir, 'missing.css'), basename: 'site.css' },
        ],
      }),
    ).rejects.toThrow();

    // The previous output is intact and no staging dir is left behind.
    const js = await readFile(join(outDir, 'clientlib-site', 'js', 'site.js'), 'utf8');
    expect(js).toBe('GOOD');
    expect(existsSync(join(outDir, 'clientlib-site', 'css'))).toBe(false);
    expect(existsSync(`${join(outDir, 'clientlib-site')}.tmp~`)).toBe(false);
  });
});
