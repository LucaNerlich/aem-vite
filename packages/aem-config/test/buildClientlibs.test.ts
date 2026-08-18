import { describe, it, expect, beforeAll, afterAll } from "vite-plus/test";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildClientlibs } from "../src/index.js";

/**
 * End-to-end test of the orchestrator: it must run a real Vite library build,
 * wire the resources plugin and author-supplied plugins, name outputs after the
 * clientlib (not the entry), handle descriptor-only clientlibs, and emit into
 * `clientLibRoot` — byte-compatible with the hand-rolled reference orchestrator.
 */
describe("buildClientlibs (integration)", () => {
  let dir: string;
  let outRoot: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aemvite-build-"));
    outRoot = path.join(dir, "clientlibs");
    const markerPath = path.join(dir, "plugin-ran.marker");

    await mkdir(path.join(dir, "src"), { recursive: true });
    await mkdir(path.join(dir, "resources", "img"), { recursive: true });
    await writeFile(
      path.join(dir, "src", "main.ts"),
      "import './style.css';\nexport const value: number = 1;\n",
    );
    await writeFile(path.join(dir, "src", "style.css"), ".a { color: red; }\n");
    await writeFile(path.join(dir, "resources", "img", "logo.txt"), "logo\n");

    // Plain-object config (no imports) so it loads from a node_modules-less tmp
    // dir. A marker plugin proves the global `plugins` passthrough is applied.
    const configSrc = `
import { writeFileSync } from 'node:fs';
export default {
  clientLibRoot: ${JSON.stringify(outRoot)},
  plugins: [{ name: 'marker', closeBundle() { writeFileSync(${JSON.stringify(markerPath)}, 'ok'); } }],
  clientlibs: [
    { name: 'dependencies', entry: '', categories: ['proj.dependencies'] },
    {
      name: 'site',
      entry: 'src/main.ts',
      categories: ['proj.site'],
      dependencies: ['proj.dependencies'],
      resources: ['resources'],
      build: { minify: false },
    },
  ],
};
`;
    await writeFile(path.join(dir, "aem.config.mjs"), configSrc);

    await buildClientlibs({
      mode: "production",
      configPath: path.join(dir, "aem.config.mjs"),
    });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("names JS/CSS after the clientlib, not the entry", async () => {
    const jsTxt = await readFile(path.join(outRoot, "clientlib-site", "js.txt"), "utf8");
    const cssTxt = await readFile(path.join(outRoot, "clientlib-site", "css.txt"), "utf8");
    expect(jsTxt).toBe("#base=js\n\nsite.js");
    expect(cssTxt).toBe("#base=css\n\nsite.css");
    expect(existsSync(path.join(outRoot, "clientlib-site", "js", "site.js"))).toBe(true);
    expect(existsSync(path.join(outRoot, "clientlib-site", "css", "site.css"))).toBe(true);
  });

  it("emits .content.xml with dependencies for the site clientlib", async () => {
    const xml = await readFile(
      path.join(outRoot, "clientlib-site", ".content.xml"),
      "utf8",
    );
    expect(xml).toContain('categories="[proj.site]"');
    expect(xml).toContain('dependencies="[proj.dependencies]"');
  });

  it("copies the resources/ tree preserving structure", async () => {
    const logo = await readFile(
      path.join(outRoot, "clientlib-site", "resources", "img", "logo.txt"),
      "utf8",
    );
    expect(logo).toBe("logo\n");
  });

  it("emits a descriptor-only clientlib with no js/css/resources folders", async () => {
    const depDir = path.join(outRoot, "clientlib-dependencies");
    const jsTxt = await readFile(path.join(depDir, "js.txt"), "utf8");
    const cssTxt = await readFile(path.join(depDir, "css.txt"), "utf8");
    expect(jsTxt).toBe("#base=js\n\n");
    expect(cssTxt).toBe("#base=css\n\n");
    const entries = (await readdir(depDir)).sort();
    expect(entries).toEqual([".content.xml", "css.txt", "js.txt"]);
  });

  it("applies author-supplied plugins (global passthrough)", () => {
    expect(existsSync(path.join(dir, "plugin-ran.marker"))).toBe(true);
  });
});

/**
 * When a clientlib opts into sourcemaps via `build.sourcemap: true`, Vite
 * emits `*.js.map` (and possibly `*.css.map`) into the staging dir. Those
 * must land next to the owning JS/CSS in the final clientlib so the
 * browser-relative `sourceMappingURL` resolves, while staying out of
 * `js.txt` / `css.txt` so AEM does not try to load them as scripts.
 */
