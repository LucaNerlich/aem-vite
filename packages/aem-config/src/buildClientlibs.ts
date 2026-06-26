import path from "node:path";
import { readdir, rm } from "node:fs/promises";
import type { InlineConfig } from "vite";
import { loadAemConfig } from "./loadAemConfig.js";
import { resolveBuildOptions } from "./resolveBuildOptions.js";
import type {
  BuildClientlibsOptions,
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

  const [vite, glob, resources, clientlibPkg] = await Promise.all([
    import("vite"),
    import("@aemvite/vite-plugin-glob"),
    import("@aemvite/vite-plugin-aem-resources"),
    import("@aemvite/vite-plugin-aem-clientlib"),
  ]);
  const { build: viteBuild, mergeConfig } = vite;
  const { aemViteGlob } = glob;
  const { aemResources } = resources;
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
          mergeConfig,
        }),
      );
      await collectStagedFiles(stagingDir, files);
    }

    await emitClientlib({ clientlib, outDir: clientLibRoot, files });
  }

  return { config, outDir };
}

type ViteHelpers = {
  aemViteGlob: typeof import("@aemvite/vite-plugin-glob").aemViteGlob;
  aemResources: typeof import("@aemvite/vite-plugin-aem-resources").aemResources;
  mergeConfig: typeof import("vite").mergeConfig;
};

function buildInlineConfig(
  clientlib: ResolvedAemClientlib,
  config: ResolvedAemConfig,
  configDir: string,
  stagingDir: string,
  mode: BuildClientlibsOptions["mode"],
  { aemViteGlob, aemResources, mergeConfig }: ViteHelpers,
): InlineConfig {
  const entry = path.resolve(configDir, clientlib.entry);
  const resolved = resolveBuildOptions(mode, config.build, clientlib.build);
  const resourceEntries = (clientlib.resources ?? []).map((from) => ({
    from: path.resolve(configDir, from),
  }));

  let inlineConfig: InlineConfig = {
    configFile: false,
    root: configDir,
    mode,
    logLevel: "warn",
    plugins: [
      aemViteGlob(),
      ...(resourceEntries.length ? [aemResources(resourceEntries)] : []),
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
        formats: ["es"] as ("es")[],
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
        },
      },
    },
  };

  if (config.vite) inlineConfig = mergeConfig(inlineConfig, config.vite);
  if (clientlib.vite) inlineConfig = mergeConfig(inlineConfig, clientlib.vite);
  return inlineConfig;
}

/** Stage the per-entry JS/CSS plus any copied `resources/` tree. */
async function collectStagedFiles(
  stagingDir: string,
  files: StagedFile[],
): Promise<void> {
  for (const entry of await readdir(stagingDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext === ".js" || ext === ".css") {
      files.push({
        source: path.join(stagingDir, entry.name),
        basename: entry.name,
      });
    }
  }

  const resourcesDir = path.join(stagingDir, "resources");
  for (const rel of await walk(resourcesDir)) {
    files.push({ source: path.join(resourcesDir, rel), basename: rel });
  }
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
