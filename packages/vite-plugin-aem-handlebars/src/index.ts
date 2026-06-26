import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';

/**
 * Options forwarded verbatim to `Handlebars.precompile`. Re-declared as
 * `unknown` so the plugin does not pin a specific `@types/handlebars`
 * shape across consumer versions.
 */
export type HandlebarsPrecompileOptions = Record<string, unknown>;

export interface AemHandlebarsOptions {
  /**
   * Suffix that marks a Handlebars source as a template that should be
   * precompiled into an executable runtime function. Files matching this
   * suffix are transformed; other `.hbs` files are treated as partials and
   * stubbed out (unless `ignore: false`). Default: `.template.hbs`.
   */
  templateSuffix?: string;
  /**
   * Options forwarded to `Handlebars.precompile`. Default: `{ strict: false }`.
   */
  precompileOptions?: HandlebarsPrecompileOptions;
  /**
   * Module specifier used in the emitted `import Handlebars from "..."`
   * statement. Default: `"handlebars/runtime"`.
   */
  runtime?: string;
  /**
   * Stub modules out as empty ESM modules (matches the legacy webpack
   * `IgnorePlugin` behavior). Always includes:
   *   - `*.stories.{js,ts,tsx}`
   *   - non-template `*.hbs` partials (anything matching `*.hbs` but NOT
   *     `<templateSuffix>`)
   *
   * Pass an array of `RegExp` / pattern strings to add ADDITIONAL patterns
   * on top of the defaults. Pass `false` to disable stubbing entirely.
   */
  ignore?: false | readonly (RegExp | string)[];
}

const STUB_ID = '\0aemvite-handlebars-stub';
const DEFAULT_PRECOMPILE_OPTIONS: HandlebarsPrecompileOptions = { strict: false };
const DEFAULT_RUNTIME = 'handlebars/runtime';
const DEFAULT_TEMPLATE_SUFFIX = '.template.hbs';

/**
 * Vite plugin that precompiles `*.template.hbs` files into runtime
 * Handlebars functions and stubs Storybook-only / non-template `.hbs`
 * partials. Drop-in replacement for the webpack `handlebars-loader` +
 * `IgnorePlugin` pair in AEM clientlib builds.
 *
 * Emitted module shape:
 *
 * ```js
 * import Handlebars from "handlebars/runtime";
 * export default Handlebars.template(<precompiled>);
 * ```
 *
 * @example Direct usage in a Vite config
 * ```ts
 * import { aemHandlebars } from "@aemvite/vite-plugin-aem-handlebars";
 *
 * export default defineConfig({
 *   plugins: [aemHandlebars()],
 * });
 * ```
 *
 * @example Through `@aemvite/aem-config`
 * ```ts
 * export default defineAemConfig({
 *   handlebars: true,
 *   clientlibs: [ ... ],
 * });
 * ```
 */
export function aemHandlebars(options: AemHandlebarsOptions = {}): Plugin {
  const templateSuffix = options.templateSuffix ?? DEFAULT_TEMPLATE_SUFFIX;
  const precompileOptions = options.precompileOptions ?? DEFAULT_PRECOMPILE_OPTIONS;
  const runtime = options.runtime ?? DEFAULT_RUNTIME;
  const stubbingEnabled = options.ignore !== false;
  const extraStubInput: readonly (RegExp | string)[] =
    options.ignore === false || options.ignore === undefined ? [] : options.ignore;
  const extraStubMatchers: RegExp[] = extraStubInput.map((p) =>
    p instanceof RegExp ? p : new RegExp(p),
  );
  const isStub = (id: string): boolean => {
    if (!stubbingEnabled) return false;
    if (/\.stories\.(js|ts|tsx)$/.test(id)) return true;
    if (/\.hbs$/.test(id) && !id.endsWith(templateSuffix)) return true;
    return extraStubMatchers.some((re) => re.test(id));
  };

  return {
    name: 'aemvite:handlebars',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!stubbingEnabled) return null;
      if (isStub(source)) return STUB_ID;
      if (importer && isStub(importer) && !source.endsWith(templateSuffix)) {
        return STUB_ID;
      }
      return null;
    },
    load(id) {
      if (id === STUB_ID) return 'export default {};\n';
      return null;
    },
    async transform(_code, id) {
      if (!id.endsWith(templateSuffix)) return null;
      // Lazily import `handlebars` so projects that don't enable this
      // plugin never need to install the (peer) dep. The import is cached
      // by Node's module registry after the first call.
      const Handlebars = await loadHandlebars();
      const source = await readFile(id, 'utf8');
      const precompiled = Handlebars.precompile(source, precompileOptions);
      const code =
        `import Handlebars from ${JSON.stringify(runtime)};\n` +
        `export default Handlebars.template(${precompiled});\n`;
      return { code, map: null };
    },
  };
}

type HandlebarsLike = {
  precompile: (source: string, options?: unknown) => string;
};

async function loadHandlebars(): Promise<HandlebarsLike> {
  try {
    const mod = (await import('handlebars')) as unknown as {
      default?: HandlebarsLike;
      precompile?: HandlebarsLike['precompile'];
    };
    if (mod.default && typeof mod.default.precompile === 'function') {
      return mod.default;
    }
    if (typeof mod.precompile === 'function') {
      return mod as HandlebarsLike;
    }
    throw new Error('`handlebars` module is missing a `precompile` export');
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      "@aemvite/vite-plugin-aem-handlebars: cannot find peer dependency 'handlebars'. " +
        `Install it with \`npm i -D handlebars\`. (${reason})`,
    );
  }
}

export default aemHandlebars;
