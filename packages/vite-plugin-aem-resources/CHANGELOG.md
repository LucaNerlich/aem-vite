# Changelog

All notable changes to **@aemvite/vite-plugin-aem-resources** will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
