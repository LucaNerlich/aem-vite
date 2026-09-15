import { basename } from 'node:path';
import { defaults } from './defaults.js';
import type { AemClientlib, AemConfig, ResolvedAemClientlib, ResolvedAemConfig } from './types.js';

/**
 * Merge the package-level `defaults` followed by the user-supplied
 * `config.defaults` block into every clientlib entry.
 *
 * Precedence (highest wins): per-clientlib values → `config.defaults` →
 * built-in `defaults`.
 *
 * Array fields (`cssProcessor`, `jsProcessor`, `dependencies`, `embed`,
 * `categories`, `resources`) are replaced wholesale rather than concatenated.
 *
 * `build` is excluded from `config.defaults` (see `assertNoDefaultsBuild`) —
 * use the top-level `config.build` field for global build defaults instead.
 *
 * Clientlib entries are validated here — every config passes through this
 * function (both `loadAemConfig` and direct API consumers) — so invalid
 * names fail fast before any build or filesystem work.
 */
export function mergeDefaults(config: AemConfig): ResolvedAemConfig {
  assertValidClientlibs(config.clientlibs);
  assertNoDefaultsBuild(config.defaults);
  const userDefaults = config.defaults ?? {};
  const clientlibs = config.clientlibs.map((clientlib) =>
    resolveClientlib(clientlib, userDefaults),
  );
  return {
    clientLibRoot: config.clientLibRoot,
    clientlibs,
    ...(config.build !== undefined ? { build: config.build } : {}),
    ...(config.cssUrlPassthrough !== undefined
      ? { cssUrlPassthrough: config.cssUrlPassthrough }
      : {}),
    ...(config.handlebars !== undefined ? { handlebars: config.handlebars } : {}),
    ...(config.plugins !== undefined ? { plugins: config.plugins } : {}),
    ...(config.vite !== undefined ? { vite: config.vite } : {}),
  };
}

/**
 * Whether `name` is safe to use as a `clientlib-<name>` folder name:
 * non-empty, no path separators, and no `.`/`..` segments. Mirrors
 * `isValidClientlibName` in `@aemvite/vite-plugin-aem-clientlib` (kept local
 * so the packages stay decoupled).
 */
function isValidClientlibName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\\') &&
    basename(name) === name
  );
}

/**
 * `defaults.build` would be merged into each clientlib's `build` via a
 * shallow spread in `resolveClientlib`, which replaces the whole `build`
 * object rather than layering it field-by-field — so it would silently
 * disappear the moment a clientlib sets any `build` field of its own.
 * Rejected outright: use the top-level `AemConfig.build` field instead,
 * which `resolveBuildOptions` layers correctly under per-clientlib `build`.
 */
function assertNoDefaultsBuild(userDefaults: AemConfig['defaults']): void {
  if (userDefaults && 'build' in userDefaults) {
    throw new Error(
      "'defaults.build' is not supported: use the top-level 'build' field " +
        'on the config instead, which is layered correctly under ' +
        "per-clientlib 'build' overrides.",
    );
  }
}

function assertValidClientlibs(clientlibs: AemClientlib[]): void {
  const seen = new Set<string>();
  for (const clientlib of clientlibs) {
    if (typeof clientlib !== 'object' || clientlib === null) {
      throw new Error(`Invalid clientlib entry: expected an object, got ${typeof clientlib}`);
    }
    if (!isValidClientlibName(clientlib.name)) {
      throw new Error(
        `Invalid clientlib name ${JSON.stringify(clientlib.name)}: ` +
          `must be a bare folder name without path separators or '..' segments`,
      );
    }
    const key = clientlib.name.toLowerCase();
    if (seen.has(key)) {
      throw new Error(
        `Duplicate clientlib name ${JSON.stringify(clientlib.name)}: ` +
          `each clientlib must have a unique name`,
      );
    }
    seen.add(key);
  }
}

function resolveClientlib(
  clientlib: AemClientlib,
  userDefaults: NonNullable<AemConfig['defaults']>,
): ResolvedAemClientlib {
  const merged: AemClientlib = {
    ...defaults,
    ...userDefaults,
    ...clientlib,
  };
  return {
    ...merged,
    allowProxy: merged.allowProxy ?? defaults.allowProxy,
    serializationFormat: merged.serializationFormat ?? defaults.serializationFormat,
    // Copy the winning array so every resolved clientlib owns its list —
    // mutations can never corrupt the global defaults, the config's own
    // arrays, or sibling clientlibs.
    cssProcessor: [
      ...(clientlib.cssProcessor ?? userDefaults.cssProcessor ?? defaults.cssProcessor),
    ],
    jsProcessor: [...(clientlib.jsProcessor ?? userDefaults.jsProcessor ?? defaults.jsProcessor)],
  };
}
