import { describe, it, expect } from "vite-plus/test";
import {
  defaults,
  defineAemConfig,
  mergeDefaults,
} from "../src/index.js";

describe("mergeDefaults", () => {
  it("applies built-in defaults to a minimal clientlib", () => {
    const merged = mergeDefaults(
      defineAemConfig({
        clientLibRoot: "./clientlibs",
        clientlibs: [
          {
            name: "clientlib-site",
            entry: "src/main.ts",
            categories: ["aemvite.site"],
          },
        ],
      }),
    );

    expect(merged.clientLibRoot).toBe("./clientlibs");
    expect(merged.clientlibs).toHaveLength(1);
    const site = merged.clientlibs[0]!;
    expect(site.name).toBe("clientlib-site");
    expect(site.allowProxy).toBe(defaults.allowProxy);
    expect(site.serializationFormat).toBe(defaults.serializationFormat);
    expect(site.cssProcessor).toEqual(defaults.cssProcessor);
    expect(site.jsProcessor).toEqual(defaults.jsProcessor);
  });

  it("lets per-clientlib values override built-in defaults", () => {
    const merged = mergeDefaults({
      clientLibRoot: "./clientlibs",
      clientlibs: [
        {
          name: "clientlib-noproxy",
          entry: "src/x.ts",
          categories: ["x"],
          allowProxy: false,
          cssProcessor: ["min:yui"],
        },
      ],
    });

    const lib = merged.clientlibs[0]!;
    expect(lib.allowProxy).toBe(false);
    expect(lib.cssProcessor).toEqual(["min:yui"]);
    expect(lib.jsProcessor).toEqual(defaults.jsProcessor);
  });

  it("lets config.defaults override built-in defaults but not per-clientlib values", () => {
    const merged = mergeDefaults({
      clientLibRoot: "./clientlibs",
      defaults: {
        allowProxy: false,
        cssProcessor: ["min:yui"],
        jsProcessor: ["min:gcc"],
      },
      clientlibs: [
        { name: "a", entry: "a.ts", categories: ["a"] },
        {
          name: "b",
          entry: "b.ts",
          categories: ["b"],
          allowProxy: true,
        },
      ],
    });

    expect(merged.clientlibs[0]!.allowProxy).toBe(false);
    expect(merged.clientlibs[0]!.cssProcessor).toEqual(["min:yui"]);
    expect(merged.clientlibs[0]!.jsProcessor).toEqual(["min:gcc"]);
    expect(merged.clientlibs[1]!.allowProxy).toBe(true);
    expect(merged.clientlibs[1]!.cssProcessor).toEqual(["min:yui"]);
  });

  it("preserves user dependencies, embed, and resources arrays", () => {
    const merged = mergeDefaults({
      clientLibRoot: "./clientlibs",
      clientlibs: [
        {
          name: "clientlib-site",
          entry: "src/main.ts",
          categories: ["aemvite.site"],
          dependencies: ["aemvite.dependencies"],
          embed: ["aemvite.shared"],
          resources: ["src/resources"],
        },
      ],
    });

    const lib = merged.clientlibs[0]!;
    expect(lib.dependencies).toEqual(["aemvite.dependencies"]);
    expect(lib.embed).toEqual(["aemvite.shared"]);
    expect(lib.resources).toEqual(["src/resources"]);
  });

  it("carries global plugins/vite and per-clientlib plugins through", () => {
    const globalPlugin = { name: "global" };
    const sitePlugin = { name: "site" };
    const merged = mergeDefaults({
      clientLibRoot: "./clientlibs",
      plugins: [globalPlugin],
      vite: { logLevel: "silent" },
      clientlibs: [
        {
          name: "site",
          entry: "src/main.ts",
          categories: ["aemvite.site"],
          plugins: [sitePlugin],
        },
      ],
    });

    expect(merged.plugins).toEqual([globalPlugin]);
    expect(merged.vite).toEqual({ logLevel: "silent" });
    expect(merged.clientlibs[0]!.plugins).toEqual([sitePlugin]);
  });

  it("does not mutate the input config", () => {
    const config = defineAemConfig({
      clientLibRoot: "./clientlibs",
      clientlibs: [
        {
          name: "clientlib-site",
          entry: "src/main.ts",
          categories: ["aemvite.site"],
        },
      ],
    });
    const snapshot = JSON.stringify(config);
    mergeDefaults(config);
    expect(JSON.stringify(config)).toBe(snapshot);
  });
});
