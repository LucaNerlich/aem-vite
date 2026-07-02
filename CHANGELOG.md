# Changelog

All notable changes to this project will be documented in this file.

## [0.7.0] - 2026-07-02

### Changed
- **Toolchain migrated to [Vite+](https://viteplus.dev)** (VoidZero's unified Vite/Vitest/Oxlint/Oxfmt/tsdown-Rolldown toolchain, driven by the `vp` CLI). All six packages now build with `vp pack` (tsdown/Rolldown) instead of `tsc`, and test with vite-plus's bundled Vitest (`vite-plus/test`) instead of a standalone `vitest` devDependency.
- Package build output extension changed from `.js`/`.d.ts` to `.mjs`/`.d.mts` (tsdown's default for ESM output); `main`/`types`/`exports`/`bin` fields updated accordingly in every package. Only the packages' own dist shape changed — the byte-identical clientlib descriptor contract for consumers is unaffected (verified against golden fixtures and a live `aem-build --mode prod` run).
- Node engines tightened to `^20.19.0 || ^22.18.0 || >=24.11.0` (required by `vite-plus`; the previous Vite-8-only range included the now-unsupported 22.12–22.17 band).
- CI (`publish.yml`) bumped to Node 24 and now builds before linting (aem-config's type-aware lint needs the other five packages' built `.d.mts` to resolve).
- `aemviteexample/ui.frontend`'s `tsconfig.json` had a stale, self-referential `baseUrl` removed, and gained a standard `vite-env.d.ts` ambient-types shim (`import.meta.glob`/`.scss` side-effect imports need it to type-check cleanly) — **no `vite-plus` devDependency added**, since that would either bloat every real adopter's install (if pushed through `@aemvite/aem-config` as a real dependency) or create a phantom-dependency footgun (if left undeclared and relied on hoisting). This module stays a genuinely minimal consumer.

### Added
- **Real linting, repo-wide, for the first time.** Every package now runs Oxlint via `vp lint`, configured in a new root `vite.config.ts`. `npm run lint` at the root is no longer a no-op. (`aemviteexample/ui.frontend` intentionally excluded — see above.)
- `aemvite/ui.frontend`'s standalone dev-proxy server now runs via `vp dev` (`npm start`) instead of the raw `vite` CLI.
- `.nvmrc` pinning Node 24.

### Fixed
- `aemvite/ui.frontend/test/descriptors-parity.test.mjs` called a long-removed `aem-build.mjs` wrapper (per the `[0.2.0]` entry below) instead of the real `aem-build` CLI bin — the byte-identical parity test had been silently broken since that removal. Now invokes `node_modules/.bin/aem-build` directly.

## [0.6.0] - 2026-06-26

### Added
- New `@aemvite/vite-plugin-aem-handlebars` package: precompiles `.template.hbs` files via `handlebars/runtime` and stubs out Storybook stories / non-template `.hbs` partials so they do not ship in the clientlib bundle.
- Declarative `handlebars: true | { include?, ignore?, runtime? }` field on `defineAemConfig`, supported both globally and per-clientlib. Per-clientlib overrides win over the global value.
- Lazy-loaded plugin wiring in `@aemvite/aem-config`: the handlebars plugin and the `handlebars` peer are only imported when at least one clientlib enables the feature, keeping `handlebars` an optional peer dependency.

### Changed
- CI publish workflow extended to publish `@aemvite/vite-plugin-aem-handlebars` as step 5/6 (publish order: clientlib → glob → resources → css-url-passthrough → handlebars → aem-config).
- All six packages unified at `0.6.0`.

## [0.5.1] - 2026-06-26

### Fixed
- Switched Vite/Rollup output format from `es` to `iife` in `@aemvite/aem-config`. ESM top-level declarations leaked into AEM's clientlib aggregation scope and caused `SyntaxError: Identifier has already been declared` at runtime. The IIFE wrapper scopes all declarations, matching the behaviour of the legacy webpack output.

## [0.5.0] - 2026-06-26

### Added
- New `@aemvite/vite-plugin-aem-css-url-passthrough` package: rewrites `url(...)` references in emitted clientlib CSS back to the canonical `../resources/<sub>/<file>` form. Mirrors webpack `css-loader: { url: false }` behaviour. Opt-in via `cssUrlPassthrough` on `defineAemConfig`.
- `embed` descriptor support in `@aemvite/vite-plugin-aem-clientlib` — clientlibs can now declare embedded libraries via the `embed` field in `.content.xml`.

### Changed
- Babel and ESLint configs removed from the repo (no longer part of the toolchain).
- All five packages unified at `0.5.0`.

## [0.4.0] - 2026-06-26

### Added
- Sourcemap support: Vite external sourcemaps are now routed to `resources/sourcemaps/` inside each clientlib so AEM serves them as plain static files. The `sourceMappingURL` comment in emitted JS/CSS is rewritten to the AEM-served path, and sourcemap `sources[]` entries are remapped to `aemvite://<clientlib>/` virtual URLs for clean DevTools organisation.

### Changed
- ES build target updated to `es2026`.
- `@aemvite/vite-plugin-*` dependency ranges in `@aemvite/aem-config` bumped to `^0.4.0`.
- All four packages unified at `0.4.0`.

## [0.3.1] - 2026-06-26

### Added
- `aemviteexample/` — a second minimal reference consumer project that installs only `@aemvite/aem-config` (peer deps auto-resolved), useful as a before/after migration comparison.

### Fixed
- `MIGRATION.md` now includes an exact `pom.xml` diff for upgrading `frontend-maven-plugin` from the archetype-default Node v16 to v22.12.0/npm 10.9.0.

### Changed
- `.gitignore` extended to exclude `dist/` under both `aemviteexample/` and `aemvite/` example directories.

## [0.3.0] - 2026-06-26

### Changed
- **Breaking:** minimum Node.js version tightened to `^22` (dropped Node 20). Vite 8 + rolldown require Node 22; the previous `^20.19.0 || >=22.12.0` range was overly broad.
- **Breaking:** Vite peer dependency narrowed to `^8` (dropped Vite 7) across all four packages.
- `@aemvite/aem-config` peer dep ranges updated to `^0.2.0` for all three plugin packages.
- `@aemvite/vite-plugin-glob`: `tinyglobby` bumped from `^0.2.10` to `^0.2.17`.
- `esbuild` peer in `@aemvite/aem-config` tightened to `^0.28` (matches Vite 8's own range).

## [0.2.2] - 2026-06-26

### Added
- `MIGRATION.md` — step-by-step guide for porting a stock AEM Maven archetype `ui.frontend` from webpack to `@aemvite/*`, with exact uninstall commands, file delete list, and verified before/after state.

### Fixed
- `@aemvite/aem-config` now declares `esbuild ^0.27.0 || ^0.28.0` as a **required** peer dependency. Vite 8 demoted it to an optional peer, so `npm install @aemvite/aem-config` previously left `esbuild` uninstalled, causing `Cannot find package 'esbuild'` on the first `aem-build --mode prod` run.

### Changed
- CI: publish workflow now builds workspaces in dependency order so `@aemvite/aem-config` resolves the plugin package types during compilation.

## [0.2.1] - 2026-06-26

### Changed
- Improved `@aemvite/aem-config` README: documented `plugins`/`vite` passthrough fields, added "Where does `aem-build` come from?" section, replaced manual OTP publishing instructions with CI-first workflow.
- Example project (`aemvite/ui.frontend`): rewrote `README.md` to document the Vite-based setup (replaces the stale webpack-era README), removed `esbuild` from devDependencies (installed transitively via `vite`), removed `aemsync` and the `start`/`sync`/`watch` scripts, bumped `sass` to `^1.101.0`, updated `tsconfig.json` to modern TypeScript settings.

## [0.2.0] - 2026-06-26

### Added
- `plugins` and `vite` passthrough fields on `AemConfig` and `AemClientlib` — advanced consumers can inject Vite plugins or deep config overrides without writing a custom build script.
- `aem.config.mjs` is now a recognised default config filename (alongside `.ts` / `.js`).

### Changed
- `@aemvite/aem-config` now depends directly on `@aemvite/vite-plugin-glob` and `@aemvite/vite-plugin-aem-resources`; consumers only need to install `@aemvite/aem-config` and the two peer deps (`vite`, `esbuild`).
- Built-in `buildClientlibs` orchestrator is now self-sufficient: automatically wires the glob and resources plugins, names outputs after the clientlib (`site.js` / `site.css`), skips the Vite build for descriptor-only clientlibs (`entry: ''`) while still emitting their descriptors, and emits directly to `clientLibRoot`. Custom build scripts are no longer needed in consumer projects.
- Example project (`aemvite/ui.frontend`) updated to use the built-in CLI only (`aem-build --config aem.config.mjs`); `aem-build.mjs` removed.

### Fixed
- Maven build crash (`SyntaxError: styleText`) caused by `frontend-maven-plugin` using Node v16. Updated `pom.xml` to Node v22.12.0 / npm 10.9.0 (minimum required by Vite 8 + rolldown).
