import type { AemConfig } from "./types.js";

/**
 * Identity helper for typed `aem.config.ts` files.
 *
 * @example
 * ```ts
 * import { defineAemConfig } from "@aemvite/aem-config";
 *
 * export default defineAemConfig({
 *   clientLibRoot: "../ui.apps/.../clientlibs",
 *   clientlibs: [
 *     { name: "clientlib-site", entry: "src/main.ts", categories: ["aemvite.site"] },
 *   ],
 * });
 * ```
 */
export function defineAemConfig(config: AemConfig): AemConfig {
  return config;
}
