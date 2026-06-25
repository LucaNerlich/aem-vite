export { defineAemConfig } from "./defineAemConfig.js";
export { loadAemConfig } from "./loadAemConfig.js";
export { mergeDefaults } from "./mergeDefaults.js";
export { buildClientlibs } from "./buildClientlibs.js";
export {
  resolveClientlibEmitter,
  type ClientlibEmitter,
  type ClientlibEmitterInput,
} from "./clientlibEmitter.js";
export { defaults, defaultTarget, modeBaselines } from "./defaults.js";
export { resolveBuildOptions } from "./resolveBuildOptions.js";
export type {
  AemClientlib,
  AemConfig,
  BuildClientlibsOptions,
  BuildMode,
  BuildOptions,
  ProcessorList,
  ResolvedAemClientlib,
  ResolvedAemConfig,
  ResolvedBuildOptions,
} from "./types.js";
