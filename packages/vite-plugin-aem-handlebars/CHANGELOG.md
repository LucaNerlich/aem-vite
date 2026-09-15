# Changelog

All notable changes to **@aemvite/vite-plugin-aem-handlebars** will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-09-15

### Removed
- **Breaking:** dropped the redundant `export default aemHandlebars` alongside the named export. Only the named export (`import { aemHandlebars } from '@aemvite/vite-plugin-aem-handlebars'`) was ever documented or used internally.

## [0.8.0] - 2026-09-15

### Changed
- Build migrated from `vp pack` ([Vite+](https://viteplus.dev)) to standalone [`tsdown`](https://tsdown.dev); tests migrated from vite-plus's bundled Vitest to a standalone `vitest` devDependency; lint migrated from `vp lint` to standalone `oxlint` (type-aware via `oxlint-tsgolint`), invoked as `oxlint -c ../../.oxlintrc.json .`. `vite-plus` dropped from `devDependencies` entirely. No change to build output.
- **Breaking:** `precompileOptions.strict` now defaults to `true` (was `false`). Templates that reference an undefined property now throw at render time instead of silently rendering empty. Opt back into the old behavior with `handlebars: { precompileOptions: { strict: false } }`.

## [0.7.0] - 2026-07-02

### Changed
- Build migrated from `tsc` to `vp pack` ([Vite+](https://viteplus.dev)'s tsdown/Rolldown-based library bundler); `main`/`types`/`exports` now point at `dist/index.mjs`/`dist/index.d.mts` instead of the `.js`/`.d.ts` equivalents. The lazy `import("handlebars")` and the `vite` peer's `Plugin` type import both stay external, unbundled.
- Tests migrated from a standalone `vitest` devDependency to vite-plus's bundled Vitest (`vite-plus/test`).
- `engines.node` tightened to `^20.19.0 || ^22.18.0 || >=24.11.0` (required by `vite-plus`).

### Added
- `lint` script (`vp lint`, Oxlint) — this package had no linting before.

## [0.6.0] - 2026-06-26

### Added

- Initial public release.
- `aemHandlebars()` Vite plugin (`enforce: "pre"`) that precompiles
  `*.template.hbs` files into runtime Handlebars functions, emitting a tiny
  ESM module of the shape
  `import Handlebars from "handlebars/runtime"; export default Handlebars.template(<precompiled>);`.
  Mirrors the legacy webpack `handlebars-loader` behavior so
  `import Foo from "./foo.template.hbs"; Foo({ data })` keeps working.
- Built-in stubbing of Storybook-only modules — `*.stories.{js,ts,tsx}` and
  non-template `*.hbs` partials are resolved to an empty ESM module so dynamic
  imports transitively reaching them never break the build. Matches the
  legacy webpack `IgnorePlugin` configuration. Configurable / disablable via
  the `ignore` option.
- Configurable `templateSuffix` (default `.template.hbs`), `runtime` module
  (default `handlebars/runtime`), and `precompileOptions` (default
  `{ strict: false }`) forwarded verbatim to `Handlebars.precompile`.
- `handlebars` is declared as a peer dependency so consumers control the
  Handlebars version their templates compile against.
