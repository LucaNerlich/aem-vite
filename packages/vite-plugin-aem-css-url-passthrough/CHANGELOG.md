# Changelog

All notable changes to **@aemvite/vite-plugin-aem-css-url-passthrough** will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Version synchronised with the rest of the `@aemvite/*` monorepo at initial public release.

## [0.4.0] - 2026-06-26

### Added

- Initial public release.
- `aemCssUrlPassthrough()` Vite plugin (`apply: "build"`, runs at
  `writeBundle`) that rewrites `url(...)` references in every emitted `.css`
  file under the build output directory back to the canonical
  `../resources/<sub>/<file>` form used by AEM clientlibs. Mirrors the legacy
  webpack `css-loader: { url: false }` behavior.
- Configurable `resourceDirs` option (defaults to `["images", "fonts"]`) so
  consumers can declare every `resources/<sub>/` bucket their stylesheets
  reference (e.g. `["images", "fonts", "icons", "storybook-assets"]`).
- Data URIs, absolute `http(s)://` URLs, and protocol-relative URLs are left
  untouched. `url()`s that do not pass through a configured `resources/<sub>/`
  bucket are also left untouched.
- Zero runtime dependencies (uses only `node:fs` and `node:path`).
