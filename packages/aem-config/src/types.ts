import type { PluginOption, UserConfig } from "vite";

export type ProcessorList = readonly string[];

/**
 * Toggle / configure the CSS `url()` passthrough plugin
 * (`@aemvite/vite-plugin-aem-css-url-passthrough`). When truthy, the plugin
 * is auto-wired into each clientlib's build.
 *
 * - `true` — wire with default `resourceDirs` (`["images", "fonts"]`).
 * - `false` — explicitly disable (overrides a global `true`).
 * - object — wire with the supplied options.
 */
export type CssUrlPassthroughOption =
  | boolean
  | { resourceDirs?: readonly string[] };

/**
 * Toggle / configure the Handlebars precompile + Storybook-stub plugin
 * (`@aemvite/vite-plugin-aem-handlebars`). When truthy, the plugin is
 * auto-wired into each clientlib's build, precompiling `*.template.hbs`
 * files into runtime modules and stubbing Storybook-only / non-template
 * `*.hbs` partials.
 *
 * - `true` — wire with defaults.
 * - `false` — explicitly disable (overrides a global `true`).
 * - object — wire with the supplied options. Shape mirrors
 *   `AemHandlebarsOptions` from the plugin package, kept as a structural
 *   type here so the consumer config does not need a direct import.
 */
export type HandlebarsOption =
  | boolean
  | {
      templateSuffix?: string;
      precompileOptions?: Record<string, unknown>;
      runtime?: string;
      ignore?: false | readonly (RegExp | string)[];
    };

/**
 * Author-facing build options. Each field is optional and overlays on top of
 * the mode baseline (development/production) and the global `AemConfig.build`.
 *
 * - `minify`: boolean toggles both JS and CSS; object form overrides per-asset.
 * - `sourcemap`: `true`/`false`/`"inline"`/`"hidden"` (forwarded to Vite).
 * - `target`: esbuild build target (e.g. `"es2015"` or `["es2015", "chrome58"]`).
 */
export interface BuildOptions {
  minify?: boolean | { js?: boolean; css?: boolean };
  sourcemap?: boolean | "inline" | "hidden";
  target?: string | string[];
}

/**
 * Fully resolved build options used by `buildClientlibs` to drive each
 * per-entry Vite build.
 */
export interface ResolvedBuildOptions {
  minify: { js: boolean; css: boolean };
  sourcemap: boolean | "inline" | "hidden";
  target: string | string[];
}

export interface AemClientlib {
  /** Clientlib folder name (e.g. `clientlib-site`). */
  name: string;
  /** Path to the entry source file (relative to config dir or absolute). */
  entry: string;
  /** AEM categories array. */
  categories: readonly string[];
  /** Other clientlib categories this depends on. */
  dependencies?: readonly string[];
  /** Embedded clientlib categories. */
  embed?: readonly string[];
  /** Resource directories to copy into the clientlib's `resources/` folder. */
  resources?: readonly string[];
  /** Whether the clientlib is proxyable via `/etc.clientlibs`. */
  allowProxy?: boolean;
  /** Serialization format of `.content.xml` (default: `"xml"`). */
  serializationFormat?: "xml";
  /** AEM CSS processor directives. */
  cssProcessor?: ProcessorList;
  /** AEM JS processor directives. */
  jsProcessor?: ProcessorList;
  /** Per-clientlib build overrides; layered over `AemConfig.build`. */
  build?: BuildOptions;
  /**
   * Per-clientlib override for the CSS `url()` passthrough plugin. Takes
   * precedence over the global `AemConfig.cssUrlPassthrough`. Set explicitly
   * to `false` to opt out when the global is enabled.
   */
  cssUrlPassthrough?: CssUrlPassthroughOption;
  /**
   * Per-clientlib override for the Handlebars plugin. Takes precedence over
   * the global `AemConfig.handlebars`. Set explicitly to `false` to opt out
   * when the global is enabled.
   */
  handlebars?: HandlebarsOption;
  /**
   * Extra Vite plugins applied to this clientlib's build, after the built-in
   * `aemViteGlob` / `aemResources` and after `AemConfig.plugins`. Lets advanced
   * adopters inject e.g. a framework plugin without writing a build script.
   */
  plugins?: PluginOption[];
  /**
   * Deep Vite config override merged (via Vite's `mergeConfig`) into this
   * clientlib's generated inline config — the final escape hatch.
   */
  vite?: UserConfig;
}

export interface AemConfig {
  /** Absolute or relative path where clientlib folders are written. */
  clientLibRoot: string;
  /** Clientlib definitions. */
  clientlibs: AemClientlib[];
  /** Per-clientlib defaults merged into each entry of `clientlibs`. */
  defaults?: Partial<AemClientlib>;
  /** Global build options applied to every clientlib (overridden per-clientlib). */
  build?: BuildOptions;
  /**
   * Auto-wire `@aemvite/vite-plugin-aem-css-url-passthrough` into every
   * clientlib build. Restores webpack `css-loader: { url: false }` semantics:
   * rewrites every `url(...)` containing `resources/<sub>/` back to the
   * canonical `../resources/<sub>/<file>` form. Override per-clientlib via
   * `AemClientlib.cssUrlPassthrough`.
   */
  cssUrlPassthrough?: CssUrlPassthroughOption;
  /**
   * Auto-wire `@aemvite/vite-plugin-aem-handlebars` into every clientlib
   * build. Precompiles `*.template.hbs` files into runtime Handlebars
   * functions and stubs Storybook-only / non-template `*.hbs` partials.
   * Drop-in replacement for the webpack `handlebars-loader` + `IgnorePlugin`
   * pair. Override per-clientlib via `AemClientlib.handlebars`.
   *
   * Consumers must install `handlebars` themselves (peer dep of the plugin
   * package).
   */
  handlebars?: HandlebarsOption;
  /**
   * Extra Vite plugins applied to every clientlib build, after the built-in
   * `aemViteGlob` / `aemResources` and before any per-clientlib `plugins`.
   */
  plugins?: PluginOption[];
  /** Deep Vite config override merged into every clientlib's inline config. */
  vite?: UserConfig;
}

export type ResolvedAemClientlib = AemClientlib &
  Required<
    Pick<
      AemClientlib,
      "allowProxy" | "serializationFormat" | "cssProcessor" | "jsProcessor"
    >
  >;

export interface ResolvedAemConfig {
  clientLibRoot: string;
  clientlibs: ResolvedAemClientlib[];
  /** Raw global build options (resolved per-mode at build time). */
  build?: BuildOptions;
  /** Global CSS `url()` passthrough toggle (resolved per-clientlib at build time). */
  cssUrlPassthrough?: CssUrlPassthroughOption;
  /** Global Handlebars toggle (resolved per-clientlib at build time). */
  handlebars?: HandlebarsOption;
  /** Global extra Vite plugins (applied to every clientlib build). */
  plugins?: PluginOption[];
  /** Global deep Vite config override. */
  vite?: UserConfig;
}

export type BuildMode = "development" | "production";

export interface BuildClientlibsOptions {
  mode: BuildMode;
  configPath: string;
  outDir?: string;
}
