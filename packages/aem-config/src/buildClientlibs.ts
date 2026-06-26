import path from "node:path";
import { realpathSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { InlineConfig } from "vite";
import { loadAemConfig } from "./loadAemConfig.js";
import { resolveBuildOptions } from "./resolveBuildOptions.js";
import type {
  BuildClientlibsOptions,
  CssUrlPassthroughOption,
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

  const config = await loadAemConfig(configPath);
  const clientLibRoot = path.resolve(configDir, config.clientLibRoot);

  const [vite, glob, resources, cssUrl, clientlibPkg] = await Promise.all([
    import("vite"),
    import("@aemvite/vite-plugin-glob"),
    import("@aemvite/vite-plugin-aem-resources"),
    import("@aemvite/vite-plugin-aem-css-url-passthrough"),
    import("@aemvite/vite-plugin-aem-clientlib"),
  ]);
  const { build: viteBuild, mergeConfig } = vite;
  const { aemViteGlob } = glob;
  const { aemResources } = resources;
  const { aemCssUrlPassthrough } = cssUrl;
  const { emitClientlib } = clientlibPkg;

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

  return { config, outDir };
}

type ViteHelpers = {
  aemViteGlob: typeof import("@aemvite/vite-plugin-glob").aemViteGlob;
  aemResources: typeof import("@aemvite/vite-plugin-aem-resources").aemResources;
  aemCssUrlPassthrough:
    typeof import("@aemvite/vite-plugin-aem-css-url-passthrough").aemCssUrlPassthrough;
  mergeConfig: typeof import("vite").mergeConfig;
};

function buildInlineConfig(
  clientlib: ResolvedAemClientlib,
  config: ResolvedAemConfig,
  configDir: string,
  stagingDir: string,
  mode: BuildClientlibsOptions["mode"],
  { aemViteGlob, aemResources, aemCssUrlPassthrough, mergeConfig }: ViteHelpers,
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

  let inlineConfig: InlineConfig = {
    configFile: false,
    root: configDir,
    mode,
    logLevel: "warn",
    plugins: [
      aemViteGlob(),
      ...(resourceEntries.length ? [aemResources(resourceEntries)] : []),
      ...cssUrlPlugin,
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
  for (const entry of await readdir(stagingDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    const ext = path.extname(lower);
    const isCodeFile = ext === ".js" || ext === ".css";
    const isSourcemap =
      lower.endsWith(".js.map") || lower.endsWith(".css.map");
    if (isCodeFile) {
      files.push({
        source: path.join(stagingDir, entry.name),
        basename: entry.name,
      });
    } else if (isSourcemap) {
      // Nested basename routes the map to `resources/sourcemaps/<file>` via
      // the emitter's `resources` bucket (classifyFile routes `.map` there).
      files.push({
        source: path.join(stagingDir, entry.name),
        basename: `sourcemaps/${entry.name}`,
      });
    }
  }

  const resourcesDir = path.join(stagingDir, "resources");
  for (const rel of await walk(resourcesDir)) {
    files.push({ source: path.join(resourcesDir, rel), basename: rel });
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
