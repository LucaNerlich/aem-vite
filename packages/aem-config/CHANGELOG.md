# Changelog

All notable changes to **@aemvite/aem-config** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
