# Changelog

All notable changes to this project will be documented in this file.

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
