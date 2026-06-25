export type ProcessorList = readonly string[];

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
}

export type BuildMode = "development" | "production";

export interface BuildClientlibsOptions {
  mode: BuildMode;
  configPath: string;
  outDir?: string;
}
