import { describe, it, expect } from "vite-plus/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadAemConfig } from "../src/loadAemConfig.js";

describe("loadAemConfig", () => {
  it("loads a .ts config via Vite's bundled esbuild and merges defaults", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "aem-config-"));
    const file = path.join(dir, "aem.config.ts");
    // Plain .ts (no import of the package itself) keeps the test free of
    // build-order coupling — esbuild still transpiles the TypeScript syntax.
    writeFileSync(
      file,
      `interface Lib { name: string; entry: string; categories: readonly string[] }
const clientlibs: Lib[] = [
  { name: "clientlib-site", entry: "src/main.ts", categories: ["aemvite.site"] satisfies readonly string[] },
];
export default { clientLibRoot: "./clientlibs", clientlibs } as const;
`,
    );

    const config = await loadAemConfig(file);
    expect(config.clientLibRoot).toBe("./clientlibs");
    expect(config.clientlibs).toHaveLength(1);
    expect(config.clientlibs[0]!.allowProxy).toBe(true);
    expect(config.clientlibs[0]!.cssProcessor).toEqual([
      "default:none",
      "min:none",
    ]);
  });

  it("loads a plain .js config without invoking Vite", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "aem-config-js-"));
    const file = path.join(dir, "aem.config.mjs");
    writeFileSync(
      file,
      `export default {
  clientLibRoot: "./out",
  clientlibs: [{ name: "x", entry: "x.js", categories: ["x"] }],
};
`,
    );
    const config = await loadAemConfig(file);
    expect(config.clientLibRoot).toBe("./out");
    expect(config.clientlibs[0]!.serializationFormat).toBe("xml");
  });

  it("rejects configs missing required fields", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "aem-config-bad-"));
    const file = path.join(dir, "aem.config.mjs");
    writeFileSync(file, `export default { wrong: true };\n`);
    await expect(loadAemConfig(file)).rejects.toThrow(/clientLibRoot/);
  });
});


