import path from "node:path";
import { realpathSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { InlineConfig } from "vite";
import { loadAemConfig } from "./loadAemConfig.js";
import { resolveBuildOptions } from "./resolveBuildOptions.js";
import type {
  BuildClientlibsOptions,
  CssUrlPassthroughOption,
  HandlebarsOption,
  ResolvedAemClientlib,
  ResolvedAemConfig,
} from "./types.js";

interface StagedFile {
  source: string;
  basename: string;
}

/**
 * Build every clientlib defined by `configPath` and emit byte-identical AEM
 * clientlib folders.
 *
 * For each clientlib:
 * - When `entry` is empty (a descriptor-only clientlib such as a shared
 *   `dependencies` umbrella) the Vite build is skipped but the descriptor is
 *   still emitted.
 * - Otherwise one Vite library build runs into a per-clientlib staging dir
 *   (`<outDir>/clientlib-<name>/`) wiring `aemViteGlob` (SCSS/CSS glob
 *   expansion), `aemResources` (when `resources` are configured), and any
 *   author-supplied `plugins` (global then per-clientlib). Output files are
 *   named after the clientlib (`<name>.js` / `<name>.css`) so `js.txt` /
 *   `css.txt` stay byte-identical to the AEM archetype.
 *
 * The emitter then writes `.content.xml`, `js.txt`, `css.txt` and the
 * `js/`/`css/`/`resources/` layout into `config.clientLibRoot`.
 *
 * Dev mode: no minify + inline sourcemap. Prod mode: esbuild minify (JS + CSS)
 * + no sourcemap. Exact behaviour comes from `resolveBuildOptions`.
 */
export async function buildClientlibs(
  options: BuildClientlibsOptions,
): Promise<{ config: ResolvedAemConfig; outDir: string }> {
  const { mode, configPath } = options;
  const configDir = path.dirname(path.resolve(configPath));
  const outDir = path.resolve(configDir, options.outDir ?? "dist");
  assertSafeOutDir(outDir, configDir);

  const config = await loadAemConfig(configPath, { mode });
  const clientLibRoot = path.resolve(configDir, config.clientLibRoot);

  // The handlebars plugin is only imported when at least one clientlib
  // (or the global config) opts in. This keeps `handlebars` an optional
  // peer dep: projects that don't use it never need to install it.
  const handlebarsNeeded = config.clientlibs.some(
    (c) => (c.handlebars ?? config.handlebars) !== undefined && (c.handlebars ?? config.handlebars) !== false,
  );
  const [vite, glob, resources, cssUrl, clientlibPkg, handlebarsPkg] =
    await Promise.all([
      import("vite"),
      import("@aemvite/vite-plugin-glob"),
      import("@aemvite/vite-plugin-aem-resources"),
      import("@aemvite/vite-plugin-aem-css-url-passthrough"),
      import("@aemvite/vite-plugin-aem-clientlib"),
      handlebarsNeeded
        ? import("@aemvite/vite-plugin-aem-handlebars")
        : Promise.resolve(undefined),
    ]);
  const { build: viteBuild, mergeConfig } = vite;
  const { aemViteGlob } = glob;
  const { aemResources } = resources;
  const { aemCssUrlPassthrough } = cssUrl;
  const { emitClientlib } = clientlibPkg;
  const aemHandlebars = handlebarsPkg?.aemHandlebars;

  // Wipe the shared staging root once so subsequent per-clientlib builds
  // accumulate into it without stale files.
  await rm(outDir, { recursive: true, force: true });

  for (const clientlib of config.clientlibs) {
    const stagingDir = path.join(outDir, `clientlib-${clientlib.name}`);
    const files: StagedFile[] = [];

    if (clientlib.entry) {
      await viteBuild(
        buildInlineConfig(clientlib, config, configDir, stagingDir, mode, {
          aemViteGlob,
          aemResources,
          aemCssUrlPassthrough,
          aemHandlebars,
          mergeConfig,
        }),
      );
      // When Vite emitted external sourcemaps, rewrite the `sourceMappingURL`
      // comment in the staged .js/.css to point at the resources path AEM
      // will actually serve them from (see `collectStagedFiles`).
      await rewriteSourceMappingUrls(stagingDir, clientlib.name);
      await collectStagedFiles(stagingDir, files);
    }

    await emitClientlib({ clientlib, outDir: clientLibRoot, files });
  }

  // Remove `clientlib-*` folders that are no longer part of the config so
  // removed/renamed clientlibs stop shipping to AEM.
  await removeStaleClientlibs(
    clientLibRoot,
    config.clientlibs.map((c) => `clientlib-${c.name}`),
  );

  return { config, outDir };
}

/**
 * Guard against `outDir` being the config dir itself (or containing it):
 * `--out-dir .` would otherwise `rm -rf` the whole project before building.
 */
function assertSafeOutDir(outDir: string, configDir: string): void {
  const rel = path.relative(outDir, configDir);
  const containsConfig =
    rel === "" ||
    (!rel.startsWith(`..${path.sep}`) &&
      rel !== ".." &&
      !path.isAbsolute(rel));
  if (containsConfig) {
    throw new Error(
      `Refusing to build: outDir ${outDir} contains the AEM config at ` +
        `${configDir}. Choose an outDir that does not include the config ` +
        `file to avoid deleting your sources.`,
    );
  }
}

/**
 * Remove `clientlib-*` folders in `clientLibRoot` that are not in `names`.
 * Only directories matching the `clientlib-` prefix are considered.
 */
async function removeStaleClientlibs(
  clientLibRoot: string,
  names: string[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(clientLibRoot, { withFileTypes: true });
  } catch {
    return;
  }
  const keep = new Set(names);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("clientlib-")) continue;
    if (keep.has(entry.name)) continue;
    await rm(path.join(clientLibRoot, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

type ViteHelpers = {
  aemViteGlob: typeof import("@aemvite/vite-plugin-glob").aemViteGlob;
  aemResources: typeof import("@aemvite/vite-plugin-aem-resources").aemResources;
  aemCssUrlPassthrough:
    typeof import("@aemvite/vite-plugin-aem-css-url-passthrough").aemCssUrlPassthrough;
  aemHandlebars:
    | typeof import("@aemvite/vite-plugin-aem-handlebars").aemHandlebars
    | undefined;
  mergeConfig: typeof import("vite").mergeConfig;
};

function buildInlineConfig(
  clientlib: ResolvedAemClientlib,
  config: ResolvedAemConfig,
  configDir: string,
  stagingDir: string,
  mode: BuildClientlibsOptions["mode"],
  {
    aemViteGlob,
    aemResources,
    aemCssUrlPassthrough,
    aemHandlebars,
    mergeConfig,
  }: ViteHelpers,
): InlineConfig {
  const entry = path.resolve(configDir, clientlib.entry);
  const resolved = resolveBuildOptions(mode, config.build, clientlib.build);
  // Resolve symlinks (e.g. macOS `/var` → `/private/var`) so the sourcemap
  // path transform can reconcile with Rollup's real-path source references.
  const realConfigDir = realpathOrSelf(configDir);
  const resourceEntries = (clientlib.resources ?? []).map((from) => ({
    from: path.resolve(configDir, from),
  }));
  // Per-clientlib value wins; explicit `false` opts out of an inherited global.
  const cssUrlOption: CssUrlPassthroughOption | undefined =
    clientlib.cssUrlPassthrough !== undefined
      ? clientlib.cssUrlPassthrough
      : config.cssUrlPassthrough;
  const cssUrlPlugin = cssUrlOption
    ? [aemCssUrlPassthrough(cssUrlOption === true ? {} : cssUrlOption)]
    : [];
  // Per-clientlib handlebars value wins; explicit `false` opts out of an
  // inherited global. The dynamic import in `buildClientlibs` only loads the
  // plugin package when at least one clientlib opts in, so `aemHandlebars`
  // may be `undefined` here; we still guard `handlebarsOption` against that.
  const handlebarsOption: HandlebarsOption | undefined =
    clientlib.handlebars !== undefined ? clientlib.handlebars : config.handlebars;
  const handlebarsPlugin =
    handlebarsOption && aemHandlebars
      ? [aemHandlebars(handlebarsOption === true ? {} : handlebarsOption)]
      : [];

  let inlineConfig: InlineConfig = {
    configFile: false,
    root: configDir,
    mode,
    logLevel: "warn",
    plugins: [
      aemViteGlob(),
      ...(resourceEntries.length ? [aemResources(resourceEntries)] : []),
      ...cssUrlPlugin,
      ...handlebarsPlugin,
      ...(config.plugins ?? []),
      ...(clientlib.plugins ?? []),
    ],
    build: {
      outDir: stagingDir,
      emptyOutDir: true,
      minify: resolved.minify.js ? "esbuild" : false,
      cssMinify: resolved.minify.css ? "esbuild" : false,
      sourcemap: resolved.sourcemap,
      target: resolved.target,
      lib: {
        entry,
        // IIFE wraps the bundle in `(function(){...})()` so top-level `var`,
        // `let`, `const`, `class`, and `function` declarations stay scoped.
        // ESM/CJS would leak them into AEM's aggregation scope where the
        // clientlib's embedded siblings get concatenated into a single served
        // response — colliding declarations (e.g. duplicate runtime helpers
        // from multiple Rolldown-built clientlibs) trigger `SyntaxError:
        // Identifier '<x>' has already been declared` at parse time. The
        // legacy webpack output had the same `(()=>{...})()` shape.
        formats: ["iife"] as ("iife")[],
        // IIFE/UMD require a global var name even when the bundle exposes no
        // exports. Sanitize the clientlib name to a valid JS identifier — the
        // resulting `var <name>` line is harmless (just one global) and
        // structurally what webpack emitted via `output.library`.
        name: toIifeName(clientlib.name),
        fileName: () => `${clientlib.name}.js`,
        // Name the extracted CSS bundle after the clientlib so output stays
        // byte-identical regardless of the consumer's package.json `name`
        // (Vite 8 lib mode otherwise requires one). Yields `<name>.css`.
        cssFileName: clientlib.name,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: (info: { name?: string }) =>
            (info.name ?? "").toLowerCase().endsWith(".css")
              ? `${clientlib.name}.css`
              : "[name][extname]",
          // Rewrite sourcemap `sources[]` to a stable virtual URL rooted at
          // the consumer project so DevTools (a) doesn't try to fetch the
          // original files from the served `.js` path (where they don't
          // exist) and (b) groups them under a clean `aemvite://<clientlib>/`
          // tree in the Sources panel. `relativeSourcePath` is relative to
          // the emitted `.map` file (i.e. the staging dir). We anchor on
          // `stagingDir` and use the real (symlink-resolved) project root so
          // paths reconcile cleanly on macOS where `/var` → `/private/var`.
          // Vite/Rollup only invokes this when sourcemaps are emitted.
          sourcemapPathTransform: (relativeSourcePath: string): string => {
            const abs = path.resolve(stagingDir, relativeSourcePath);
            const rel = path
              .relative(realConfigDir, abs)
              .split(path.sep)
              .join("/");
            return `aemvite://${clientlib.name}/${rel}`;
          },
        },
      },
    },
  };

  if (config.vite) inlineConfig = mergeConfig(inlineConfig, config.vite);
  if (clientlib.vite) inlineConfig = mergeConfig(inlineConfig, clientlib.vite);
  return inlineConfig;
}

/**
 * Stage the per-entry JS/CSS plus any copied `resources/` tree, and route any
 * sourcemap siblings (`*.js.map` / `*.css.map`) under `resources/sourcemaps/`
 * so AEM serves them as plain static files. The emitter's `resources` bucket
 * preserves the nested `sourcemaps/` prefix from the basename.
 *
 * The whole staging dir is walked so no emitted file is silently dropped:
 * every file outside the top-level code bundles (Vite assets emitted at the
 * root, `assets/` subtrees, fonts, wasm, …) lands in the `resources/` bucket,
 * preserving its relative path.
 *
 * AEM's clientlib aggregator concatenates `js/` / `css/` contents into one
 * served response, and Sling URL decomposition (`site.js.map` → selectors=js,
 * extension=map) 404s the top-level proxy path. Routing maps through the
 * `resources/` subtree avoids both problems — the `sourceMappingURL` comment
 * in the JS/CSS is rewritten to match (see `rewriteSourceMappingUrls`).
 */
async function collectStagedFiles(
  stagingDir: string,
  files: StagedFile[],
): Promise<void> {
  for (const rel of await walk(stagingDir)) {
    const posix = rel.split(path.sep).join("/");
    const topLevel = !posix.includes("/");
    const basename = posix.startsWith("resources/")
      ? posix.slice("resources/".length)
      : posix;
    const lower = basename.toLowerCase();
    if (topLevel && (lower.endsWith(".js") || lower.endsWith(".css"))) {
      // The per-clientlib code bundles (e.g. `site.js` / `site.css`).
      files.push({
        source: path.join(stagingDir, rel),
        basename,
      });
    } else if (topLevel && lower.endsWith(".map")) {
      // Nested basename routes the map to `resources/sourcemaps/<file>` via
      // the emitter's `resources` bucket (classifyFile routes `.map` there).
      files.push({
        source: path.join(stagingDir, rel),
        basename: `sourcemaps/${basename}`,
      });
    } else {
      // Everything else (images, fonts, wasm, nested assets, nested
      // subdirectories) is routed to the emitter, which buckets it by
      // extension (nested `.js`/`.css` end up in the code buckets, the rest
      // under `resources/`).
      files.push({ source: path.join(stagingDir, rel), basename });
    }
  }
}

/**
 * Rewrite the `sourceMappingURL` comment in every staged `.js` / `.css` so it
 * points at the AEM-served resources path where `collectStagedFiles` will
 * deposit the corresponding `.map`. The browser resolves `sourceMappingURL`
 * relative to the served code URL; for an AEM clientlib aggregated at
 * `/etc.clientlibs/<proj>/clientlibs/clientlib-<name>.js`, a relative URL of
 * `clientlib-<name>/resources/sourcemaps/<file>.map` resolves to the static
 * resource served by AEM at the same path.
 *
 * Vite emits the comment as the final line(s) of the file:
 *   JS:  `//# sourceMappingURL=site.js.map`
 *   CSS: `/*# sourceMappingURL=site.css.map *\/`
 * We rewrite only the URL token, leaving everything else untouched.
 */
async function rewriteSourceMappingUrls(
  stagingDir: string,
  clientlibName: string,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(stagingDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (lower.endsWith(".map")) continue;
    if (!lower.endsWith(".js") && !lower.endsWith(".css")) continue;
    const full = path.join(stagingDir, entry.name);
    const content = await readFile(full, "utf8");
    const mapName = `${entry.name}.map`;
    const newUrl =
      `clientlib-${clientlibName}/resources/sourcemaps/${mapName}`;
    let rewritten = content.replace(
      /\/\/# sourceMappingURL=[^\s]+/,
      `//# sourceMappingURL=${newUrl}`,
    );
    rewritten = rewritten.replace(
      /\/\*# sourceMappingURL=[^\s]+ \*\//,
      `/*# sourceMappingURL=${newUrl} */`,
    );
    if (rewritten !== content) {
      await writeFile(full, rewritten, "utf8");
    }
  }
}

function realpathOrSelf(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * Map a clientlib folder name to a valid JS identifier for IIFE `lib.name`.
 * Replaces any character outside `[A-Za-z0-9_$]` with `_` and prefixes a
 * leading digit with `_` so the result is a legal `var` binding. Prefixed
 * with `__aemvite_` to keep the single emitted global distinct from any
 * project symbols that could otherwise collide via AEM aggregation.
 */
function toIifeName(clientlibName: string): string {
  const sanitized = clientlibName.replace(/[^A-Za-z0-9_$]/g, "_");
  const safe = /^[0-9]/.test(sanitized) ? `_${sanitized}` : sanitized;
  return `__aemvite_${safe}`;
}

async function walk(dir: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walk(path.join(dir, entry.name), rel)));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}
