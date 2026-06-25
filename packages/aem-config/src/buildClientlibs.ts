import path from "node:path";
import { loadAemConfig } from "./loadAemConfig.js";
import {
  resolveClientlibEmitter,
  type ClientlibEmitter,
} from "./clientlibEmitter.js";
import { resolveBuildOptions } from "./resolveBuildOptions.js";
import type {
  BuildClientlibsOptions,
  BuildMode,
  BuildOptions,
  ResolvedAemClientlib,
  ResolvedAemConfig,
} from "./types.js";

export interface BuildClientlibsExtraOptions {
  /** Optional emitter override (mainly for tests). */
  emitter?: ClientlibEmitter | null;
}

/**
 * Build every clientlib defined by `configPath` by running one Vite library
 * build per entry into a shared `outDir`, then invoking the clientlib emitter.
 *
 * Dev mode: no minify + inline sourcemap.
 * Prod mode: esbuild minify for JS and CSS + no sourcemap.
 *
 * `emptyOutDir` is set to `true` only for the first build so subsequent builds
 * accumulate into the same `dist/`.
 */
export async function buildClientlibs(
  options: BuildClientlibsOptions & BuildClientlibsExtraOptions,
): Promise<{ config: ResolvedAemConfig; outDir: string }> {
  const { mode, configPath } = options;
  const configDir = path.dirname(path.resolve(configPath));
  const outDir = path.resolve(configDir, options.outDir ?? "dist");

  const config = await loadAemConfig(configPath);

  const { build } = await import("vite");

  for (let i = 0; i < config.clientlibs.length; i++) {
    const clientlib = config.clientlibs[i]!;
    await build(
      buildOptionsFor(
        clientlib,
        configDir,
        outDir,
        mode,
        i === 0,
        config.build,
      ),
    );
  }

  const emitter =
    options.emitter === undefined
      ? await resolveClientlibEmitter()
      : options.emitter;
  if (emitter) {
    await emitter.emit({ config, outDir });
  }

  return { config, outDir };
}

export function buildOptionsFor(
  clientlib: ResolvedAemClientlib,
  configDir: string,
  outDir: string,
  mode: BuildMode,
  isFirst: boolean,
  globalBuild?: BuildOptions,
) {
  const entry = path.resolve(configDir, clientlib.entry);
  const entryName = stripExt(path.basename(entry));
  const baseDir = clientlib.name;
  const resolved = resolveBuildOptions(mode, globalBuild, clientlib.build);

  return {
    configFile: false as const,
    mode,
    logLevel: "warn" as const,
    build: {
      outDir,
      emptyOutDir: isFirst,
      minify: (resolved.minify.js ? "esbuild" : false) as "esbuild" | false,
      cssMinify: (resolved.minify.css ? "esbuild" : false) as "esbuild" | false,
      sourcemap: resolved.sourcemap,
      target: resolved.target,
      lib: {
        entry,
        formats: ["es"] as ("es")[],
        fileName: () => `${baseDir}/${entryName}.js`,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: `${baseDir}/[name][extname]`,
        },
      },
    },
  };
}

function stripExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? name : name.slice(0, idx);
}
