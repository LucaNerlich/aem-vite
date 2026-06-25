import path from "node:path";
import { pathToFileURL } from "node:url";
import { mergeDefaults } from "./mergeDefaults.js";
import type { AemConfig, ResolvedAemConfig } from "./types.js";

/**
 * Load an `aem.config.ts` (or `.js`/`.mjs`) file from disk and merge defaults.
 *
 * `.ts` files are transpiled via Vite's bundled esbuild
 * (`loadConfigFromFile`) — no extra runtime loader (no jiti) is needed.
 * `.js`/`.mjs` files are imported directly to keep the no-dep path fast.
 */
export async function loadAemConfig(
  configPath: string,
): Promise<ResolvedAemConfig> {
  const absolute = path.resolve(configPath);
  const ext = path.extname(absolute).toLowerCase();

  const raw =
    ext === ".ts" || ext === ".mts" || ext === ".cts"
      ? await loadViaVite(absolute)
      : await loadViaImport(absolute);

  return mergeDefaults(raw);
}

async function loadViaVite(absolute: string): Promise<AemConfig> {
  // Import Vite lazily so consumers that pre-resolve their config (or stub
  // this loader in tests) don't pay the cost of loading Vite up front.
  const { loadConfigFromFile } = await import("vite");
  const result = await loadConfigFromFile(
    { command: "build", mode: "production" },
    absolute,
  );
  if (!result) {
    throw new Error(`Failed to load AEM config at ${absolute}`);
  }
  return unwrapDefault(result.config);
}

async function loadViaImport(absolute: string): Promise<AemConfig> {
  const mod = (await import(pathToFileURL(absolute).href)) as {
    default?: unknown;
  } & Record<string, unknown>;
  const value = mod.default ?? mod;
  return unwrapDefault(value);
}

function unwrapDefault(value: unknown): AemConfig {
  const candidate =
    typeof value === "object" && value !== null && "default" in value
      ? (value as { default: unknown }).default
      : value;
  if (!isAemConfig(candidate)) {
    throw new Error(
      "AEM config must export an object with `clientLibRoot` and `clientlibs`",
    );
  }
  return candidate;
}

function isAemConfig(value: unknown): value is AemConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AemConfig).clientLibRoot === "string" &&
    Array.isArray((value as AemConfig).clientlibs)
  );
}
