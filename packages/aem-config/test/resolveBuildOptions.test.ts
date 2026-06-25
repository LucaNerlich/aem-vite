import { describe, it, expect } from "vitest";
import {
  defaultTarget,
  modeBaselines,
  resolveBuildOptions,
} from "../src/index.js";

describe("resolveBuildOptions — mode baselines", () => {
  it("returns the development baseline when no overrides are supplied", () => {
    const r = resolveBuildOptions("development");
    expect(r).toEqual({
      minify: { js: false, css: false },
      sourcemap: "inline",
      target: defaultTarget,
    });
  });

  it("returns the production baseline when no overrides are supplied", () => {
    const r = resolveBuildOptions("production");
    expect(r).toEqual({
      minify: { js: true, css: true },
      sourcemap: false,
      target: defaultTarget,
    });
  });

  it("exposes the baselines as a public constant", () => {
    expect(modeBaselines.development).toEqual({
      minify: false,
      sourcemap: "inline",
    });
    expect(modeBaselines.production).toEqual({
      minify: { js: true, css: true },
      sourcemap: false,
    });
  });
});

describe("resolveBuildOptions — precedence (mode < global < per-clientlib)", () => {
  it("lets global build override the mode baseline", () => {
    const r = resolveBuildOptions("development", {
      minify: true,
      sourcemap: false,
      target: "es2020",
    });
    expect(r).toEqual({
      minify: { js: true, css: true },
      sourcemap: false,
      target: "es2020",
    });
  });

  it("lets per-clientlib build override global and baseline", () => {
    const r = resolveBuildOptions(
      "production",
      { minify: true, sourcemap: false, target: "es2020" },
      { minify: false, sourcemap: "inline", target: "es2017" },
    );
    expect(r).toEqual({
      minify: { js: false, css: false },
      sourcemap: "inline",
      target: "es2017",
    });
  });

  it("falls through to lower layers when higher layers omit a field", () => {
    const r = resolveBuildOptions(
      "production",
      { target: ["es2018", "chrome70"] },
      { sourcemap: "hidden" },
    );
    expect(r).toEqual({
      minify: { js: true, css: true },
      sourcemap: "hidden",
      target: ["es2018", "chrome70"],
    });
  });
});

describe("resolveBuildOptions — minify shapes", () => {
  it("treats boolean true as both js+css on", () => {
    const r = resolveBuildOptions("development", { minify: true });
    expect(r.minify).toEqual({ js: true, css: true });
  });

  it("treats boolean false as both js+css off", () => {
    const r = resolveBuildOptions("production", { minify: false });
    expect(r.minify).toEqual({ js: false, css: false });
  });

  it("object form overrides per-asset and lets unspecified keys fall through", () => {
    const r = resolveBuildOptions("production", undefined, {
      minify: { js: false },
    });
    expect(r.minify).toEqual({ js: false, css: true });
  });

  it("layers object minify across global and per-clientlib", () => {
    const r = resolveBuildOptions(
      "development",
      { minify: { css: true } },
      { minify: { js: true } },
    );
    expect(r.minify).toEqual({ js: true, css: true });
  });
});

describe("resolveBuildOptions — sourcemap variants", () => {
  it.each([true, false, "inline", "hidden"] as const)(
    "accepts sourcemap=%s",
    (value) => {
      const r = resolveBuildOptions("production", { sourcemap: value });
      expect(r.sourcemap).toBe(value);
    },
  );
});

describe("resolveBuildOptions — target", () => {
  it("accepts a single target string", () => {
    const r = resolveBuildOptions("production", { target: "es2019" });
    expect(r.target).toBe("es2019");
  });

  it("accepts an array of targets", () => {
    const r = resolveBuildOptions("production", {
      target: ["es2019", "safari13"],
    });
    expect(r.target).toEqual(["es2019", "safari13"]);
  });
});
