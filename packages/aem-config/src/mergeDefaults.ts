import { defaults } from "./defaults.js";
import type {
  AemClientlib,
  AemConfig,
  ResolvedAemClientlib,
  ResolvedAemConfig,
} from "./types.js";

/**
 * Merge the package-level `defaults` followed by the user-supplied
 * `config.defaults` block into every clientlib entry.
 *
 * Precedence (highest wins): per-clientlib values → `config.defaults` →
 * built-in `defaults`.
 *
 * Array fields (`cssProcessor`, `jsProcessor`, `dependencies`, `embed`,
 * `categories`, `resources`) are replaced wholesale rather than concatenated.
 */
export function mergeDefaults(config: AemConfig): ResolvedAemConfig {
  const userDefaults = config.defaults ?? {};
  const clientlibs = config.clientlibs.map((clientlib) =>
    resolveClientlib(clientlib, userDefaults),
  );
  return {
    clientLibRoot: config.clientLibRoot,
    clientlibs,
    ...(config.build !== undefined ? { build: config.build } : {}),
  };
}

function resolveClientlib(
  clientlib: AemClientlib,
  userDefaults: Partial<AemClientlib>,
): ResolvedAemClientlib {
  const merged: AemClientlib = {
    ...defaults,
    ...userDefaults,
    ...clientlib,
  };
  return {
    ...merged,
    allowProxy: merged.allowProxy ?? defaults.allowProxy,
    serializationFormat:
      merged.serializationFormat ?? defaults.serializationFormat,
    cssProcessor: merged.cssProcessor ?? defaults.cssProcessor,
    jsProcessor: merged.jsProcessor ?? defaults.jsProcessor,
  };
}
