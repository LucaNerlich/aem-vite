# Changelog

All notable changes to **@aemvite/aem-config** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-25

### Added

- Initial public release.
- `defineAemConfig()` typed identity helper and `loadAemConfig()` loader for
  `.ts` / `.mts` / `.js` / `.mjs` config files (`.ts` loaded via Vite's bundled
  esbuild — no extra runtime loader).
- `buildClientlibs()` orchestrator that runs one Vite library build per
  clientlib entry into a shared `outDir` and invokes the clientlib emitter.
- `BuildOptions` API with three-layer resolution (mode baseline → global
  `AemConfig.build` → per-clientlib `AemClientlib.build`) controlling
  `minify`, `sourcemap`, and `target`, plus `resolveBuildOptions()` for
  tooling/tests.
- `aem-build` CLI (`--mode`, `--config`, `--out-dir`) for invoking the
  orchestrator from `npm` scripts.
