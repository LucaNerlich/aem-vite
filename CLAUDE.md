# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An npm-workspaces monorepo of six `@aemvite/*` packages that let an AEM `ui.frontend` Maven module replace the legacy **webpack + Babel + PostCSS + `aem-clientlib-generator`** stack with **Vite + esbuild + Sass** — while emitting clientlib descriptors (`.content.xml`, `js.txt`, `css.txt`) **byte-identical** to the AEM archetype's historical output, so dispatcher/Cloud Manager/cache tooling sees no change.

The user-facing README.md is the source of truth for the adopter-facing migration guide and per-package APIs; keep it in sync when behavior changes.

Tooling is [Vite+](https://viteplus.dev) (VoidZero's unified Vite/Vitest/Oxlint/Oxfmt/tsdown-Rolldown toolchain, driven by the `vp` CLI): each package builds with `vp pack` (tsdown/Rolldown) to `dist/`, tests with vite-plus's bundled Vitest (`vite-plus/test`), lints with Oxlint via `vp lint`. `vite-plus` does **not** replace the `vite` package as a library — its own exports are only `./test`, `./fmt`, `./lint`, `./pack` — so every package keeps a real `vite` dependency for type imports (`Plugin`/`UserConfig`/etc.) and, in `aem-config`, for Vite's programmatic build API. See "The byte-identical contract" below.

## Layout

- `packages/` — the six published packages (workspaces).
  - `aem-config` — the entry point. Typed config helper (`defineAemConfig`), config loader, build-options resolver, and the `aem-build` CLI orchestrator (`buildClientlibs`). Depends on the five plugin packages below and wires them into each clientlib's Vite build, so consumers install only `@aemvite/aem-config`.
  - `vite-plugin-aem-clientlib` — descriptor emitter (`.content.xml`, `js.txt`, `css.txt` + `js/`/`css/`/`resources/` layout). Replaces `aem-clientlib-generator`.
  - `vite-plugin-glob` — expands `@import`/`@use`/`@forward` glob specifiers in SCSS/CSS. Replaces `glob-import-loader` (styles).
  - `vite-plugin-aem-resources` — copies a clientlib `resources/` tree; no-ops on `.gitkeep`-only/empty trees.
  - `vite-plugin-aem-css-url-passthrough` — rewrites CSS `url()` references in built stylesheets back to `../resources/<sub>/<file>` form, mirroring webpack `css-loader { url: false }`.
  - `vite-plugin-aem-handlebars` — precompiles `.template.hbs` files into Handlebars runtime functions, mirroring webpack `handlebars-loader`; `handlebars` is a lazily-imported optional peer.
- `aemvite/` — a full AEM Maven multi-module archetype project used as the **reference consumer**. `aemvite/ui.frontend/` is the migrated frontend module (zero webpack) that wires the packages via `file:` links; `aemvite/core/` etc. are standard AEM Java/OSGi modules. The `aem-sdk-*.zip`, `author/`, `plan.md` are gitignored local-only artifacts.
- `aemviteexample/` — a second, minimal reference consumer that installs only `@aemvite/aem-config` from the real registry (no `file:` links, no `vite.config.*` of its own) — a before/after adopter comparison.

## Architecture / data flow

`aem.config.ts` (declarative list of clientlibs) → `aem-config` loads it and, per clientlib, runs one **Vite library build** (esbuild + Sass, with `vite-plugin-glob` and `vite-plugin-aem-resources` auto-wired as plugins) into a per-clientlib staging dir under `outDir` → `vite-plugin-aem-clientlib`'s `emitClientlib` writes the descriptor files and lays out `js/`/`css/`/`resources/` under `clientLibRoot`. All of this lives in `buildClientlibs` (`packages/aem-config/src/buildClientlibs.ts`); a descriptor-only clientlib (`entry: ''`) skips the Vite build but still emits its descriptor. Output JS/CSS are named after the **clientlib** (`<name>.js`/`<name>.css`, via `lib.fileName` + `lib.cssFileName`) so descriptors stay byte-identical.

Build options resolve in three layers, lowest to highest precedence: **mode baseline (`development`/`production`) → global `build` → per-clientlib `build`**, in `resolveBuildOptions`.

The build is driven entirely by the `aem-build` CLI (in `aem-config`) — **the consumer project holds only `aem.config.*`, no build script.** Advanced customization goes through the config's `plugins` / `vite` passthrough fields (global and per-clientlib), forwarded into each Vite build. The lower-level exports (`loadAemConfig`, `resolveBuildOptions`, `emitClientlib`) remain for assembling a bespoke orchestrator, but that is no longer needed for the archetype.

## The byte-identical contract

This is the core invariant of the project. `vite-plugin-aem-clientlib` reproduces descriptors byte-for-byte (locked namespaces/attribute order, `dependencies` omitted when empty, `#base=<bucket>\n\n<file>` txt format, no trailing newline). It is asserted with `Buffer.equals()` against captured golden fixtures in `packages/vite-plugin-aem-clientlib/test/__golden__` via `test/golden.test.ts`. **Any change to descriptor rendering must keep these golden tests passing** — do not edit fixtures to make a test pass unless the archetype's real output genuinely changed. Only descriptors and folder layout are byte-identical; minified JS/CSS *content* is intentionally not (esbuild ≠ webpack bytes).

## Commands

Run from the repo root unless noted.

```sh
npm run build         # vp pack all packages, in dependency order (build --workspaces)
npm test              # vp test run, all packages (test --workspaces --if-present)
npm run lint          # vp lint (Oxlint), all packages (lint --workspaces --if-present)
```

Per-package / single test:

```sh
npm test -w @aemvite/aem-config                          # one package
npm run test:watch -w @aemvite/vite-plugin-glob          # watch mode
( cd packages/aem-config && npx vp test run resolveBuildOptions )   # single test file by name
```

Building inside the reference consumer (`aemvite/ui.frontend/`):

```sh
npm run prod          # aem-build --mode prod --config aem.config.mjs  → byte-identical clientlibs
npm run dev           # aem-build --mode dev  --config aem.config.mjs  → no minify, inline sourcemaps
```

## Critical gotchas

- **npm vs pnpm.** Root `package.json` declares `"packageManager": "pnpm@10.33.4"`, but this repo is built and published as an **npm workspaces** monorepo. Corepack shims can silently route `npm` through `pnpm`, and pnpm **ignores `npm`'s `-w <name>` flag and publishes nothing**. When a workspace command misbehaves, prefix with `command npm` to bypass shims, or `cd` into the package directory. This bit the Vite+ migration itself: `vp migrate`/`vp install` respect the declared `packageManager` and generated a stray `pnpm-workspace.yaml` (with a `vite`→`@voidzero-dev/vite-plus-core` catalog override) — deleted, since this repo installs with npm, not pnpm. Don't rely on `vp install`/`vp migrate` to manage dependencies here; use `command npm install` directly.
- **Publishing is automated via CI**, not manual. Pushing a `v*` tag triggers `.github/workflows/publish.yml`, which uses npm OIDC trusted publishing (no NPM_TOKEN/OTP) and publishes in mandatory dependency order: `vite-plugin-aem-clientlib` → `vite-plugin-glob` → `vite-plugin-aem-resources` → `vite-plugin-aem-css-url-passthrough` → `vite-plugin-aem-handlebars` → `aem-config` (last, since it depends on the other five being resolvable). The README's manual `npm publish` section is a fallback. `prepublishOnly` runs `vp pack` automatically.
- **Version bumps** ripple: `aem-config` pins all five plugin packages at `^0.7.0`, so bumping any of them may require bumping the range in `aem-config` too.
- **Node engines** are pinned to `^20.19.0 || ^22.18.0 || >=24.11.0` (required by `vite-plus`; narrower than plain Vite 8's range — the 22.12–22.17 band is *not* supported). `vite` and `esbuild` are peer/optional-peer deps — consumers must install them explicitly. A `.nvmrc` (`24`) is provided.
- **Supply-chain hardening** in `.npmrc`: `minimum-release-age=10080` (7-day quarantine on new releases) and `block-exotic-subdeps=true`. Expect freshly published deps to be uninstallable for a week. Note: the real `npm` CLI logs `Unknown project config` warnings for both keys (they don't appear to be enforced by npm itself) — verify actual quarantine behavior before relying on it if it matters for a specific install.

## Conventions

- All packages are ESM (`"type": "module"`); internal imports use explicit `.js` extensions even from `.ts` sources (`moduleResolution: "Bundler"`, `verbatimModuleSyntax`). Strict TypeScript via `tsconfig.base.json`.
- `vp pack` (tsdown/Rolldown) emits `.mjs`/`.d.mts` (not `.js`/`.d.ts` like the previous `tsc` build) — `main`/`types`/`exports`/`bin` fields in each package.json point at the `.mjs`/`.d.mts` paths accordingly. Peer/dev deps declared in package.json (`vite`, `handlebars`) are automatically externalized, never bundled.
- Linting is Oxlint via `vp lint`, configured in the root `vite.config.ts`'s `lint` block (not a standalone `.oxlintrc.json` — that's not vite-plus's convention). The `vite-plus/prefer-vite-plus-imports` rule is deliberately turned off there: every package's `import type ... from "vite"` (and `aem-config`'s programmatic `import("vite")`) must stay on the real `vite` package, since `vite-plus` doesn't re-export it. Ruleset is otherwise vite-plus's Oxlint defaults, kept intentionally conservative — raising warnings to errors and fixing any backlog is a deliberate future follow-up, not part of this migration.
- **Lint must run after build, not before.** `typeAware`/`typeCheck` are on, so `aem-config`'s lint resolves the other five packages' types from their built `dist/*.d.mts` — running `vp lint` against a clean checkout before `npm run build` fails with `TS2307: Cannot find module '@aemvite/...'`. `.github/workflows/publish.yml` builds first, then lints, then tests.
