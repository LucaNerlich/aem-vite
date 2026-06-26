# ui.frontend

Vite-based AEM `ui.frontend` module. Replaces the legacy webpack + Babel +
PostCSS + `aem-clientlib-generator` stack with **Vite + esbuild + Sass** while
emitting clientlib descriptors (`.content.xml`, `js.txt`, `css.txt`) that are
byte-identical to the AEM archetype's historical output.

This module is the **reference consumer** of the
[`@aemvite/*`](https://github.com/LucaNerlich/aem-vite) toolchain. It uses
`file:` links to the local monorepo packages so the toolchain can be developed
and tested end-to-end without publishing to npm first. A real AEM project would
install only `@aemvite/aem-config` from the registry and get the three plugin
packages transitively.

## Prerequisites

- **Node.js** `^20.19.0 || >=22.12.0` (required by Vite 8 + rolldown)
- **npm** (or pnpm / yarn)

When building via Maven, `frontend-maven-plugin` downloads and caches the
right Node version automatically (see `pom.xml`).

## Install

```sh
npm ci
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Build all clientlibs in development mode — no minification, inline sourcemaps. |
| `npm run prod` | Build all clientlibs in production mode — esbuild minification (JS + CSS), no sourcemaps. Output is byte-identical to the golden reference. |
| `npm test` | Run unit tests with Vitest. |

Both `dev` and `prod` call the `aem-build` CLI that ships with
`@aemvite/aem-config` (installed via `node_modules/.bin/aem-build`). No
custom build script exists in this module — configuration lives entirely in
`aem.config.mjs`.

## Configuration

`aem.config.mjs` is the single source of truth for what clientlibs are built
and where they land. It uses `defineAemConfig()` from `@aemvite/aem-config`:

```
aem.config.mjs
  └── defineAemConfig({ clientLibRoot, clientlibs: [...] })
```

The config defines two clientlibs:

| Clientlib | Type | Output |
|---|---|---|
| `clientlib-dependencies` | Descriptor-only (`entry: ''`) | `.content.xml`, `js.txt`, `css.txt` only |
| `clientlib-site` | JS + CSS + resources | `js/site.js`, `css/site.css`, `resources/` |

## Source layout

```
src/main/webpack/
├── components/         # Component SCSS (glob-imported in main.scss)
├── resources/          # Copied to clientlib-site/resources/
└── site/
    ├── main.ts         # JS entry → site.js
    ├── main.scss       # CSS entry (imported from main.ts) → site.css
    ├── _variables.scss
    └── _base.scss
```

**JS globs:** use Vite's native `import.meta.glob` in `main.ts` to eagerly
load component modules — no webpack loaders needed.

**SCSS globs:** `@aemvite/vite-plugin-glob` expands `@import` glob patterns
(e.g. `@import '../components/**/*.scss'`) before Sass sees them.
Non-glob imports like `@import 'variables'` are passed through verbatim.

## Output

Built clientlibs land directly in:

```
../ui.apps/src/main/content/jcr_root/apps/aemvite/clientlibs/
├── clientlib-dependencies/
│   ├── .content.xml
│   ├── js.txt
│   └── css.txt
└── clientlib-site/
    ├── .content.xml
    ├── js.txt
    ├── css.txt
    ├── js/site.js
    ├── css/site.css
    └── resources/       # only present when real files exist
```

Descriptor files are byte-identical to what the AEM archetype's
`aem-clientlib-generator` produced for the same clientlib definitions, so
dispatcher invalidation, Cloud Manager packaging, and downstream caches
require no changes.

## Maven integration

`pom.xml` wires `frontend-maven-plugin` to run `npm ci` then `npm run prod`
during the `generate-resources` phase. The `fedDev` profile runs `npm run dev`
instead. No pom changes are needed when the underlying toolchain changes — only
the npm scripts behind `run prod` / `run dev` swap.

```sh
# Run the Maven frontend build locally
mvn -f pom.xml -P fedDev generate-resources
```

## Advanced: plugins and Vite config passthrough

`aem.config.mjs` accepts optional `plugins` and `vite` fields (global and
per-clientlib) to inject Vite plugins or deep config overrides without
writing a custom build script. See the
[`@aemvite/aem-config` README](../../packages/aem-config/README.md#plugin-and-vite-config-passthrough)
for examples.
