import { defaultTarget, modeBaselines } from "./defaults.js";
import type {
  BuildMode,
  BuildOptions,
  ResolvedBuildOptions,
} from "./types.js";

type MinifyInput = BuildOptions["minify"];

/**
 * Resolve build options for a single clientlib in three layers (lowest →
 * highest precedence): mode baseline → global `AemConfig.build` → per-clientlib
 * `AemClientlib.build`.
 *
 * `minify`:
 * - Boolean `true` ⇒ `{ js: true, css: true }`; `false` ⇒ both off.
 * - Object form overrides per-asset; unspecified keys fall through to the next
 *   layer (per-clientlib `{ js: true }` keeps the lower-layer `css` value).
 *
 * `sourcemap` and `target` are plain overrides; the higher layer wins.
 */
export function resolveBuildOptions(
  mode: BuildMode,
  global?: BuildOptions,
  perClientlib?: BuildOptions,
): ResolvedBuildOptions {
  const baseline = modeBaselines[mode];
  return {
    minify: {
      js: pickMinify("js", perClientlib?.minify, global?.minify, baseline.minify),
      css: pickMinify(
        "css",
        perClientlib?.minify,
        global?.minify,
        baseline.minify,
      ),
    },
    sourcemap:
      perClientlib?.sourcemap ?? global?.sourcemap ?? baseline.sourcemap ?? false,
    target: perClientlib?.target ?? global?.target ?? defaultTarget,
  };
}

/**
 * Walk minify layers from highest → lowest precedence and pick the first
 * defined value for `key`. Boolean layers always answer; object layers only
 * answer when they specify the key.
 */
function pickMinify(
  key: "js" | "css",
  ...layers: readonly MinifyInput[]
): boolean {
  for (const layer of layers) {
    if (layer === undefined) continue;
    if (typeof layer === "boolean") return layer;
    if (layer[key] !== undefined) return layer[key]!;
  }
  return false;
}
