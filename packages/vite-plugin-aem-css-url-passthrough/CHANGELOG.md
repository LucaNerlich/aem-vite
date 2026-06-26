# Changelog

All notable changes to **@aemvite/vite-plugin-aem-css-url-passthrough** will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