describe("buildClientlibs (sourcemap)", () => {
  let dir: string;
  let outRoot: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aemvite-build-sm-"));
    outRoot = path.join(dir, "clientlibs");

    await mkdir(path.join(dir, "src"), { recursive: true });
    await writeFile(
      path.join(dir, "src", "main.ts"),
      "export const value: number = 1;\n",
    );

    const configSrc = `
export default {
  clientLibRoot: ${JSON.stringify(outRoot)},
  clientlibs: [
    {
      name: 'site',
      entry: 'src/main.ts',
      categories: ['proj.site'],
      build: { minify: false, sourcemap: true },
    },
  ],
};
`;
    await writeFile(path.join(dir, "aem.config.mjs"), configSrc);

    await buildClientlibs({
      mode: "production",
      configPath: path.join(dir, "aem.config.mjs"),
    });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("emits site.js.map under resources/sourcemaps/ (not next to site.js)", () => {
    expect(existsSync(path.join(outRoot, "clientlib-site", "js", "site.js"))).toBe(true);
    expect(
      existsSync(
        path.join(outRoot, "clientlib-site", "resources", "sourcemaps", "site.js.map"),
      ),
    ).toBe(true);
    // Must NOT live in the js/ bucket — AEM's aggregator would try to load it
    // as a script and Sling URL decomposition would 404 the proxy path.
    expect(
      existsSync(path.join(outRoot, "clientlib-site", "js", "site.js.map")),
    ).toBe(false);
  });

  it("does not list .map files in js.txt", async () => {
    const jsTxt = await readFile(
      path.join(outRoot, "clientlib-site", "js.txt"),
      "utf8",
    );
    expect(jsTxt).toBe("#base=js\n\nsite.js");
    expect(jsTxt).not.toContain(".map");
  });

  it("rewrites sourceMappingURL to the resources/sourcemaps path AEM serves", async () => {
    const js = await readFile(
      path.join(outRoot, "clientlib-site", "js", "site.js"),
      "utf8",
    );
    expect(js).toContain(
      "sourceMappingURL=clientlib-site/resources/sourcemaps/site.js.map",
    );
    // Sanity: the original bare-basename URL must have been replaced.
    expect(js).not.toMatch(/sourceMappingURL=site\.js\.map\b/);
  });

  it("rewrites sourcemap sources[] to aemvite://<clientlib>/<project-relative> URLs", async () => {
    const map = JSON.parse(
      await readFile(
        path.join(outRoot, "clientlib-site", "resources", "sourcemaps", "site.js.map"),
        "utf8",
      ),
    );
    expect(Array.isArray(map.sources)).toBe(true);
    expect(map.sources.length).toBeGreaterThan(0);
    for (const src of map.sources as string[]) {
      // Clean virtual URL — no leading `../`, no disk-path resolution attempts
      // in DevTools, and groups sources under a stable `aemvite://site/` tree.
      expect(src.startsWith("aemvite://site/")).toBe(true);
      expect(src.includes("../")).toBe(false);
    }
    // The known source file from this fixture should land at its
    // project-relative path under the virtual root.
    expect(map.sources).toContain("aemvite://site/src/main.ts");
  });
});

describe("buildClientlibs (outDir safety)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aemvite-build-guard-"));
    await writeFile(
      path.join(dir, "aem.config.mjs"),
      `export default {
  clientLibRoot: "./clientlibs",
  clientlibs: [{ name: "site", entry: "", categories: ["proj.site"] }],
};
`,
    );
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses to wipe an outDir that contains the config file", async () => {
    const configPath = path.join(dir, "aem.config.mjs");
    await expect(
      buildClientlibs({ mode: "production", configPath, outDir: "." }),
    ).rejects.toThrow(/outDir/);
    expect(existsSync(configPath)).toBe(true);
  });
});

describe("buildClientlibs (stale folder cleanup)", () => {
  let dir: string;
  let outRoot: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aemvite-build-stale-"));
    outRoot = path.join(dir, "clientlibs");
    await mkdir(path.join(outRoot, "clientlib-stale"), { recursive: true });
    await mkdir(path.join(outRoot, "unrelated-dir"), { recursive: true });
    await writeFile(path.join(outRoot, "clientlib-stale", "old.css"), "old");
    await writeFile(path.join(outRoot, "unrelated-dir", "keep.txt"), "keep");
    await writeFile(
      path.join(dir, "aem.config.mjs"),
      `export default {
  clientLibRoot: ${JSON.stringify(outRoot)},
  clientlibs: [{ name: "site", entry: "", categories: ["proj.site"] }],
};
`,
    );

    await buildClientlibs({
      mode: "production",
      configPath: path.join(dir, "aem.config.mjs"),
    });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("removes clientlib-* folders that are no longer in the config", () => {
    expect(existsSync(path.join(outRoot, "clientlib-stale"))).toBe(false);
  });

  it("keeps non-clientlib folders and the current clientlib", () => {
    expect(existsSync(path.join(outRoot, "unrelated-dir", "keep.txt"))).toBe(true);
    expect(existsSync(path.join(outRoot, "clientlib-site", ".content.xml"))).toBe(true);
  });
});

/**
 * Files Vite (or an author plugin) emits at the staging-dir root that are
 * not part of the per-clientlib code bundles must not be silently dropped:
 * they belong under `resources/` in the emitted clientlib.
 */
describe("buildClientlibs (emitted assets)", () => {
  let dir: string;
  let outRoot: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aemvite-build-assets-"));
    outRoot = path.join(dir, "clientlibs");

    await mkdir(path.join(dir, "src"), { recursive: true });
    await writeFile(
      path.join(dir, "src", "main.ts"),
      "export const value: number = 1;\n",
    );
    await writeFile(
      path.join(dir, "aem.config.mjs"),
      `export default {
  clientLibRoot: ${JSON.stringify(outRoot)},
  plugins: [{
    name: "asset-emitter",
    apply: "build",
    generateBundle() { this.emitFile({ type: "asset", fileName: "extra.png", source: "PNG-BYTES" }); },
  }],
  clientlibs: [
    { name: "site", entry: "src/main.ts", categories: ["proj.site"], build: { minify: false } },
  ],
};
`,
    );

    await buildClientlibs({
      mode: "production",
      configPath: path.join(dir, "aem.config.mjs"),
    });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("routes root-emitted assets into the clientlib resources/ bucket", async () => {
    const out = path.join(outRoot, "clientlib-site", "resources", "extra.png");
    expect(existsSync(out)).toBe(true);
    expect(await readFile(out, "utf8")).toBe("PNG-BYTES");
  });
});
