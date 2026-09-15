# Changelog

All notable changes to **@aemvite/vite-plugin-aem-resources** will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-09-15

### Removed
- **Breaking:** dropped the redundant `export default aemResources` alongside the named export. Only the named export (`import { aemResources } from '@aemvite/vite-plugin-aem-resources'`) was ever documented or used internally.

## [0.8.0] - 2026-09-15

### Changed
- Build migrated from `vp pack` ([Vite+](https://viteplus.dev)) to standalone [`tsdown`](https://tsdown.dev); tests migrated from vite-plus's bundled Vitest to a standalone `vitest` devDependency; lint migrated from `vp lint` to standalone `oxlint` (type-aware via `oxlint-tsgolint`), invoked as `oxlint -c ../../.oxlintrc.json .`. `vite-plus` dropped from `devDependencies` entirely. No change to build output.

### Added
- Symlinks under a `resources/` source tree are now followed (with a cycle guard) when counting real files, so symlinked files and directories count as real content.
- A warning is now emitted when a configured `resources/` source is empty.

## [0.7.0] - 2026-07-02

### Changed
- Build migrated from `tsc` to `vp pack` ([Vite+](https://viteplus.dev)'s tsdown/Rolldown-based library bundler); `main`/`types`/`exports` now point at `dist/index.mjs`/`dist/index.d.mts` instead of the `.js`/`.d.ts` equivalents. The `vite` peer dependency's `Plugin`/`ResolvedConfig` type imports stay external, unbundled.
- Tests migrated from a standalone `vitest` devDependency to vite-plus's bundled Vitest (`vite-plus/test`).
- `engines.node` tightened to `^20.19.0 || ^22.18.0 || >=24.11.0` (required by `vite-plus`).

### Added
- `lint` script (`vp lint`, Oxlint) — this package had no linting before.

## [0.6.0] - 2026-06-26

### Changed
- Version synchronised with the rest of the `@aemvite/*` monorepo. No functional changes in this package.

## [0.5.1] - 2026-06-26

### Changed
- Version synchronised with the rest of the `@aemvite/*` monorepo. No functional changes in this package.

## [0.5.0] - 2026-06-26

### Changed
- Version synchronised with the rest of the `@aemvite/*` monorepo. No functional changes in this package.

## [0.4.0] - 2026-06-26

### Changed
- Version synchronised with the rest of the `@aemvite/*` monorepo. No functional changes in this package.

## [0.1.0] - 2026-06-25

### Added

- Initial public release.
- `aemResources()` Vite plugin (`apply: "build"`, runs at `closeBundle`) that
  byte-copies one or more `resources/` trees into the build `outDir`.
- Supports single `ResourceCopy`, an array, or `{ entries }` shapes; `to`
  defaults to `"resources"` to match the AEM clientlib convention.
- Skips `.gitkeep` placeholders and no-ops on empty / placeholder-only / missing
  source directories so empty trees never materialize on disk.
- Zero runtime dependencies (uses only `node:fs` and `node:path`).
