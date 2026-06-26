import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
