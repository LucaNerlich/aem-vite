# aem-vite

[![npm: @aemvite/vite-plugin-aem-clientlib](https://img.shields.io/npm/v/%40aemvite%2Fvite-plugin-aem-clientlib?label=%40aemvite%2Fvite-plugin-aem-clientlib)](https://www.npmjs.com/package/@aemvite/vite-plugin-aem-clientlib)
[![npm: @aemvite/vite-plugin-glob](https://img.shields.io/npm/v/%40aemvite%2Fvite-plugin-glob?label=%40aemvite%2Fvite-plugin-glob)](https://www.npmjs.com/package/@aemvite/vite-plugin-glob)
[![npm: @aemvite/vite-plugin-aem-resources](https://img.shields.io/npm/v/%40aemvite%2Fvite-plugin-aem-resources?label=%40aemvite%2Fvite-plugin-aem-resources)](https://www.npmjs.com/package/@aemvite/vite-plugin-aem-resources)
[![npm: @aemvite/aem-config](https://img.shields.io/npm/v/%40aemvite%2Faem-config?label=%40aemvite%2Faem-config)](https://www.npmjs.com/package/@aemvite/aem-config)

Drop webpack from your AEM `ui.frontend` and build clientlibs with pure Vite.

`@aemvite/*` is a small toolchain of focused npm packages that lets any Adobe
Experience Manager (AEM) `ui.frontend` Maven module replace the legacy
**webpack + Babel + PostCSS + ESLint + `aem-clientlib-generator`** stack with
**Vite + esbuild + Sass**, while keeping the emitted clientlib descriptors
(`.content.xml`, `js.txt`, `css.txt`) **byte-identical** to the historical
output. AEM dispatcher, replication, Cloud Manager, and downstream caches see
exactly the same files — only the build that produces them changes.

## Packages

Each package name links to its npm page; the source for every package lives
under [`packages/`](./packages) in this repo.

| Package | Replaces | Responsibility |
|---|---|---|
| [`@aemvite/aem-config`](https://www.npmjs.com/package/@aemvite/aem-config) ([src](./packages/aem-config)) | Split webpack entries + `clientlib.config.js` | Typed config helper (`defineAemConfig`), loader, per-clientlib build-options resolver, and the `aem-build` CLI orchestrator. |
| [`@aemvite/vite-plugin-aem-clientlib`](https://www.npmjs.com/package/@aemvite/vite-plugin-aem-clientlib) ([src](./packages/vite-plugin-aem-clientlib)) | `aem-clientlib-generator` | Emits AEM clientlib descriptors (`.content.xml`, `js.txt`, `css.txt`) **byte-for-byte** against a captured golden reference, plus the `js/` / `css/` / `resources/` layout. |
| [`@aemvite/vite-plugin-glob`](https://www.npmjs.com/package/@aemvite/vite-plugin-glob) ([src](./packages/vite-plugin-glob)) | `glob-import-loader` (styles) | Expands `@import` / `@use` / `@forward` glob specifiers in `.scss`, `.sass`, and `.css` files with deterministic ordering. |
| [`@aemvite/vite-plugin-aem-resources`](https://www.npmjs.com/package/@aemvite/vite-plugin-aem-resources) ([src](./packages/vite-plugin-aem-resources)) | `copy-webpack-plugin` | Copies a clientlib `resources/` tree into the build output. No-ops on `.gitkeep`-only / empty source trees so they never materialize. |

## How they fit together

```
                    aem.config.ts
                          │
                          ▼
                ┌──────────────────┐
                │ @aemvite/        │   (loadAemConfig + mergeDefaults
                │ aem-config       │    + resolveBuildOptions)
                └────────┬─────────┘
                         │ for each clientlib: vite build()
                         ▼
        ┌────────────────────────────────────┐
        │  Vite (esbuild + Sass)             │
        │                                    │
        │  plugins:                          │
        │   • @aemvite/vite-plugin-glob      │  ← expand SCSS/CSS globs
        │   • @aemvite/vite-plugin-aem-      │  ← copy resources/
        │     resources                      │
        └────────────────┬───────────────────┘
                         │ js/css assets per clientlib
                         ▼
            ┌──────────────────────────────┐
            │ @aemvite/vite-plugin-aem-    │  emits:
            │ clientlib  (emitClientlibs)  │   .content.xml
            │                              │   js.txt / css.txt
            └──────────────┬───────────────┘   js/, css/, resources/
                           ▼
                    ui.apps/.../clientlibs/
                      clientlib-<name>/...
```

`@aemvite/aem-config` is the entry point — author your clientlibs in a typed
`aem.config.ts`, run `aem-build`, and the orchestrator drives one Vite library
build per entry into a shared `outDir`, then `@aemvite/vite-plugin-aem-clientlib`
writes the descriptor files and lays out `js/`, `css/`, and `resources/`. The
other two plugins slot into your `vite.config.*` (glob expansion) or your
clientlib entry (resource copy) as needed.

## Byte-identical descriptor guarantee

`@aemvite/vite-plugin-aem-clientlib` reproduces the AEM archetype's clientlib
descriptors **byte-for-byte**:

- Namespaces and attribute order locked: `categories → dependencies →
  cssProcessor → jsProcessor → allowProxy`.
- `dependencies` is omitted entirely when empty.
- `js.txt` / `css.txt` use the `#base=<bucket>\n\n<file>\n…` format with no
  trailing newline.
- Trailing newlines, encoding, and whitespace match the captured golden
  fixture (`Buffer.equals()` asserted in the package's unit tests).

This means dispatcher invalidation paths, Cloud Manager packagers, and any
downstream tooling that hashes or diffs clientlib descriptors keep working
without coordination.

## Quick start

The reference consumer is [`aemvite/ui.frontend`](./aemvite/ui.frontend) — a
realistic AEM Maven module that uses all four packages via `file:` links and
has zero webpack/Babel/PostCSS dependencies. Its `aem.config.mjs`,
`vite.config.mjs`, and `package.json` show the minimal wiring needed.

A minimal `aem.config.ts` looks like:

```ts
import { defineAemConfig } from "@aemvite/aem-config";

export default defineAemConfig({
  clientLibRoot: "../ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs",
  clientlibs: [
    {
      name: "site",
      entry: "src/main.ts",
      categories: ["myproject.site"],
      dependencies: ["myproject.dependencies"],
    },
  ],
});
```

Then in `package.json`:

```json
{
  "scripts": {
    "build": "aem-build --mode production --config aem.config.ts"
  }
}
```

See each package's README for installation lines, full APIs, and copy-pasteable
examples.

## Requirements

- **Node.js:** `^20.19.0 || >=22.12.0` (matches Vite 8 engines)
- **Vite:** `^7 || ^8` (peer dependency on the plugin packages)
- **Sass:** required only when consuming `.scss`/`.sass` sources (`sass` /
  `sass-embedded`); not declared as a peer because plain CSS works without it.

## Adopt @aemvite in your AEM project

The rest of this README is a copy-pasteable, end-to-end guide for converting
an existing AEM Maven project (with a `ui.frontend` → `ui.apps` clientlib
flow) from a webpack-based frontend to the `@aemvite/*` toolchain. Every
command and code snippet below is taken from
[`aemvite/ui.frontend`](./aemvite/ui.frontend) — the working reference
consumer in this repo — so anything you see here is verified against a real
build that produces byte-identical clientlib descriptors.

### 1. Prerequisites

Before you start, confirm your project matches the assumptions baked into the
toolchain:

- **Node.js** `^20.19.0 || >=22.12.0` (matches Vite 8's `engines`). Older Node
  releases will fail at `npm install` of `vite@^8`.
- **npm** (Yarn / pnpm work too, but the reference uses npm because that is
  what `frontend-maven-plugin` invokes by default).
- **An AEM Maven multi-module project** with a `ui.frontend/` module that
  feeds compiled assets into `ui.apps/` clientlibs — i.e. the standard AEM
  archetype layout. The clientlib root will look something like
  `ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs/`.
- **`frontend-maven-plugin`** in `ui.frontend/pom.xml` running `npm install`
  then `npm run prod` during `generate-resources`. The reference `pom.xml`
  ships exactly that wiring — see
  [`aemvite/ui.frontend/pom.xml`](./aemvite/ui.frontend/pom.xml). Maven does
  not need to change when you migrate; only the npm scripts behind
  `run prod` / `run dev` swap from webpack to `aem-build`.

### 2. Install

Run these inside `ui.frontend/` (the module that owns `package.json`):

```sh
# Just the entry-point package. @aemvite/aem-config depends on the three plugin
# packages (clientlib emitter, glob, resources), so they install transitively —
# you do not list them yourself.
npm install --save-dev @aemvite/aem-config

# Required peers. Vite 8 treats `esbuild` as an OPTIONAL peer, so install it
# explicitly — without it the build fails with `Cannot find package 'esbuild'`.
npm install --save-dev vite@^8 esbuild@^0.28.0

# Only if any clientlib entry imports .scss/.sass — plain CSS doesn't need it
npm install --save-dev sass
```

If your build needs an AEM publish/watch loop, also keep `aemsync` (the
reference uses `aemsync@^5.2.1`). It is independent of the build toolchain.

A published-package consumer's `ui.frontend/package.json` ends up this small:

```jsonc
{
  "type": "module",
  "devDependencies": {
    "@aemvite/aem-config": "^0.2.0", // pulls the three plugin packages in
    "aemsync": "^5.2.1",
    "esbuild": "^0.28.1",
    "sass":    "^1.77.0",
    "vite":    "^8.1.0",
    "vitest":  "^4.1.9"
  }
}
```

(`"type": "module"` is required so `aem.config.mjs` is loaded as ESM. The
reference `aemvite/ui.frontend` in this repo instead `file:`-links all four
`@aemvite/*` packages so the local monorepo resolves them without the registry;
a real adopter only needs the single `@aemvite/aem-config` dependency above.)

### 3. Create `aem.config.mjs`

`aem.config.mjs` (or `aem.config.ts` / `aem.config.js`) is the typed,
declarative description of every clientlib your `ui.frontend` produces.
`defineAemConfig()` is a typed identity helper — your editor gets full
autocompletion when you author the config in TypeScript.

The reference uses [`aemvite/ui.frontend/aem.config.mjs`](./aemvite/ui.frontend/aem.config.mjs).
Annotated full example:

```js
// aem.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineAemConfig } from '@aemvite/aem-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineAemConfig({
  // Where the emitter writes `clientlib-<name>/` folders. Absolute or
  // relative to the config file.
  clientLibRoot: path.resolve(
    __dirname,
    '../ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs',
  ),

  // Optional global build overrides (lowest precedence above the mode
  // baseline). Use this to set a project-wide JS/CSS target.
  build: {
    target: 'es2015',
  },

  // Optional escape hatch for advanced builds — extra Vite plugins applied to
  // every clientlib build (after the built-in glob/resources plugins), and a
  // deep Vite config override merged via Vite's `mergeConfig`. Both also exist
  // per-clientlib. This means you never need to write your own build script to
  // inject e.g. a framework plugin.
  // plugins: [someVitePlugin()],
  // vite: { resolve: { alias: { '@': '/src' } } },

  // Optional defaults merged into every clientlib (per-clientlib values
  // win wholesale — arrays are replaced, not concatenated).
  // defaults: { allowProxy: true },

  clientlibs: [
    {
      // Descriptor-only clientlib (no JS/CSS entry).
      // Useful as a single `dependencies` umbrella others can reference.
      name: 'dependencies',
      entry: '',
      categories: ['<project>.dependencies'],
    },
    {
      name: 'site',
      entry: 'src/main/webpack/site/main.ts',   // produces site.js (+ site.css)
      categories: ['<project>.site'],
      dependencies: ['<project>.dependencies'], // omitted from XML when empty
      // embed: ['<project>.shared'],            // optional
      resources: ['src/main/webpack/resources'], // copied to resources/
      // Per-clientlib build overrides win over the global `build` block.
      build: {
        minify: { js: true, css: true }, // fine-grained per asset
        sourcemap: false,                // false | true | "inline" | "hidden"
        // target: 'es2018',
      },
    },
  ],
});
```

Build options resolve in three layers — **mode baseline → global `build` →
per-clientlib `build`** — so you can keep the project default while opting a
single clientlib into a different minify or sourcemap policy. The mode
baselines (with no overrides) are:

| Mode | JS minify | CSS minify | sourcemap | target |
|---|---|---|---|---|
| `development` | off | off | `"inline"` | `"es2015"` |
| `production`  | on (esbuild) | on (esbuild) | off | `"es2015"` |

Field reference for every supported option lives in the
[`@aemvite/aem-config` README](./packages/aem-config#config-shape).

### 4. Drive the build with the `aem-build` CLI

There is **no build script to write** — `@aemvite/aem-config` ships an
`aem-build` bin that loads your config and builds every clientlib for you:

```sh
npx aem-build --mode production --config aem.config.mjs
# or, with the short flags:
npx aem-build -m dev -c aem.config.mjs -o dist
```

The CLI accepts `--mode dev|prod|development|production`, `--config <path>`
(default `./aem.config.ts`, then `.mts`, `.mjs`, `.js`), and `--out-dir <path>`
(the staging dir, default `./dist`). It calls `buildClientlibs()`, which for
each clientlib:

- skips the Vite build for a descriptor-only clientlib (`entry: ''`) but still
  emits its descriptor;
- otherwise runs one Vite library build wiring `@aemvite/vite-plugin-glob`
  (SCSS/CSS globs), `@aemvite/vite-plugin-aem-resources` (your `resources`),
  and any `plugins` / `vite` overrides from your config;
- names the outputs after the clientlib (`<name>.js` / `<name>.css`) and lets
  `@aemvite/vite-plugin-aem-clientlib` emit byte-identical descriptors into
  `clientLibRoot`.

`--mode development` ↔ dev baselines (no minify, inline sourcemap);
`--mode production` ↔ prod baselines (esbuild minify on, no sourcemap) — exactly
`resolveBuildOptions(mode, config.build, clientlib.build)`, byte-identical to
the historical webpack descriptors (verified against a captured golden
reference).

**Need something the config can't express?** Reach for the `plugins` / `vite`
passthrough first (see step 3). Only if that is still not enough, the
lower-level exports (`loadAemConfig`, `resolveBuildOptions`, `emitClientlib`)
let you assemble a bespoke orchestrator — but the CLI is the supported path and
covers the archetype end to end.

### 5. Wire npm scripts (and Maven)

In `ui.frontend/package.json`:

```jsonc
{
  "scripts": {
    "dev":   "aem-build --mode dev --config aem.config.mjs",
    "prod":  "aem-build --mode prod --config aem.config.mjs",
    "start": "vite",                         // Vite dev server (optional)
    "sync":  "aemsync -d -p ../ui.apps/src/main/content",
    "watch": "aemsync -w ../ui.apps/src/main/content",
    "test":  "vitest run"
  }
}
```

**Maven side:** `frontend-maven-plugin` calls `npm run prod` during
`generate-resources` (and `npm run dev` under the `fedDev` profile in the
reference). Because the npm script names did not change, you do **not** need
to edit `pom.xml` — but its `<nodeVersion>` must satisfy Vite 8's engines
(`^20.19.0 || >=22.12.0`); the reference pins `v22.12.0`. An older Node fails
with `SyntaxError: ... does not provide an export named 'styleText'`. Confirm
with:

```sh
mvn -f ui.frontend/pom.xml -P fedDev generate-resources
```

### 6. Entry points and source layout

Each clientlib in `aem.config.mjs` points at one entry file. The build
produces a single `<name>.js` (and `<name>.css` if styles are imported)
that lands in `clientlib-<name>/js/` and `clientlib-<name>/css/` inside
your `clientLibRoot`. Picture (matches the reference exactly):

```
ui.frontend/src/main/webpack/
├── components/         // splat-imported via globs (SCSS + JS)
├── resources/          // copied to clientlib-site/resources/
└── site/
    ├── main.ts         // entry → site.js
    ├── main.scss       // imported by main.ts → site.css
    ├── _variables.scss
    └── _base.scss
```

The reference `main.ts` shows how Vite-native `import.meta.glob` replaces
webpack's `glob-import-loader` for JavaScript / TypeScript:

```ts
// src/main/webpack/site/main.ts
import './main.scss';

// Eagerly evaluate every sibling and component module for side-effects.
// import.meta.glob does not include the calling module itself.
import.meta.glob('./**/*.js',         { eager: true });
import.meta.glob('./**/*.ts',         { eager: true });
import.meta.glob('../components/**/*.js', { eager: true });
```

For SCSS / CSS globs, `@aemvite/vite-plugin-glob` rewrites your
`@import` / `@use` / `@forward` rules **before** Sass and esbuild see them.
Authoring stays unchanged:

```scss
/* main.scss */
@import 'variables';
@import 'base';
@import '../components/**/*.scss';   // ← expanded by @aemvite/vite-plugin-glob
@import './styles/*.scss';           // ← expanded too
```

The `vite-plugin-glob` plugin only needs to be active during the per-entry
Vite build — `aem-build` wires it in for you automatically. If you run
`vite` as a standalone dev server (`npm start`), put it in your
`vite.config.mjs` plugins array as well:

```js
// vite.config.mjs (optional, only for `vite` dev server)
import { defineConfig } from 'vite';
import { aemViteGlob } from '@aemvite/vite-plugin-glob';

export default defineConfig({
  root: 'src/main/webpack/static',
  plugins: [aemViteGlob()],
  server: {
    proxy: {
      '/content':       'http://localhost:4502',
      '/etc.clientlibs': 'http://localhost:4502',
    },
  },
});
```

Output descriptors land directly under your `clientLibRoot`:

```
ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs/
├── clientlib-dependencies/
│   ├── .content.xml
│   ├── js.txt          // "#base=js\n\n"   (no files)
│   └── css.txt         // "#base=css\n\n"  (no files)
└── clientlib-site/
    ├── .content.xml
    ├── js.txt          // "#base=js\n\nsite.js"
    ├── css.txt         // "#base=css\n\nsite.css"
    ├── js/site.js
    └── css/site.css
    // resources/ is only created when real files exist (.gitkeep is skipped)
```

### 7. Migrate off webpack

The whole point of the migration is dropping the webpack stack. In the
reference conversion, **every one** of these `ui.frontend` devDependencies
and config files was removed (and replaced by Vite, esbuild, Sass, and the
four `@aemvite/*` packages):

| Category | Removed |
|---|---|
| Webpack core | `webpack`, `webpack-cli`, `webpack-dev-server`, `webpack-merge` |
| Babel | every `@babel/*` |
| **ESLint** | `eslint`, `eslint-webpack-plugin`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` |
| Clientlib generation | `aem-clientlib-generator`, `glob-import-loader` |
| Loaders | `ts-loader`, `tsconfig-paths-webpack-plugin`, `style-loader`, `css-loader`, `mini-css-extract-plugin`, `sass-loader`, `source-map-loader`, `copy-webpack-plugin`, `clean-webpack-plugin`, `terser-webpack-plugin`, `css-minimizer-webpack-plugin` |
| PostCSS | `postcss`, `postcss-loader`, `autoprefixer`, `cssnano` |
| Misc | `html-webpack-plugin`, `chokidar-cli`, `acorn` |

Concrete delete checklist:

- Delete the webpack configs: `webpack.common.js`, `webpack.dev.js`,
  `webpack.prod.js`, `webpack.config.js`, and the legacy `clientlib.config.js`
  consumed by `aem-clientlib-generator`.
- Delete ESLint config (`.eslintrc*`, `eslint.config.*`). The migration
  removes build-time linting entirely; you can re-add ESLint later as a
  standalone flat-config script without touching the build.
- Delete Babel config (`babel.config.*`, `.babelrc*`).
- Delete any PostCSS config (`postcss.config.*`, `.postcssrc*`).
- Drop the matching `devDependencies` entries from `package.json` (or run
  `npm uninstall` for each).
- Update `package.json` scripts so `dev` / `prod` point at the new
  orchestrator (see step 5).

In the reference, the net dependency reduction is roughly **30+ removed →
4 added (`@aemvite/*` + `vite`)**, with `sass`, `aemsync`, and `vitest`
unchanged.

### 8. Verify byte-identical clientlib output

The descriptor emitter is contractually byte-identical to the AEM
archetype's historical output (`Buffer.equals()` asserted in
`@aemvite/vite-plugin-aem-clientlib`'s tests against a captured golden
fixture). To verify in your own project before deleting the old build:

1. **Capture a golden reference** from the current webpack build:

   ```sh
   # On the pre-migration branch
   npm run prod
   cp -R ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs \
         /tmp/golden-clientlibs
   ```

2. **Run the new build** on the migration branch:

   ```sh
   npm run prod
   ```

3. **Diff structure and descriptors:**

   ```sh
   # Tree comparison
   diff -r /tmp/golden-clientlibs \
           ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs

   # Per-file byte equality
   shasum /tmp/golden-clientlibs/clientlib-site/.content.xml \
          ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs/clientlib-site/.content.xml
   shasum /tmp/golden-clientlibs/clientlib-site/js.txt  ui.apps/.../clientlib-site/js.txt
   shasum /tmp/golden-clientlibs/clientlib-site/css.txt ui.apps/.../clientlib-site/css.txt
   ```

   `.content.xml`, `js.txt`, and `css.txt` must hash identically. JS/CSS
   bundle content is **not** asserted byte-identical — only descriptors and
   the on-disk folder layout are. (That is intentional: esbuild and webpack
   produce different bytes for the same source.)

4. **Repeat with `npm run dev`** — descriptors are independent of mode, so
   both builds must produce the same descriptor bytes.

#### Troubleshooting

- **`clientlib-<name>/resources/` directory unexpectedly missing.** This is
  by design when the source `resources/` tree contains only `.gitkeep`
  placeholders (`@aemvite/vite-plugin-aem-resources` treats placeholder-only
  trees as empty and emits nothing — see its
  [README](./packages/vite-plugin-aem-resources#notes--caveats)). Add at
  least one real file and re-run.
- **CSS globs produced unexpected ordering.** `@aemvite/vite-plugin-glob`
  sorts matched files lexicographically by default; pass a custom `sort`
  comparator to override. Non-glob `@import 'variables';` is preserved
  verbatim, so authoring errors there surface as Sass errors, not silent
  drops.
- **`npm install` complains about an unmet peer for `vite`.** Three of the
  four `@aemvite/*` packages declare `vite ^7 || ^8` as a peer dependency
  (`@aemvite/vite-plugin-aem-clientlib` is the exception — see its
  [README](./packages/vite-plugin-aem-clientlib#install)). Install
  `vite@^8` explicitly as a devDependency in `ui.frontend/`.
- **`Error: Cannot find package 'esbuild'`** during `npm run prod`. Vite 8
  declares `esbuild` as an OPTIONAL peer dependency (range `^0.27.0 || ^0.28.0`),
  so a clean `npm install` will not pull it in. Add it explicitly:
  `npm install --save-dev esbuild@^0.28.0`.
- **`Unknown --mode 'release'` (or similar) from `aem-build`.** Only
  `dev`, `prod`, `development`, and `production` are accepted.
- **`Error: Cannot find package 'vite'`** during `npm run prod`.
  Make sure `vite` is installed in `ui.frontend/node_modules` (it is a peer
  of `@aemvite/aem-config`, so npm 7+ should auto-install it, but
  `npm install --save-dev vite@^8` makes it explicit).
- **Maven works locally, fails in CI.** Confirm CI Node satisfies
  `^20.19.0 || >=22.12.0` and that `frontend-maven-plugin` is pinned to a
  Node version that does too. Cloud Manager picks the Node version from
  the plugin configuration; bump it if you see `EBADENGINE` warnings.

### 9. Reference docs for each package

Once the migration is done, the per-package READMEs are the source of truth
for every exposed API:

- [`@aemvite/aem-config`](./packages/aem-config) — full `AemConfig` /
  `AemClientlib` / `BuildOptions` field tables, the build-options resolution
  rules, the `aem-build` CLI flags, and the programmatic
  `buildClientlibs` / `mergeDefaults` / `resolveBuildOptions` API.
- [`@aemvite/vite-plugin-aem-clientlib`](./packages/vite-plugin-aem-clientlib) —
  `emitClientlib` / `emitClientlibs` / `renderContentXml` / `renderJsTxt` /
  `renderCssTxt` / `classifyFile` / `aemClientlibPlugin`, plus the
  byte-identical contract details.
- [`@aemvite/vite-plugin-glob`](./packages/vite-plugin-glob) — `aemViteGlob`
  plugin options, the pure `expandStyleGlobs` / `expandStyleGlobsWithResult`
  helpers, and the `extensions` + `sort` knobs.
- [`@aemvite/vite-plugin-aem-resources`](./packages/vite-plugin-aem-resources) —
  `aemResources` options (single vs multiple entries, absolute paths) and
  the `.gitkeep`-only no-op behavior that keeps clientlib output
  byte-identical.


## Status & scope

- All four packages: **`0.1.0`**, first public release. Independent unit
  tests; `vite-plugin-aem-clientlib` asserts byte-identical descriptors against
  the captured golden reference via `Buffer.equals()`.
- The reference `aemvite/ui.frontend` module has been migrated and verified —
  `npm run prod` and `npm run dev` both produce identical clientlib output
  vs. the captured golden.
- Out of scope this round: build-time linting, Handlebars / Storybook
  integrations, SCSS-to-CSS source migration, byte-level parity of minified
  JS/CSS *content* (only descriptors and folder structure are byte-identical).

## Publishing to npm

Maintainer reference for cutting a release of the four `@aemvite/*` packages
to the public npm registry. The same sequence works for the first publish and
for subsequent version bumps.

### Prerequisites

- An npm account with publish rights on the `@aemvite` organisation. The org
  itself must exist at <https://www.npmjs.com/org/aemvite> — creating it is a
  one-time manual step.
- Logged in on this machine:

  ```sh
  npm login
  npm whoami
  ```

- A 2FA device ready: npm prompts for a fresh OTP **per `npm publish`**, so
  four prompts total. OTPs are short-lived (~30 s); if one expires you will
  see `EOTP` and can simply re-run that single command.

### Publish order (and why it matters)

Publish in dependency order so each later package can resolve its
`@aemvite/*` dependency from the registry:

1. **`@aemvite/vite-plugin-aem-clientlib`** — must go first; `aem-config`
   declares `"@aemvite/vite-plugin-aem-clientlib": "^0.1.0"` and resolves it
   from the public registry on install.
2. **`@aemvite/vite-plugin-glob`** — independent, any order after step 1.
3. **`@aemvite/vite-plugin-aem-resources`** — independent, any order after
   step 1.
4. **`@aemvite/aem-config`** — must go last (depends on step 1 being live).

### Commands (per-directory form, recommended)

Run from the monorepo root. Each `npm publish` triggers the package's
`prepublishOnly` hook, which runs `npm run build` (`tsc`) — no separate
build step is needed. Pass a fresh OTP each time:

```sh
( cd packages/vite-plugin-aem-clientlib && npm publish --access public --otp=XXXXXX )
( cd packages/vite-plugin-glob          && npm publish --access public --otp=XXXXXX )
( cd packages/vite-plugin-aem-resources && npm publish --access public --otp=XXXXXX )
( cd packages/aem-config                && npm publish --access public --otp=XXXXXX )
```

### Workspace alternative

The npm workspace form publishes the same tarballs from the repo root:

```sh
npm publish --access public -w @aemvite/vite-plugin-aem-clientlib --otp=XXXXXX
npm publish --access public -w @aemvite/vite-plugin-glob          --otp=XXXXXX
npm publish --access public -w @aemvite/vite-plugin-aem-resources --otp=XXXXXX
npm publish --access public -w @aemvite/aem-config                --otp=XXXXXX
```

**Gotcha:** the root `package.json` declares `"packageManager":
"pnpm@10.33.4"`, which Corepack-aware shims can use to route `npm` through
`pnpm`. `pnpm` silently ignores `npm`'s `-w <name>` form and publishes
nothing. If you see that, either prefix with `command npm` (bypasses shims)
or use the per-directory form above, which is immune to this.

### Notes and gotchas

- **`--access public` is required on the first publish** of each scoped
  package; without it npm defaults scoped packages to `restricted` and
  rejects with a paid-tier error. The `publishConfig.access: "public"` field
  in each `package.json` also covers this, but the explicit flag is harmless.
- **Fresh OTP per command.** OTPs are single-use and short-lived. On `EOTP`,
  re-run that one command with a new code — earlier successful publishes are
  not affected.
- **No overwrites.** Re-running a publish for an already-published version
  fails with `EPUBLISHCONFLICT`. To re-release you must bump the version
  (see [Bumping a version](#bumping-a-version)).
- **Brief CDN propagation.** Right after step 1, the `aem-config` publish
  may fail to resolve `@aemvite/vite-plugin-aem-clientlib@^0.1.0` from the
  registry CDN. Wait ~20 s and retry only the `aem-config` step.

### Verify after publishing

```sh
npm view @aemvite/vite-plugin-aem-clientlib version
npm view @aemvite/vite-plugin-glob          version
npm view @aemvite/vite-plugin-aem-resources version
npm view @aemvite/aem-config                version
```

All four should report `0.1.0` (or the new version you just published).

### Bumping a version

Per package you want to release:

1. Edit `packages/<name>/package.json` and bump `version` (semver — patch /
   minor / major).
2. Add a corresponding entry at the top of `packages/<name>/CHANGELOG.md`.
3. If the bumped package is a dependency of another `@aemvite/*` package
   (currently only `aem-config` → `vite-plugin-aem-clientlib`), bump the
   range in the dependent's `package.json` too.
4. Re-publish using the same command for that package — `prepublishOnly`
   re-runs `tsc` automatically, so no separate build step is required.

## License

[MIT](./LICENSE) © Luca Nerlich
