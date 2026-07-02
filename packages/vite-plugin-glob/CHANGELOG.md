# Changelog

All notable changes to **@aemvite/vite-plugin-glob** will be documented in
this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-07-02

### Changed
- Build migrated from `tsc` to `vp pack` ([Vite+](https://viteplus.dev)'s tsdown/Rolldown-based library bundler); `main`/`types`/`exports` now point at `dist/index.mjs`/`dist/index.d.mts` and `dist/expand.mjs`/`dist/expand.d.mts` instead of the `.js`/`.d.ts` equivalents. `expand.ts` still bundles as an independently importable module (the `./expand` sub-path export), not inlined into `index.mjs`. `tinyglobby` stays external, unbundled.
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
- `aemViteGlob()` Vite plugin (`enforce: "pre"`) that rewrites glob
  `@import` / `@use` / `@forward` statements in `.scss`, `.sass`, and `.css`
  files before Vite's CSS pipeline runs Sass / esbuild.
- Pure helper functions `expandStyleGlobs`, `expandStyleGlobsWithResult`, and
  `hasGlobMagic`, exported from both the main entry and the
  `@aemvite/vite-plugin-glob/expand` sub-path for use outside Vite.
- Deterministic lexicographic ordering of matched files, configurable via the
  `sort` option.
- Backed by [`tinyglobby`](https://github.com/SuperchupuDev/tinyglobby) for
  fast, dependency-light glob matching.
