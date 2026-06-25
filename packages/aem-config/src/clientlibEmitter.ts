import type { ResolvedAemConfig } from "./types.js";

/**
 * Structural contract the build orchestrator expects from any clientlib
 * emitter (implemented by `@aemvite/vite-plugin-aem-clientlib`). Kept here so
 * `@aemvite/aem-config` doesn't hard-depend on its sibling package during
 * parallel wave-2 development.
 */
export interface ClientlibEmitterInput {
  config: ResolvedAemConfig;
  outDir: string;
}

export interface ClientlibEmitter {
  emit(input: ClientlibEmitterInput): Promise<void> | void;
}

/**
 * Try to resolve the emitter from `@aemvite/vite-plugin-aem-clientlib`.
 * Returns `null` when the sibling package isn't installed yet so the
 * orchestrator can run (e.g. inside this package's own unit tests).
 */
export async function resolveClientlibEmitter(): Promise<ClientlibEmitter | null> {
  try {
    const mod = (await import(
      "@aemvite/vite-plugin-aem-clientlib"
    )) as Record<string, unknown>;
    const fn = mod.emitClientlibs;
    if (typeof fn === "function") {
      return {
        emit: (input) =>
          (fn as (i: ClientlibEmitterInput) => Promise<void> | void)(input),
      };
    }
    const factory = mod.createClientlibEmitter;
    if (typeof factory === "function") {
      const instance = (
        factory as () => ClientlibEmitter | Promise<ClientlibEmitter>
      )();
      return await instance;
    }
    return null;
  } catch {
    return null;
  }
}
