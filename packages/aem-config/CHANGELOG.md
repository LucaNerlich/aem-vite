# Changelog

All notable changes to **@aemvite/aem-config** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-07-02

### Changed
- Build migrated from `tsc` to `vp pack` ([Vite+](https://viteplus.dev)'s tsdown/Rolldown-based library bundler); `main`/`types`/`exports`/`bin` now point at `dist/index.mjs`/`dist/index.d.mts`/`dist/cli.mjs` instead of the `.js`/`.d.ts` equivalents. `bin.aem-build` still resolves correctly and the CLI shebang/executable bit survive bundling.
- Tests migrated from a standalone `vitest` devDependency to vite-plus's bundled Vitest (`vite-plus/test`).
- Cross-dependency ranges on the five plugin packages bumped to `^0.7.0`.
- `engines.node` tightened to `^20.19.0 || ^22.18.0 || >=24.11.0` (required by `vite-plus`).
- **Unchanged by design:** `buildClientlibs.ts` and `loadAemConfig.ts` still import the real `vite` package directly (`build`, `mergeConfig`, `loadConfigFromFile`) — `vite-plus` doesn't re-export Vite's programmatic Node API, so this package's core build engine is untouched by the migration. Byte-identical clientlib descriptor output verified unchanged end-to-end.

### Added
- `lint` script (`vp lint`, Oxlint) — this package had no linting before.

## [0.6.0] - 2026-06-26

### Added
- `handlebars: true | { include?, ignore?, runtime? }` field on `defineAemConfig`, supported globally and per-clientlib. When enabled, `@aemvite/vite-plugin-aem-handlebars` is auto-wired into the clientlib's Vite build.
- Lazy-loading wiring in `buildClientlibs`: the handlebars plugin (and the `handlebars` peer) are only imported when at least one clientlib opts in, keeping `handlebars` an optional peer dependency.

### Changed
- New transitive dependency on `@aemvite/vite-plugin-aem-handlebars`.
- All plugin dependency ranges bumped to `^0.6.0`.

## [0.5.1] - 2026-06-26

### Fixed
- Vite/Rollup output format changed from `es` to `iife` to prevent top-level variable declarations from leaking into AEM's concatenated clientlib output (`SyntaxError: Identifier has already been declared`). A `toIifeName()` helper sanitises the clientlib name to a valid JS identifier for the IIFE's global var binding.

## [0.5.0] - 2026-06-26

### Added
- `@aemvite/vite-plugin-aem-css-url-passthrough` wired in as a new transitive dependency; consumers get it automatically via `@aemvite/aem-config`.
- Plugin dependency ranges bumped to `^0.5.0`.

## [0.4.0] - 2026-06-26

### Added
- Sourcemap support in the build orchestrator: external sourcemaps emitted by Vite are staged under `resources/sourcemaps/` and `sourceMappingURL` comments in JS/CSS are rewritten to point at the AEM-served resources path.
- `sourcemapPathTransform` in Rollup output options rewrites `sources[]` entries to `aemvite://<clientlib>/` virtual URLs for clean DevTools grouping.
- Symlink resolution via `realpathOrSelf` so path transforms work correctly on macOS where `/var` resolves to `/private/var`.

### Changed
- Plugin dependency ranges bumped to `^0.4.0`.
- ES build target updated to `es2026`.

## [0.3.1] - 2026-06-26

### Added

- `aemviteexample/` minimal reference consumer added to the repo.

### Fixed

- `MIGRATION.md` updated with a concrete pom.xml diff for the Node version upgrade.

## [0.3.0] - 2026-06-26

### Changed

- **Breaking:** minimum Node.js tightened to `^22`; Vite peer narrowed to `^8`.
- Plugin package dependency ranges updated to `^0.2.0`.
- `esbuild` peer tightened to `^0.28`.

## [0.2.2] - 2026-06-26

### Changed

- Declare `esbuild` (range `^0.27.0 || ^0.28.0`, matching Vite 8's optional
  peer range) as a **required** peer dependency. `esbuild` was already needed
  at runtime — Vite uses it for TS/JS transpilation and is the default
  `build.minify` engine — but Vite 8 demoted it to an *optional* peer, so npm
  did not auto-install it. Re-declaring it as a required peer here means
  `npm install @aemvite/aem-config` (npm 7+ / pnpm 8+ with `auto-install-peers`)
  pulls `esbuild` in automatically, eliminating the
  `Cannot find package 'esbuild'` failure during `aem-build --mode prod`.

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
