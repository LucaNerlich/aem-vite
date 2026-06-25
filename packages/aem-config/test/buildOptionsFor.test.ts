import { describe, it, expect } from "vitest";
import path from "node:path";
import { buildOptionsFor } from "../src/buildClientlibs.js";
import { mergeDefaults } from "../src/mergeDefaults.js";
import { defaultTarget } from "../src/defaults.js";
import type { AemConfig } from "../src/types.js";

const configDir = "/repo/ui.frontend";
const outDir = "/repo/ui.frontend/dist";

function baseConfig(overrides: Partial<AemConfig> = {}): AemConfig {
  return {
    clientLibRoot: "../clientlibs",
    clientlibs: [
      {
        name: "clientlib-site",
        entry: "src/main.ts",
        categories: ["aemvite.site"],
      },
    ],
    ...overrides,
  };
}

describe("buildOptionsFor — default-equivalent regression", () => {
  it("development mode without build set matches the pre-API behavior", () => {
    const resolved = mergeDefaults(baseConfig());
    const opts = buildOptionsFor(
      resolved.clientlibs[0]!,
      configDir,
      outDir,
      "development",
      true,
      resolved.build,
    );

    expect(opts.build.minify).toBe(false);
    expect(opts.build.cssMinify).toBe(false);
    expect(opts.build.sourcemap).toBe("inline");
    expect(opts.build.target).toBe(defaultTarget);
    expect(opts.build.outDir).toBe(outDir);
    expect(opts.build.emptyOutDir).toBe(true);
    expect(opts.build.rollupOptions.output.inlineDynamicImports).toBe(true);
    expect(opts.build.lib.entry).toBe(
      path.resolve(configDir, "src/main.ts"),
    );
    expect((opts.build.lib.fileName as () => string)()).toBe(
      "clientlib-site/main.js",
    );
  });

  it("production mode without build set matches the pre-API behavior", () => {
    const resolved = mergeDefaults(baseConfig());
    const opts = buildOptionsFor(
      resolved.clientlibs[0]!,
      configDir,
      outDir,
      "production",
      false,
      resolved.build,
    );

    expect(opts.build.minify).toBe("esbuild");
    expect(opts.build.cssMinify).toBe("esbuild");
    expect(opts.build.sourcemap).toBe(false);
    expect(opts.build.target).toBe(defaultTarget);
    expect(opts.build.emptyOutDir).toBe(false);
  });
});

describe("buildOptionsFor — build-options API integration", () => {
  it("applies a global build override", () => {
    const resolved = mergeDefaults(
      baseConfig({ build: { sourcemap: "hidden", target: "es2020" } }),
    );
    const opts = buildOptionsFor(
      resolved.clientlibs[0]!,
      configDir,
      outDir,
      "production",
      true,
      resolved.build,
    );
    expect(opts.build.sourcemap).toBe("hidden");
    expect(opts.build.target).toBe("es2020");
    expect(opts.build.minify).toBe("esbuild");
  });

  it("lets per-clientlib build override the global block", () => {
    const resolved = mergeDefaults(
      baseConfig({
        build: { minify: true, target: "es2020" },
        clientlibs: [
          {
            name: "clientlib-site",
            entry: "src/main.ts",
            categories: ["aemvite.site"],
            build: { minify: { js: false }, target: "es2017" },
          },
        ],
      }),
    );
    const opts = buildOptionsFor(
      resolved.clientlibs[0]!,
      configDir,
      outDir,
      "production",
      true,
      resolved.build,
    );
    expect(opts.build.minify).toBe(false);
    expect(opts.build.cssMinify).toBe("esbuild");
    expect(opts.build.target).toBe("es2017");
  });

  it("respects minify object form on a single asset only", () => {
    const resolved = mergeDefaults(
      baseConfig({
        clientlibs: [
          {
            name: "clientlib-site",
            entry: "src/main.ts",
            categories: ["aemvite.site"],
            build: { minify: { css: false } },
          },
        ],
      }),
    );
    const opts = buildOptionsFor(
      resolved.clientlibs[0]!,
      configDir,
      outDir,
      "production",
      true,
      resolved.build,
    );
    expect(opts.build.minify).toBe("esbuild");
    expect(opts.build.cssMinify).toBe(false);
  });
});
