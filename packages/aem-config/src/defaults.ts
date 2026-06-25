import type { AemClientlib, BuildMode, BuildOptions } from "./types.js";

/**
 * Default values applied to every clientlib when none is specified.
 * Mirrors the historical `aem-clientlib-generator` `libsBaseConfig`.
 */
export const defaults: Required<
  Pick<
    AemClientlib,
    "allowProxy" | "serializationFormat" | "cssProcessor" | "jsProcessor"
  >
> = {
  allowProxy: true,
  serializationFormat: "xml",
  cssProcessor: ["default:none", "min:none"],
  jsProcessor: ["default:none", "min:none"],
};

/**
 * Per-mode baseline for build options. Layered under `AemConfig.build` and
 * per-clientlib `AemClientlib.build`.
 */
export const modeBaselines: Record<BuildMode, BuildOptions> = {
  development: { minify: false, sourcemap: "inline" },
  production: { minify: { js: true, css: true }, sourcemap: false },
};

/** Default esbuild target when no `build.target` is set anywhere. */
export const defaultTarget: string = "es2015";
