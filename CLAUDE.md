# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An npm-workspaces monorepo of four `@aemvite/*` packages that let an AEM `ui.frontend` Maven module replace the legacy **webpack + Babel + PostCSS + `aem-clientlib-generator`** stack with **Vite + esbuild + Sass** — while emitting clientlib descriptors (`.content.xml`, `js.txt`, `css.txt`) **byte-identical** to the AEM archetype's historical output, so dispatcher/Cloud Manager/cache tooling sees no change.

The user-facing README.md is the source of truth for the adopter-facing migration guide and per-package APIs; keep it in sync when behavior changes.

## Layout

- `packages/` — the four published packages (workspaces). Each builds with `tsc` to `dist/`, tests with Vitest.
  - `aem-config` — the entry point. Typed config helper (`defineAemConfig`), config loader, build-options resolver, and the `aem-build` CLI orchestrator. Depends on `vite-plugin-aem-clientlib`.
  - `vite-plugin-aem-clientlib` — descriptor emitter (`.content.xml`, `js.txt`, `css.txt` + `js/`/`css/`/`resources/` layout). Replaces `aem-clientlib-generator`.
  - `vite-plugin-glob` — expands `@import`/`@use`/`@forward` glob specifiers in SCSS/CSS. Replaces `glob-import-loader` (styles).
  - `vite-plugin-aem-resources` — copies a clientlib `resources/` tree; no-ops on `.gitkeep`-only/empty trees.
- `aemvite/` — a full AEM Maven multi-module archetype project used as the **reference consumer**. `aemvite/ui.frontend/` is the migrated frontend module (zero webpack) that wires all four packages via `file:` links; `aemvite/core/` etc. are standard AEM Java/OSGi modules. The `aem-sdk-*.zip`, `author/`, `plan.md` are gitignored local-only artifacts.

## Architecture / data flow

`aem.config.ts` (declarative list of clientlibs) → `aem-config` loads it and, per clientlib, runs one **Vite library build** (esbuild + Sass, with `vite-plugin-glob` and `vite-plugin-aem-resources` as plugins) into a shared staging `outDir` → `vite-plugin-aem-clientlib`'s `emitClientlib` writes the descriptor files and lays out `js/`/`css/`/`resources/` under `clientLibRoot`.

Build options resolve in three layers, lowest to highest precedence: **mode baseline (`development`/`production`) → global `build` → per-clientlib `build`**, in `resolveBuildOptions`.

Two ways to drive the build: the `aem-build` CLI (in `aem-config`), or a custom orchestrator using the lower-level exports (`loadAemConfig`, `resolveBuildOptions`, `emitClientlib`) directly — see `aemvite/ui.frontend/aem-build.mjs`.

## The byte-identical contract

This is the core invariant of the project. `vite-plugin-aem-clientlib` reproduces descriptors byte-for-byte (locked namespaces/attribute order, `dependencies` omitted when empty, `#base=<bucket>\n\n<file>` txt format, no trailing newline). It is asserted with `Buffer.equals()` against captured golden fixtures in `packages/vite-plugin-aem-clientlib/test/__golden__` via `test/golden.test.ts`. **Any change to descriptor rendering must keep these golden tests passing** — do not edit fixtures to make a test pass unless the archetype's real output genuinely changed. Only descriptors and folder layout are byte-identical; minified JS/CSS *content* is intentionally not (esbuild ≠ webpack bytes).

## Commands

Run from the repo root unless noted.

```sh
npm run build         # tsc all packages (build --workspaces)
npm test              # vitest run all packages
npm run lint          # lint --workspaces --if-present (no-op today; no linter configured)
```

Per-package / single test:

```sh
npm test -w @aemvite/aem-config                          # one package
npm run test:watch -w @aemvite/vite-plugin-glob          # watch mode
( cd packages/aem-config && npx vitest run resolveBuildOptions )   # single test file by name
```

Building inside the reference consumer (`aemvite/ui.frontend/`):

```sh
npm run prod          # node aem-build.mjs prod  → byte-identical clientlibs
npm run dev           # node aem-build.mjs dev   → no minify, inline sourcemaps
```

## Critical gotchas

- **npm vs pnpm.** Root `package.json` declares `"packageManager": "pnpm@10.33.4"`, but this repo is built and published as an **npm workspaces** monorepo. Corepack shims can silently route `npm` through `pnpm`, and pnpm **ignores `npm`'s `-w <name>` flag and publishes nothing**. When a workspace command misbehaves, prefix with `command npm` to bypass shims, or `cd` into the package directory.
- **Publishing is automated via CI**, not manual. Pushing a `v*` tag triggers `.github/workflows/publish.yml`, which uses npm OIDC trusted publishing (no NPM_TOKEN/OTP) and publishes in mandatory dependency order: `vite-plugin-aem-clientlib` → `vite-plugin-glob` → `vite-plugin-aem-resources` → `aem-config` (last, since it depends on the clientlib package being resolvable). The README's manual `npm publish` section is a fallback. `prepublishOnly` runs `tsc` automatically.
- **Version bumps** ripple: `aem-config` pins `"@aemvite/vite-plugin-aem-clientlib": "^0.1.0"`, so bumping that package may require bumping the range in `aem-config` too.
- **Node engines** are pinned to `^20.19.0 || >=22.12.0` (Vite 8). `vite` and `esbuild` are peer/optional-peer deps — consumers must install them explicitly.
- **Supply-chain hardening** in `.npmrc`: `minimum-release-age=10080` (7-day quarantine on new releases) and `block-exotic-subdeps=true`. Expect freshly published deps to be uninstallable for a week.

## Conventions

- All packages are ESM (`"type": "module"`); internal imports use explicit `.js` extensions even from `.ts` sources (`moduleResolution: "Bundler"`, `verbatimModuleSyntax`). Strict TypeScript via `tsconfig.base.json`.
- No build-time linting in this toolchain (it was intentionally removed in the webpack→Vite migration); `npm run lint` is currently a no-op.
