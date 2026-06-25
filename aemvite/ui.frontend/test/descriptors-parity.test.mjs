import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it, beforeAll, expect } from 'vitest';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiFrontend = path.resolve(__dirname, '..');
const repoRoot = path.resolve(uiFrontend, '../..');
const golden = path.resolve(
  repoRoot,
  'packages/vite-plugin-aem-clientlib/test/__golden__',
);
const clientLibRoot = path.resolve(
  uiFrontend,
  '../ui.apps/src/main/content/jcr_root/apps/aemvite/clientlibs',
);

const DESCRIPTORS = [
  'clientlib-site/.content.xml',
  'clientlib-site/js.txt',
  'clientlib-site/css.txt',
  'clientlib-dependencies/.content.xml',
  'clientlib-dependencies/js.txt',
  'clientlib-dependencies/css.txt',
];

describe('ui.frontend prod descriptors match golden (byte-identical)', () => {
  beforeAll(async () => {
    await execFileAsync(process.execPath, ['aem-build.mjs', 'prod'], {
      cwd: uiFrontend,
    });
  }, 120_000);

  for (const rel of DESCRIPTORS) {
    it(`${rel} matches golden`, async () => {
      const [actual, expected] = await Promise.all([
        readFile(path.join(clientLibRoot, rel)),
        readFile(path.join(golden, rel)),
      ]);
      expect(actual.equals(expected)).toBe(true);
    });
  }
});
