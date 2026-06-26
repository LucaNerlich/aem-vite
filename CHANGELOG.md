# Changelog

All notable changes to this project will be documented in this file.

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
