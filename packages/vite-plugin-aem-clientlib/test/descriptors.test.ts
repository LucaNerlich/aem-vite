import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vite-plus/test';

import { renderContentXml } from '../src/index.js';
import type { ClientlibDefinition } from '../src/index.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const GOLDEN_DIR = join(HERE, '__golden__');

const EMBED_LIB: ClientlibDefinition = {
  name: 'embed',
  categories: ['aemvite.embed'],
  dependencies: ['aemvite.dependencies'],
  embed: ['aemvite.shared.a', 'aemvite.shared.b'],
};

describe('renderContentXml (embed attribute)', () => {
  it('matches golden clientlib-embed/.content.xml byte-for-byte', async () => {
    const got = Buffer.from(renderContentXml(EMBED_LIB), 'utf8');
    const want = await readFile(join(GOLDEN_DIR, 'clientlib-embed', '.content.xml'));
    expect(got.equals(want)).toBe(true);
  });

  it('renders embed in the locked slot between dependencies and cssProcessor', () => {
    const xml = renderContentXml(EMBED_LIB);
    const depIdx = xml.indexOf('dependencies=');
    const embedIdx = xml.indexOf('embed=');
    const cssIdx = xml.indexOf('cssProcessor=');
    expect(depIdx).toBeGreaterThan(0);
    expect(embedIdx).toBeGreaterThan(depIdx);
    expect(cssIdx).toBeGreaterThan(embedIdx);
  });

  it('encodes embed as the AEM multi-value form [a,b,c]', () => {
    const xml = renderContentXml(EMBED_LIB);
    expect(xml).toContain('embed="[aemvite.shared.a,aemvite.shared.b]"');
  });

  it('omits embed attribute when not provided', () => {
    const xml = renderContentXml({ name: 'x', categories: ['x'] });
    expect(xml).not.toContain('embed=');
  });

  it('omits embed attribute when empty array', () => {
    const xml = renderContentXml({ name: 'x', categories: ['x'], embed: [] });
    expect(xml).not.toContain('embed=');
  });

  it('renders embed even when dependencies is omitted (slot is independent)', () => {
    const xml = renderContentXml({
      name: 'x',
      categories: ['x'],
      embed: ['a', 'b'],
    });
    expect(xml).not.toContain('dependencies=');
    expect(xml).toContain('embed="[a,b]"');
    // embed must still sit before cssProcessor.
    expect(xml.indexOf('embed=')).toBeLessThan(xml.indexOf('cssProcessor='));
  });
});
