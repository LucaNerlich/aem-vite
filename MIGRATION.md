# Migration Guide — AEM Maven Archetype `ui.frontend`: webpack → `@aemvite`

This is the deep, archetype-specific walkthrough for porting a stock AEM Maven
archetype `ui.frontend` from its legacy **webpack + Babel + PostCSS + ESLint +
`aem-clientlib-generator`** stack to **Vite + esbuild + Sass** via the
[`@aemvite/*`](./README.md#packages) npm packages.

It is written for someone whose `ui.frontend/` came straight out of the Adobe
AEM Maven archetype — i.e. the exact OOTB stack captured in
[`git rev-parse 126d04c^`](https://github.com/) (the commit immediately before
the migration in this repo). Every command, file name, and dependency below was
verified against the real before state (`git show 126d04c^:…`) and the real
after state (current [`aemvite/ui.frontend/`](./aemvite/ui.frontend)).

The shorter, generic adoption walkthrough lives in
[README → "Adopt @aemvite in your AEM project"](./README.md#adopt-aemvite-in-your-aem-project).
This guide complements it with the archetype's exact before-state, an exact
uninstall command, and the precise delete list. Cross-link the two as needed.

---

## 1. What changes — and what does **not**

| | Before (archetype) | After (`@aemvite/*`) |
|---|---|---|
| JS bundler | webpack 5 + `ts-loader` + `webpack-cli` | Vite 8 + esbuild |
| CSS pipeline | `sass-loader` → `postcss-loader` (autoprefixer / cssnano) → `css-loader` → `MiniCssExtractPlugin` | Sass (Vite-native) + esbuild minify |
| SCSS glob imports | `glob-import-loader` | `@aemvite/vite-plugin-glob` |
| JS glob imports | `glob-import-loader` | Vite-native `import.meta.glob` |
| Resources copy | `copy-webpack-plugin` | `@aemvite/vite-plugin-aem-resources` |
| Clientlib descriptors | `aem-clientlib-generator` driven by `clientlib.config.js` | `@aemvite/vite-plugin-aem-clientlib` driven by `aem.config.mjs` |
| Lint at build time | `eslint-webpack-plugin` (+ `@typescript-eslint/*`) | none (intentionally removed; re-add ESLint as a standalone script later if you want) |
| Dev server | `webpack-dev-server` | `vite` (optional `npm start`) |
| Babel | `@babel/core` + plugins | gone — esbuild handles modern JS/TS |
| Build orchestrator | `webpack --config ./webpack.{dev,prod}.js && clientlib --verbose` | `aem-build` CLI (in `@aemvite/aem-config`) |

What does **not** change:

- The clientlib descriptors (`.content.xml`, `js.txt`, `css.txt`) are emitted
  **byte-identical** to the historical archetype output. AEM, dispatcher,
  Cloud Manager, replication, and any cache tooling that hashes those files
  see exactly the same bytes — only the build producing them changes. See
  [README → "Byte-identical descriptor guarantee"](./README.md#byte-identical-descriptor-guarantee).
- `ui.frontend/pom.xml` is untouched. `frontend-maven-plugin` still runs
  `npm install` and `npm run prod` during `generate-resources`; the `fedDev`
  profile still runs `npm run dev`. Only the npm scripts behind those names
  swap from webpack to `aem-build`.
- `ui.apps` is untouched. The emitter writes into the same `clientLibRoot`
  the archetype already uses
  (`ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs/`).
- `src/main/webpack/` source layout is preserved — you do not have to move
  files. (The folder is still called `webpack/` in the reference even after
  migration; renaming is optional and orthogonal.)
- You install `@aemvite/*` from the **public npm registry**. The monorepo in
  this repo is only the source of truth for the four packages; an adopting
  project never needs to clone it or use `file:` links.

---

## 2. Prerequisites

- **Node.js** `^20.19.0 || >=22.12.0` — the engines range for Vite 8. Older
  Node fails `npm install` of `vite@^8` and also breaks
  `frontend-maven-plugin` invocations (`SyntaxError: ... does not provide an
  export named 'styleText'`).
- **npm** (Yarn / pnpm work, but `frontend-maven-plugin` defaults to npm; the
  reference uses npm).
- **An AEM Maven multi-module project** that already wires `ui.frontend` →
  `ui.apps/clientlibs` via `frontend-maven-plugin`. If you came from the
  archetype, you already have this.
- **Network access to npm** to install `@aemvite/aem-config`, `vite`,
  and (if you use Sass) `sass`. `esbuild` comes in transitively as a peer
  dependency of `@aemvite/aem-config` (npm 7+ / pnpm 8+ auto-install peers).

---

## 3. Before / after file map

The OOTB archetype ships these JS-build-related files in
`aemvite/ui.frontend/`. Each is either replaced by an `@aemvite/*` mechanism
or simply deleted.

| OOTB file | Action | Replacement / notes |
|---|---|---|
| `webpack.common.js` | **delete** | Shared config now lives in `aem.config.mjs`. |
| `webpack.dev.js` | **delete** | `aem-build --mode dev` (mode baselines: no minify, inline sourcemap). |
| `webpack.prod.js` | **delete** | `aem-build --mode prod` (mode baselines: esbuild minify, no sourcemap). |
| `clientlib.config.js` | **delete** | Clientlibs declared in `aem.config.mjs`; descriptors emitted by `@aemvite/vite-plugin-aem-clientlib`. |
| `.babelrc` | **delete** | esbuild transpiles modern JS/TS directly; no Babel step. |
| `.eslintrc.js` | **delete** | Build-time lint removed. Add ESLint back later as a standalone script if you want; it no longer participates in the build. |
| `.eslintignore` | **delete** | Same as above. |
| `tsconfig.json` | **keep** | Vite/esbuild and your IDE still consume it. |
| `assembly.xml` | **keep** | Maven assembly is unchanged. |
| `pom.xml` | **keep** | `frontend-maven-plugin` still runs `npm run prod` / `npm run dev` — only the script targets change. |
| `package.json` | **edit** | Rewrite `scripts`, `devDependencies` (see step 6 and 7). |
| `package-lock.json` | **regenerate** | Run `rm package-lock.json && npm install` after editing `package.json`. |
| `src/main/webpack/site/main.ts` | **edit** | Swap `glob-import-loader`-style imports for Vite-native `import.meta.glob` (see step 8). |
| `src/main/webpack/**/*.scss` | **keep** | Same Sass authoring; SCSS globs (`@import '...glob/**/*'`) are handled by `@aemvite/vite-plugin-glob`. |
| `src/main/webpack/static/index.html` | optional | Used only by `vite` standalone dev server (`npm start`). Keep if you want a dev server, delete otherwise. |
| `src/main/webpack/resources/` | **keep** | `@aemvite/vite-plugin-aem-resources` copies it into `clientlib-site/resources/`. Trees with only `.gitkeep` placeholders are no-ops (no empty `resources/` folder is emitted). |

Files that are **added** during the migration:

| New file | Purpose |
|---|---|
| `aem.config.mjs` | Declarative list of clientlibs (replaces `clientlib.config.js` + webpack entries). |
| `vite.config.mjs` (optional) | Standalone Vite dev server, only needed if you want `npm start`. |

---

## 4. The OOTB before-state — verbatim

Captured from `git show 126d04c^:aemvite/ui.frontend/package.json`. Your
archetype copy will look essentially identical (version pins may vary).

```jsonc
// BEFORE: aemvite/ui.frontend/package.json @ 126d04c^
{
  "name": "aem-maven-archetype",
  "version": "1.0.0",
  "description": "Generates an AEM Frontend project with Webpack",
  "private": true,
  "main": "src/main/webpack/site/main.ts",
  "scripts": {
    "dev":        "webpack --env dev --config ./webpack.dev.js && clientlib --verbose",
    "prod":       "webpack --config ./webpack.prod.js && clientlib --verbose",
    "start":      "webpack-dev-server --open --config ./webpack.dev.js",
    "sync":       "aemsync -d -p ../ui.apps/src/main/content",
    "chokidar":   "chokidar -c \"clientlib\" ./dist",
    "aemsyncro":  "aemsync -w ../ui.apps/src/main/content",
    "watch":      "npm-run-all --parallel start chokidar aemsyncro"
  },
  "devDependencies": {
    "@babel/core":                         "^7.0.0",
    "@babel/plugin-proposal-class-properties":   "^7.3.3",
    "@babel/plugin-proposal-object-rest-spread": "^7.3.2",
    "@typescript-eslint/eslint-plugin":    "^5.7.0",
    "@typescript-eslint/parser":           "^5.7.0",
    "acorn":                               "^6.1.0",
    "aem-clientlib-generator":             "^1.8.0",
    "aemsync":                             "^4.0.1",
    "autoprefixer":                        "^9.2.1",
    "browserslist":                        "^4.2.1",
    "chokidar-cli":                        "^3.0.0",
    "clean-webpack-plugin":                "^3.0.0",
    "copy-webpack-plugin":                 "^10.1.0",
    "css-loader":                          "^6.5.1",
    "css-minimizer-webpack-plugin":        "^3.2.0",
    "cssnano":                             "^5.0.12",
    "eslint":                              "^8.4.1",
    "eslint-webpack-plugin":               "^3.1.1",
    "glob-import-loader":                  "^1.2.0",
    "html-webpack-plugin":                 "^5.5.0",
    "mini-css-extract-plugin":             "^2.4.5",
    "postcss":                             "^8.2.15",
    "postcss-loader":                      "^3.0.0",
    "sass":                                "^1.45.0",
    "sass-loader":                         "^12.4.0",
    "source-map-loader":                   "^0.2.4",
    "style-loader":                        "^0.14.1",
    "terser-webpack-plugin":               "^5.2.5",
    "ts-loader":                           "^9.2.6",
    "tsconfig-paths-webpack-plugin":       "^3.2.0",
    "typescript":                          "^4.8.2",
    "webpack":                             "^5.76.0",
    "webpack-cli":                         "^4.9.1",
    "webpack-dev-server":                  "^4.6.0",
    "webpack-merge":                       "^5.8.0"
  }
}
```

And the OOTB `pom.xml` wiring (excerpt — see
[`aemvite/ui.frontend/pom.xml`](./aemvite/ui.frontend/pom.xml) for the
unchanged-by-migration file):

```xml
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <executions>
    <execution>
      <id>npm run prod</id>
      <phase>generate-resources</phase>
      <goals><goal>npm</goal></goals>
      <configuration><arguments>run prod</arguments></configuration>
    </execution>
  </executions>
</plugin>
<!-- and, under <profile id="fedDev">, the same plugin running `run dev` -->
```

Maven only knows `npm run prod` / `npm run dev`. As long as those scripts
exist in `package.json`, Maven does not care which JS toolchain runs inside.

---

## 5. Step-by-step migration

Run every command from inside `ui.frontend/` (the directory that owns
`package.json`).

### 5.1. Uninstall the webpack stack

Take the exact webpack/Babel/PostCSS/ESLint/clientlib-generator/etc. deps from
the OOTB `package.json` above and drop them in one shot:

```sh
npm uninstall \
  @babel/core @babel/plugin-proposal-class-properties @babel/plugin-proposal-object-rest-spread \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  acorn aem-clientlib-generator autoprefixer browserslist \
  chokidar-cli clean-webpack-plugin copy-webpack-plugin \
  css-loader css-minimizer-webpack-plugin cssnano \
  eslint eslint-webpack-plugin glob-import-loader \
  html-webpack-plugin mini-css-extract-plugin \
  postcss postcss-loader \
  sass-loader source-map-loader style-loader \
  terser-webpack-plugin ts-loader tsconfig-paths-webpack-plugin \
  webpack webpack-cli webpack-dev-server webpack-merge
```

Keep `typescript` and `sass` if you still use them — they are independent of
the build toolchain. (The archetype's `sass` pin was `^1.45.0`; bumping to a
recent `^1.77.0` or newer is recommended for Vite 8 / modern Sass APIs but
not required.)

> **Note on `aemsync`:** the archetype ships `aemsync@^4.0.1` for its legacy
> watch/sync scripts. The new `@aemvite` build does **not** depend on it, so
> it is optional — keep it (and the related `sync` / `watch` scripts) only if
> you want to retain `aemsync`-driven live sync into AEM, otherwise drop it
> together with the other webpack-era tooling. The reference consumer in this
> repo no longer ships it.

### 5.2. Install the `@aemvite` toolchain

```sh
# Single entry point — pulls the three plugin packages
# (vite-plugin-aem-clientlib, vite-plugin-glob, vite-plugin-aem-resources)
# in transitively. `@aemvite/aem-config` also declares `esbuild` as a peer
# dependency (range ^0.27.0 || ^0.28.0), so npm 7+ and pnpm 8+ auto-install
# it. Yarn classic users must add it manually:
#   npm install --save-dev esbuild@^0.28.0
npm install --save-dev @aemvite/aem-config

# Required peer that you DO have to declare yourself.
npm install --save-dev vite@^8

# Only if any clientlib entry imports .scss/.sass. Plain CSS does not need it.
npm install --save-dev sass

# Optional: keep vitest if you had tests, or add it now.
npm install --save-dev vitest
```

The final `devDependencies` block of a published-package consumer ends up
looking like this:

```jsonc
// AFTER: ui.frontend/package.json (recommended adopter shape — registry installs)
{
  "type": "module",
  "scripts": {
    "dev":  "aem-build --mode dev  --config aem.config.mjs",
    "prod": "aem-build --mode prod --config aem.config.mjs",
    "test": "vitest run"
  },
  "devDependencies": {
    "@aemvite/aem-config": "^0.5.0",
    "sass":                "^1.77.0",
    "vite":                "^8.1.0",
    "vitest":              "^4.1.9"
    // `esbuild` is auto-installed as a peer dep of @aemvite/aem-config
    // (npm 7+ / pnpm 8+). Add it explicitly only on yarn classic.
    // Optional extras (NOT required by @aemvite):
    //   "aemsync": "^5.2.1"   — only if you want aemsync-driven sync/watch
  }
}
```

> **What about the reference repo's `package.json`?** The
> [`aemvite/ui.frontend/package.json`](./aemvite/ui.frontend/package.json) in
> this monorepo `file:`-links the four `@aemvite/*` packages and does not
> declare `esbuild` itself — npm hoists it from the `@aemvite/aem-config` peer
> dependency. It also does not ship `aemsync`.

> **Important:** add `"type": "module"` to `package.json`. The `aem-build`
> CLI loads `aem.config.mjs` as native ESM and your config likely uses
> `import` syntax. Without `"type": "module"` Node treats nearby `.js` files
> as CommonJS, which can confuse tooling.

### 5.3. Create `aem.config.mjs`

This file replaces `clientlib.config.js` + webpack entry definitions. It is
the one place where every clientlib is declared.

Mirror the OOTB layout (two clientlibs: a descriptor-only `dependencies`
umbrella and a `site` clientlib whose entry is `src/main/webpack/site/main.ts`):

```js
// aem.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineAemConfig } from '@aemvite/aem-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build options are layered: mode baseline → global `build` → per-clientlib
// `build`. With no overrides, production resolves to esbuild minify (JS+CSS)
// and no sourcemap — matching the legacy webpack output and the captured
// golden descriptors.
export default defineAemConfig({
  // Same path the archetype's clientlib.config.js used.
  clientLibRoot: path.resolve(
    __dirname,
    '../ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs',
  ),

  // Optional project-wide build overrides. Per-clientlib `build` wins.
  build: {
    target: 'es2025',
  },

  clientlibs: [
    {
      // Descriptor-only clientlib (no JS/CSS).
      name: 'dependencies',
      entry: '',
      categories: ['<project>.dependencies'],
    },
    {
      name: 'site',
      entry: 'src/main/webpack/site/main.ts',     // produces site.js (+ site.css)
      categories: ['<project>.site'],
      dependencies: ['<project>.dependencies'],   // omitted from XML when empty
      resources: ['src/main/webpack/resources'],  // copied to resources/
      // Per-clientlib override (optional). Without this block, the mode
      // baseline applies: prod = minify on / sourcemap off.
      build: {
        minify: { js: true, css: true },
        sourcemap: false,
      },
    },
  ],
});
```

Replace `<project>` with your real project slug. The reference repo uses
`aemvite` — see [`aem.config.mjs`](./aemvite/ui.frontend/aem.config.mjs).

For the full field reference (`allowProxy`, `embed`, `serializationFormat`,
custom `cssProcessor` / `jsProcessor`, etc.), see the
[`@aemvite/aem-config` README](./packages/aem-config#config-shape).

### 5.4. Replace the npm scripts

Old:

```jsonc
{
  "scripts": {
    "dev":  "webpack --env dev --config ./webpack.dev.js && clientlib --verbose",
    "prod": "webpack --config ./webpack.prod.js && clientlib --verbose",
    "start":"webpack-dev-server --open --config ./webpack.dev.js"
  }
}
```

New:

```jsonc
{
  "scripts": {
    "dev":   "aem-build --mode dev  --config aem.config.mjs",
    "prod":  "aem-build --mode prod --config aem.config.mjs",
    "start": "vite",
    "test":  "vitest run"
  }
}
```

- `aem-build --mode dev` ↔ dev baselines (no minify, inline sourcemap).
- `aem-build --mode prod` ↔ prod baselines (esbuild minify on, no sourcemap).
- The CLI also accepts `--mode development` / `--mode production` and a
  `--out-dir` flag (staging dir, default `./dist`). See
  [README → "Drive the build with the `aem-build` CLI"](./README.md#4-drive-the-build-with-the-aem-build-cli).
- The `start` script is **optional** — only define it if you actually run a
  Vite dev server during development. The reference repo defines `dev` /
  `prod` / `test` only; `vite.config.mjs` exists for `vite` invocations but
  no script wires it.

If you keep `aemsync`-driven sync/watch from the archetype:

```jsonc
"sync":  "aemsync -d -p ../ui.apps/src/main/content",
"watch": "aemsync -w ../ui.apps/src/main/content"
```

(The archetype's split `chokidar` + `aemsyncro` + `npm-run-all` watch is no
longer needed — the new build does not require a separate `clientlib`
re-run; `aem-build --mode dev` writes descriptors directly. If you want a
file-watching mode, use `aemsync -w` against `ui.apps/`.)

### 5.5. Update source entries

The archetype's `src/main/webpack/site/main.ts` used
`glob-import-loader` syntax. Replace it with Vite-native `import.meta.glob`:

```ts
// src/main/webpack/site/main.ts
import './main.scss';

// Eagerly evaluate every sibling and component module for side-effects.
// Vite's import.meta.glob replaces webpack's glob-import-loader (JS side).
// import.meta.glob does not include the calling module itself.
import.meta.glob('./**/*.js',         { eager: true });
import.meta.glob('./**/*.ts',         { eager: true });
import.meta.glob('../components/**/*.js', { eager: true });
```

**SCSS globs do not change.** `@aemvite/vite-plugin-glob` rewrites
`@import` / `@use` / `@forward` glob specifiers before Sass and esbuild see
them. The archetype's `main.scss` works as-is:

```scss
// src/main/webpack/site/main.scss — unchanged
@import 'variables';
@import 'base';
@import '../components/**/*.scss';   // expanded by @aemvite/vite-plugin-glob
@import './styles/*.scss';           // expanded too
```

Non-glob `@import 'variables';` is preserved verbatim — Sass resolves it.

### 5.6. `resources/` handling

The archetype copied everything under `src/main/webpack/resources/` (fonts,
images, etc.) into `dist/clientlib-site/` via `copy-webpack-plugin`. In the
new build, the per-clientlib `resources: ['src/main/webpack/resources']`
field in `aem.config.mjs` tells `@aemvite/vite-plugin-aem-resources` to copy
the tree into `clientlib-site/resources/`.

If the tree contains only `.gitkeep` placeholders, the plugin is a no-op —
no empty `resources/` directory is emitted, which keeps descriptors
byte-identical to the archetype's historical output. Add at least one real
file before you expect a `resources/` folder to appear.

See the
[`@aemvite/vite-plugin-aem-resources` README](./packages/vite-plugin-aem-resources#notes--caveats)
for the exact rules.

### 5.7. Maven stays the same

Open `ui.frontend/pom.xml` and confirm that `frontend-maven-plugin` is still
running `npm run prod` (and `npm run dev` under the `fedDev` profile). The
archetype's wiring is already correct:

```xml
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <executions>
    <execution>
      <id>npm run prod</id>
      <phase>generate-resources</phase>
      <goals><goal>npm</goal></goals>
      <configuration><arguments>run prod</arguments></configuration>
    </execution>
  </executions>
</plugin>
```

The `<execution>` wiring stays untouched. **But the bundled Node version
almost certainly needs a bump** — the AEM Maven archetype historically pins
`v16.x` (e.g. `v16.17.0` with `npm@8.15.0`), and Vite 8 refuses to install
on anything older than `^20.19.0 || >=22.12.0`. Find the
`frontend-maven-plugin` `<configuration>` block (usually in the **parent
`pom.xml`** under `<pluginManagement>`, not in `ui.frontend/pom.xml`) and
update it:

```diff
 <plugin>
   <groupId>com.github.eirslett</groupId>
   <artifactId>frontend-maven-plugin</artifactId>
   <configuration>
-    <nodeVersion>v16.17.0</nodeVersion>
-    <npmVersion>8.15.0</npmVersion>
+    <nodeVersion>v22.12.0</nodeVersion>
+    <npmVersion>10.9.0</npmVersion>
   </configuration>
```

The reference repo pins `v22.12.0` / `10.9.0`. Once changed, delete the
locally cached `ui.frontend/node/` directory (if present) so the new Node
gets downloaded on the next Maven build.

Sanity check:

```sh
mvn -f ui.frontend/pom.xml -P fedDev generate-resources
```

This should resolve `npm run dev` → `aem-build --mode dev …` → byte-identical
clientlib descriptors written under `ui.apps/.../clientlibs/`.

### 5.8. Delete the now-unused config files

```sh
rm -f webpack.common.js webpack.dev.js webpack.prod.js \
      clientlib.config.js \
      .babelrc \
      .eslintrc.js .eslintignore
```

Leave `tsconfig.json` in place — Vite, esbuild, and your IDE all read it.

If you previously had a separate `postcss.config.*` / `.postcssrc*`, delete
that too. (The OOTB archetype keeps PostCSS config inline in
`webpack.common.js`, so there's nothing extra to remove there.)

### 5.9. Clean install + first build

```sh
rm -rf node_modules package-lock.json
npm install
npm run prod
```

If `npm run prod` produces clientlib descriptors under
`ui.apps/.../clientlibs/clientlib-{dependencies,site}/`, you are done with
the migration. Move on to the verification step below.

---

## 6. Verification — byte-identical descriptors

The contract of `@aemvite/vite-plugin-aem-clientlib` is that
`.content.xml`, `js.txt`, and `css.txt` are byte-identical to the archetype's
historical output (asserted with `Buffer.equals()` against a captured golden
fixture in the plugin's own tests). To verify this against **your** project
before deleting the old build, capture a golden reference first.

1. On the pre-migration branch:

   ```sh
   npm run prod
   cp -R ../ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs \
         /tmp/golden-clientlibs
   ```

2. Switch to the migration branch and run the new build:

   ```sh
   npm run prod
   ```

3. Diff structure + per-file byte equality:

   ```sh
   diff -r /tmp/golden-clientlibs \
           ../ui.apps/src/main/content/jcr_root/apps/<project>/clientlibs

   shasum /tmp/golden-clientlibs/clientlib-site/.content.xml \
          ../ui.apps/.../clientlibs/clientlib-site/.content.xml
   shasum /tmp/golden-clientlibs/clientlib-site/js.txt  ../ui.apps/.../clientlib-site/js.txt
   shasum /tmp/golden-clientlibs/clientlib-site/css.txt ../ui.apps/.../clientlib-site/css.txt
   ```

   `.content.xml`, `js.txt`, and `css.txt` must hash identically.
   **JS/CSS bundle content is NOT asserted byte-identical** — esbuild and
   webpack produce different bytes for the same source. Only the descriptors
   and the on-disk folder layout are byte-identical, which is exactly the
   surface that dispatcher invalidation paths and Cloud Manager packagers
   care about.

4. Repeat with `npm run dev` — descriptors are mode-independent, so both
   builds must produce the same descriptor bytes.

This is also why the migration is safe for dispatcher / Cloud Manager / cache
tooling: nothing downstream sees a changed URL or a changed descriptor file.
See [README → "Byte-identical descriptor guarantee"](./README.md#byte-identical-descriptor-guarantee)
for the rendering rules locked by the emitter.

---

## 7. Troubleshooting

- **`Error: Cannot find package 'esbuild'`** during `npm run prod`. `esbuild`
  is declared as a peer dependency of `@aemvite/aem-config` (range
  `^0.27.0 || ^0.28.0`) and is auto-installed by npm 7+ and pnpm 8+. If your
  package manager doesn't auto-install peers (e.g. yarn classic, or pnpm
  with `auto-install-peers=false`), add it manually:

  ```sh
  npm install --save-dev esbuild@^0.28.0
  ```

- **`Error: Cannot find package 'vite'`** during `npm run prod`. Three of
  the four `@aemvite/*` packages declare `vite ^7 || ^8` as a peer.
  Install it explicitly:

  ```sh
  npm install --save-dev vite@^8
  ```

- **`Unknown --mode 'release'` (or similar) from `aem-build`.** Only `dev`,
  `prod`, `development`, and `production` are accepted by the CLI.

- **`SyntaxError: ... does not provide an export named 'styleText'`** or
  any Node engine warning (`EBADENGINE`). Your Node is too old for Vite 8.
  Bump to `^20.19.0 || >=22.12.0`. In a Maven build, set the
  `<nodeVersion>` in `frontend-maven-plugin` (or the parent pom that
  configures it) accordingly — Cloud Manager picks the Node version from
  there.

- **pnpm vs npm gotcha.** If your environment has Corepack and the parent
  repo declares `"packageManager": "pnpm@…"`, plain `npm` invocations can be
  silently rerouted through `pnpm`, and pnpm ignores npm's `-w` form. If
  scripts misbehave for no apparent reason, prefix with `command npm` (e.g.
  `command npm install`) or `cd` into `ui.frontend/` first. The reference
  monorepo notes this in its
  [`CLAUDE.md`](./CLAUDE.md#critical-gotchas).

- **Clean-install advice.** If you see weird resolution errors after editing
  `package.json`, wipe and re-install:

  ```sh
  rm -rf node_modules package-lock.json
  npm install
  ```

- **`clientlib-site/resources/` directory unexpectedly missing.** This is by
  design when the source `resources/` tree contains only `.gitkeep`
  placeholders. Add a real file and re-run. See the
  [`@aemvite/vite-plugin-aem-resources` README](./packages/vite-plugin-aem-resources#notes--caveats).

- **CSS glob ordering changed.** `@aemvite/vite-plugin-glob` sorts matched
  files lexicographically by default; pass a custom `sort` comparator to
  override. Non-glob `@import 'variables';` is preserved verbatim, so Sass
  errors surface as Sass errors (not silent drops).

- **Maven works locally, fails in CI.** Confirm CI Node satisfies
  `^20.19.0 || >=22.12.0` and that `frontend-maven-plugin`'s pinned Node
  version does too.

---

## 8. Reference — every package's README

Once the migration is done, the per-package READMEs are the source of truth
for every exposed API:

- [`@aemvite/aem-config`](./packages/aem-config) — `defineAemConfig`,
  `loadAemConfig`, `mergeDefaults`, `resolveBuildOptions`, `buildClientlibs`,
  the full `AemConfig` / `AemClientlib` / `BuildOptions` field tables, and
  the `aem-build` CLI flags.
- [`@aemvite/vite-plugin-aem-clientlib`](./packages/vite-plugin-aem-clientlib) —
  `emitClientlib` / `emitClientlibs` / `renderContentXml` / `renderJsTxt` /
  `renderCssTxt` / `classifyFile` / `aemClientlibPlugin`, plus the
  byte-identical contract details.
- [`@aemvite/vite-plugin-glob`](./packages/vite-plugin-glob) — `aemViteGlob`
  plugin options, the pure `expandStyleGlobs` /
  `expandStyleGlobsWithResult` helpers, and the `extensions` + `sort` knobs.
- [`@aemvite/vite-plugin-aem-resources`](./packages/vite-plugin-aem-resources) —
  `aemResources` options (single vs multiple entries, absolute paths) and
  the `.gitkeep`-only no-op behavior.

For the higher-level adoption walkthrough, see
[README → "Adopt @aemvite in your AEM project"](./README.md#adopt-aemvite-in-your-aem-project).
