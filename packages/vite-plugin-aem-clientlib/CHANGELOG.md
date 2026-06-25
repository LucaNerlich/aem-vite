# Changelog

All notable changes to **@aemvite/vite-plugin-aem-clientlib** will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-25

### Added

- Initial public release.
- Pure descriptor renderers (`renderContentXml`, `renderTxt`, `renderJsTxt`,
  `renderCssTxt`) producing **byte-identical** AEM clientlib descriptors
  matching the archetype golden reference (locked attribute order,
  `dependencies` omitted when empty, exact whitespace/newlines).
- On-disk emitter (`emitClientlib`, `emitClientlibs`) that wipes and rewrites
  `clientlib-<name>/`, lays out `js/` / `css/` / `resources/` (only when
  non-empty), and classifies files via `classifyFile`.
- `aemClientlibPlugin` Vite plugin (`apply: "build"`) that runs the emitter at
  `closeBundle`.
- Zero runtime dependency on Vite for the renderer + emitter API surface.
