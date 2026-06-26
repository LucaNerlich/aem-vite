# Changelog

All notable changes to **@aemvite/vite-plugin-glob** will be documented in
this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
