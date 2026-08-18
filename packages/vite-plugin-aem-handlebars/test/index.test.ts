import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { aemHandlebars } from '../src/index.js';

type ResolveIdHook = (
  source: string,
  importer?: string,
) => Promise<string | null | undefined> | string | null | undefined;
type LoadHook = (id: string) => string | null | undefined;
type TransformHook = (
  code: string,
  id: string,
) => Promise<{ code: string; map: null } | null | undefined>;

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aemvite-hbs-'));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeFile(name: string, body: string): Promise<string> {
  const full = path.join(tmpRoot, name);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
  return full;
}

describe('aemHandlebars', () => {
  describe('template precompilation', () => {
    it('precompiles *.template.hbs into a runtime ESM module', async () => {
      const plugin = aemHandlebars();
      const id = await writeFile('foo.template.hbs', '<p>{{name}}</p>');
      const transform = plugin.transform as TransformHook;
      const result = await transform('', id);
      expect(result).not.toBeNull();
      expect(result!.code).toMatch(
        /^import Handlebars from "handlebars\/runtime";\nexport default Handlebars\.template\(/,
      );
      expect(result!.code.trimEnd().endsWith(');')).toBe(true);
      expect(result!.map).toBeNull();
    });

    it('ignores non-template files in transform', async () => {
      const plugin = aemHandlebars();
      const id = await writeFile('partial.hbs', '{{title}}');
      const transform = plugin.transform as TransformHook;
      expect(await transform('', id)).toBeNull();
      expect(await transform('', path.join(tmpRoot, 'main.ts'))).toBeNull();
    });

    it('honors a custom templateSuffix and runtime', async () => {
      const plugin = aemHandlebars({
        templateSuffix: '.hbs.tpl',
        runtime: 'my-handlebars-shim',
      });
      const id = await writeFile('foo.hbs.tpl', '<p>{{name}}</p>');
      const transform = plugin.transform as TransformHook;
      const result = await transform('', id);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('import Handlebars from "my-handlebars-shim";');
    });
  });

  describe('storybook + non-template stubbing', () => {
    it('stubs *.stories.{js,ts,tsx} and non-template *.hbs by default', async () => {
      const plugin = aemHandlebars();
      const resolveId = plugin.resolveId as ResolveIdHook;
      const load = plugin.load as LoadHook;

      const stories = await resolveId('./Foo.stories.tsx');
      const partial = await resolveId('./partial.hbs');
      const template = await resolveId('./foo.template.hbs');
      const realModule = await resolveId('./main.ts');

      expect(stories).toBe('\0aemvite-handlebars-stub');
      expect(partial).toBe('\0aemvite-handlebars-stub');
      expect(template).toBeNull();
      expect(realModule).toBeNull();

      expect(load('\0aemvite-handlebars-stub')).toBe('export default {};\n');
      expect(load('./real.ts')).toBeNull();
    });

    it('treats imports from stubbed modules as also stubbed', async () => {
      const plugin = aemHandlebars();
      const resolveId = plugin.resolveId as ResolveIdHook;
      const result = await resolveId('./util.ts', './foo.stories.ts');
      expect(result).toBe('\0aemvite-handlebars-stub');
    });

    it('disables stubbing entirely when ignore is false', async () => {
      const plugin = aemHandlebars({ ignore: false });
      const resolveId = plugin.resolveId as ResolveIdHook;
      expect(await resolveId('./Foo.stories.tsx')).toBeNull();
      expect(await resolveId('./partial.hbs')).toBeNull();
    });

    it('accepts extra ignore patterns as RegExp or strings', async () => {
      const plugin = aemHandlebars({
        ignore: [/vendors\/tabs\.js$/, 'legacy/[a-z]+\\.js$'],
      });
      const resolveId = plugin.resolveId as ResolveIdHook;
      expect(await resolveId('./vendors/tabs.js')).toBe('\0aemvite-handlebars-stub');
      expect(await resolveId('./legacy/foo.js')).toBe('\0aemvite-handlebars-stub');
      expect(await resolveId('./Foo.stories.tsx')).toBe('\0aemvite-handlebars-stub');
      expect(await resolveId('./main.ts')).toBeNull();
    });

    it('does not stub *.hbs files that match the custom templateSuffix', async () => {
      const plugin = aemHandlebars({ templateSuffix: '.tpl.hbs' });
      const resolveId = plugin.resolveId as ResolveIdHook;
      expect(await resolveId('./foo.tpl.hbs')).toBeNull();
      expect(await resolveId('./other.hbs')).toBe('\0aemvite-handlebars-stub');
    });
  });
});

describe('aemHandlebars — strict precompilation', () => {
  /**
   * Materialise the generated ESM module on disk (next to this test, so
   * `handlebars/runtime` resolves) and dynamically import it to obtain the
   * render function.
   */
  async function materializeModule(code: string): Promise<(data: unknown) => string> {
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.join(here, `.hbs-materialized-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
    await fs.writeFile(file, code, 'utf8');
    try {
      const mod = (await import(`${new URL(`file://${file}`).href}?t=${Date.now()}`)) as {
        default?: (data: unknown) => string;
      };
      if (!mod.default) throw new Error('materialized module has no default export');
      return mod.default;
    } finally {
      await fs.rm(file, { force: true }).catch(() => {});
    }
  }

  it('throws on missing deep property paths by default (strict: true)', async () => {
    const plugin = aemHandlebars();
    const id = await writeFile('strict.template.hbs', '<p>{{a.b.c}}</p>');
    const result = await (plugin.transform as TransformHook)('', id);
    expect(result).not.toBeNull();

    const render = await materializeModule(result!.code);
    expect(() => render({})).toThrow();
  });

  it('renders present paths correctly under the default', async () => {
    const plugin = aemHandlebars();
    const id = await writeFile('ok.template.hbs', '<p>{{name}}</p>');
    const result = await (plugin.transform as TransformHook)('', id);

    const render = await materializeModule(result!.code);
    expect(render({ name: 'AEM' })).toBe('<p>AEM</p>');
  });

  it('allows opting out via precompileOptions', async () => {
    const plugin = aemHandlebars({ precompileOptions: { strict: false } });
    const id = await writeFile('loose.template.hbs', '<p>{{a.b.c}}</p>');
    const result = await (plugin.transform as TransformHook)('', id);

    const render = await materializeModule(result!.code);
    expect(render({})).toBe('<p></p>');
  });
});
