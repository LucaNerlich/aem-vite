# @aemvite/aem-config

> Typed config helper, loader, and Vite build orchestrator for AEM
> `ui.frontend` clientlibs.

`@aemvite/aem-config` is the entry point of the [`@aemvite/*`](https://github.com/LucaNerlich/aem-vite)
toolchain. It lets you declare one or more AEM clientlibs in a typed
`aem.config.ts`, then drives one Vite library build per entry into a shared
`outDir` and hands off to
[`@aemvite/vite-plugin-aem-clientlib`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/vite-plugin-aem-clientlib)
to emit byte-identical `.content.xml` / `js.txt` / `css.txt` descriptors.

It replaces two legacy pieces in an AEM `ui.frontend` Maven module: the
hand-maintained split webpack entry configuration **and** the
`aem-clientlib-generator` `clientlib.config.js`.

## Install

```sh
# Vite 8 makes `esbuild` an OPTIONAL peer dependency — install it explicitly
# alongside `vite`, otherwise `npm run prod` fails with `Cannot find package 'esbuild'`.
npm i -D @aemvite/aem-config vite esbuild
# Sass is only needed if your entries import .scss/.sass
npm i -D sass
```

- **Peer dependency:** `vite` `^7 || ^8` (with Vite 8 also requires `esbuild` `^0.27.0 || ^0.28.0` — Vite declares it as an optional peer, so consumers must install it explicitly)
- **Engines:** Node `^20.19.0 || >=22.12.0`
- Depends on all three plugin packages — `@aemvite/vite-plugin-aem-clientlib`, `@aemvite/vite-plugin-glob`, `@aemvite/vite-plugin-aem-resources` — all installed automatically.

## What it does

- Lets you declare every clientlib as plain data (`name`, `entry`,
  `categories`, …) instead of hand-writing webpack entry blobs.
- Loads your `aem.config.ts` via Vite's bundled esbuild — no `jiti`, no
  pre-compile step.
- Resolves per-clientlib build options (`minify`, `sourcemap`, `target`) in
  three layers: mode baseline → global → per-clientlib.
- Runs one Vite library build per entry with `inlineDynamicImports: true`,
  automatically wiring `@aemvite/vite-plugin-glob` (SCSS/CSS glob expansion)
  and `@aemvite/vite-plugin-aem-resources` (resources copy). Descriptor-only
  clientlibs (`entry: ''`) skip the Vite build entirely but still emit their
  `.content.xml` / `js.txt` / `css.txt`.
- Names outputs after the clientlib (`<name>.js` / `<name>.css`) so the emitted
  `js.txt` / `css.txt` are byte-identical to the AEM archetype golden reference.
- Accepts optional `plugins` / `vite` passthrough in the config so advanced
  adopters never need to write a custom build script (see
  [Plugin and Vite config passthrough](#plugin-and-vite-config-passthrough)).
- Ships an `aem-build` CLI you can call from `npm` scripts (so Maven's
  `frontend-maven-plugin` stays unchanged). See
  [CLI: `aem-build`](#cli-aem-build) for where the binary comes from.

## Quick start

```ts
// aem.config.ts
import { defineAemConfig } from "@aemvite/aem-config";

export default defineAemConfig({
  clientLibRoot: "../ui.apps/src/main/content/jcr_root/apps/aemvite/clientlibs",
  clientlibs: [
    {
      name: "site",
      entry: "src/main.ts",
      categories: ["aemvite.site"],
      dependencies: ["aemvite.dependencies"],
    },
    {
      name: "dependencies",
      entry: "src/deps.ts",
      categories: ["aemvite.dependencies"],
    },
  ],
});
```

Run a build:

```sh
npx aem-build --mode production --config aem.config.ts
```

Wire it into `package.json`:

```json
{
  "scripts": {
    "dev": "aem-build --mode development",
    "prod": "aem-build --mode production"
  }
}
```

## Config shape

### `AemConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `clientLibRoot` | `string` | — | Output root for emitted `clientlib-<name>/` folders. Absolute or relative to the config file. |
| `clientlibs` | `AemClientlib[]` | — | One entry per clientlib folder. |
| `defaults` | `Partial<AemClientlib>` | `{}` | Per-clientlib defaults merged into every entry (per-clientlib values win). |
| `build` | `BuildOptions` | `{}` | Global build overrides; layered under per-clientlib `build` (see below). |
| `plugins` | `PluginOption \| PluginOption[]` | _(none)_ | Extra Vite plugins injected into **every** clientlib build (after the built-in glob + resources plugins). |
| `vite` | `UserConfig` | _(none)_ | Deep Vite config merged (via `mergeConfig`) into every clientlib build — runs after per-entry wiring and after `plugins`. |

### `AemClientlib`

| Field | Type | Default | Notes |
|---|---|---|---|
| `name` | `string` | — | Clientlib folder name (e.g. `"site"` → `clientlib-site`). |
| `entry` | `string` | — | Path to the entry source file (relative to the config dir or absolute). Empty string is allowed for descriptor-only clientlibs. |
| `categories` | `readonly string[]` | — | AEM `categories="[...]"`. Required, non-empty. |
| `dependencies` | `readonly string[]` | _(omitted)_ | AEM `dependencies="[...]"`. Omitted from `.content.xml` when empty/undefined. |
| `embed` | `readonly string[]` | _(none)_ | Embedded clientlib categories. |
| `resources` | `readonly string[]` | _(none)_ | Resource directories to copy into the clientlib's `resources/` folder. |
| `allowProxy` | `boolean` | `true` | `allowProxy="{Boolean}…"`. |
| `serializationFormat` | `"xml"` | `"xml"` | `.content.xml` serialization format. |
| `cssProcessor` | `readonly string[]` | `["default:none","min:none"]` | AEM CSS processor directives. |
| `jsProcessor` | `readonly string[]` | `["default:none","min:none"]` | AEM JS processor directives. |
| `build` | `BuildOptions` | `{}` | Per-clientlib build overrides; layered over `AemConfig.build`. |
| `plugins` | `PluginOption \| PluginOption[]` | _(inherits global)_ | Extra Vite plugins for this clientlib only (appended after the global `plugins`). |
| `vite` | `UserConfig` | _(inherits global)_ | Per-clientlib deep Vite config override (merged after the global `vite`). |

Array fields (`cssProcessor`, `jsProcessor`, `dependencies`, `embed`,
`categories`, `resources`) are replaced wholesale rather than concatenated when
defaults are merged.

## Multiple clientlibs

Every clientlib runs as its own Vite library build into the same `dist/`. The
first build clears the directory; subsequent builds accumulate. Each entry
inherits `defaults`, then its own values, then its own `build` overrides.

```ts
export default defineAemConfig({
  clientLibRoot: "../clientlibs",
  defaults: { allowProxy: true },
  clientlibs: [
    { name: "site", entry: "src/main.ts", categories: ["aemvite.site"] },
    { name: "admin", entry: "src/admin.ts", categories: ["aemvite.admin"] },
  ],
});
```

## Build options (`BuildOptions`)

```ts
type BuildOptions = {
  minify?: boolean | { js?: boolean; css?: boolean };
  sourcemap?: boolean | "inline" | "hidden";
  target?: string | string[];
};
```

### Resolution order

Lowest → highest precedence:

1. **Mode baseline**
   - `development`: `{ minify: false, sourcemap: "inline" }`
   - `production`: `{ minify: { js: true, css: true }, sourcemap: false }`
   - Default `target` = `"es2015"`.
2. **Global** `AemConfig.build` — applied to every clientlib.
3. **Per-clientlib** `AemClientlib.build` — wins over the global block.

`minify`: a boolean toggles both JS and CSS; the object form overrides a single
asset and lets the other fall through to the next layer. So in production,
`{ minify: { js: false } }` on a clientlib keeps CSS minification on.

`sourcemap` and `target` are simple overrides — the higher layer wins entirely.

### Global override

```ts
export default defineAemConfig({
  clientLibRoot: "../clientlibs",
  build: { sourcemap: "hidden", target: "es2020" },
  clientlibs: [
    { name: "site", entry: "src/main.ts", categories: ["aemvite.site"] },
  ],
});
```

### Per-clientlib override

```ts
export default defineAemConfig({
  clientLibRoot: "../clientlibs",
  build: { minify: true },
  clientlibs: [
    {
      name: "site",
      entry: "src/main.ts",
      categories: ["aemvite.site"],
      // CSS only — keep JS minified per the global block.
      build: { minify: { css: false }, sourcemap: "inline" },
    },
    {
      name: "admin",
      entry: "src/admin.ts",
      categories: ["aemvite.admin"],
      build: { target: ["es2018", "chrome70"] },
    },
  ],
});
```

## Backward compatibility

With no `build` set anywhere, resolved options match the mode baselines:

| Mode | JS minify | CSS minify | sourcemap | target |
|---|---|---|---|---|
| `development` | off | off | `"inline"` | `"es2015"` |
| `production` | on (esbuild) | on (esbuild) | off | `"es2015"` |

Emitted clientlib descriptors (`.content.xml`, `js.txt`, `css.txt`) are
unaffected by build options and remain byte-identical to the golden reference.

## API

All exports from `@aemvite/aem-config`:

### Functions

| Export | Signature | Effect |
|---|---|---|
| `defineAemConfig` | `(config: AemConfig) => AemConfig` | Typed identity helper for `aem.config.ts`. |
| `loadAemConfig` | `(path: string) => Promise<ResolvedAemConfig>` | Load a `.ts`/`.mts`/`.cts` config via Vite's bundled esbuild (`loadConfigFromFile`), or a `.mjs`/`.js` config via dynamic `import()`. Merges defaults before returning. |
| `mergeDefaults` | `(config: AemConfig) => ResolvedAemConfig` | Apply package + user `defaults` to every clientlib. |
| `resolveBuildOptions` | `(mode: BuildMode, global?: BuildOptions, perClientlib?: BuildOptions) => ResolvedBuildOptions` | Resolve the three-layer build options for a single clientlib. Exported for tooling and tests. |
| `buildClientlibs` | `(options: BuildClientlibsOptions) => Promise<{ config: ResolvedAemConfig; outDir: string }>` | Fully-orchestrated build: wires glob + resources plugins, runs one Vite library build per entry, names outputs after the clientlib, calls the clientlib emitter. Descriptor-only clientlibs skip the Vite build. |

### Constants

| Export | Type | Value |
|---|---|---|
| `defaults` | `Required<Pick<AemClientlib, "allowProxy" \| "serializationFormat" \| "cssProcessor" \| "jsProcessor">>` | Built-in per-clientlib defaults (see `AemClientlib` table). |
| `modeBaselines` | `Record<BuildMode, BuildOptions>` | `development`: `{ minify: false, sourcemap: "inline" }`. `production`: `{ minify: { js: true, css: true }, sourcemap: false }`. |
| `defaultTarget` | `string` | `"es2015"`. |

### Types

`AemConfig`, `AemClientlib`, `BuildOptions`, `BuildMode`, `BuildClientlibsOptions`,
`ProcessorList`, `ResolvedAemClientlib`, `ResolvedAemConfig`, `ResolvedBuildOptions`.

## CLI: `aem-build`

```
Usage: aem-build [options]

Options:
  --mode, -m  <dev|prod|development|production>   Build mode (default: production)
  --config, -c <path>                             Path to aem.config.ts
                                                  (default: ./aem.config.ts,
                                                   then .mts, .mjs, .js)
  --out-dir, -o <path>                            Staging directory
                                                  (default: ./dist)
  -h, --help                                      Show help
```

Both shorthand (`dev`/`prod`) and full (`development`/`production`) mode names
are accepted. The CLI exits with code `1` and prints the error stack on any
failure.

### Where does `aem-build` come from?

`@aemvite/aem-config/package.json` declares:

```json
{
  "bin": {
    "aem-build": "dist/cli.js"
  }
}
```

When you run `npm install`, npm creates a symlink
`node_modules/.bin/aem-build → ../aemvite/aem-config/dist/cli.js`. Scripts in
`package.json` are run with `node_modules/.bin` on the `PATH`, so `aem-build`
in an npm script just works:

```json
{
  "scripts": {
    "prod": "aem-build --mode prod --config aem.config.mjs"
  }
}
```

You can also call it directly with `npx aem-build ...` without installing
anything first.

## Plugin and Vite config passthrough

`@aemvite/aem-config` 0.2.0 added optional `plugins` and `vite` fields to
both `AemConfig` (global) and `AemClientlib` (per-clientlib). These let you
inject Vite plugins or deep config overrides without writing a custom build
script.

**When to use it:**
- Inject a framework plugin (e.g. React, Vue, Lit) for all clientlibs.
- Add `resolve.alias` entries so `@/` resolves to your `src/` root.
- Turn on `build.cssCodeSplit` for one specific clientlib.
- Use a custom transform plugin for a single entry.

**Resolution order** inside each Vite build:

1. Built-in `aemViteGlob()` (SCSS glob expansion — always first)
2. Built-in `aemResources(...)` (resources copy — when `resources` is set)
3. Global `config.plugins` (applied to every clientlib)
4. Per-clientlib `clientlib.plugins` (appended for that clientlib only)
5. Global `config.vite` merged via `mergeConfig`
6. Per-clientlib `clientlib.vite` merged via `mergeConfig`

### Global plugin example

```js
// aem.config.mjs
import { defineAemConfig } from '@aemvite/aem-config';
import myFrameworkPlugin from 'some-vite-plugin';

export default defineAemConfig({
  clientLibRoot: '../ui.apps/.../clientlibs',
  plugins: [myFrameworkPlugin()],          // runs for every clientlib
  clientlibs: [
    { name: 'site', entry: 'src/main.ts', categories: ['myproject.site'] },
    { name: 'admin', entry: 'src/admin.ts', categories: ['myproject.admin'] },
  ],
});
```

### Global Vite config override (e.g. aliases)

```js
export default defineAemConfig({
  clientLibRoot: '../ui.apps/.../clientlibs',
  vite: {
    resolve: {
      alias: { '@': '/src/main/webpack' },
    },
  },
  clientlibs: [ /* … */ ],
});
```

### Per-clientlib override

```js
export default defineAemConfig({
  clientLibRoot: '../ui.apps/.../clientlibs',
  plugins: [sharedPlugin()],               // injected into every clientlib
  clientlibs: [
    {
      name: 'site',
      entry: 'src/main.ts',
      categories: ['myproject.site'],
      // Override only for this clientlib — appended after sharedPlugin()
      plugins: [siteOnlyPlugin()],
      vite: { build: { cssCodeSplit: false } },
    },
    {
      name: 'admin',
      entry: 'src/admin.ts',
      categories: ['myproject.admin'],
      // no per-clientlib plugins — only sharedPlugin() runs here
    },
  ],
});
```

> `plugins` and `vite` are optional. If you don't need them, omit them — the
> build works identically to 0.1.x with no config changes required.

## Notes & caveats

- **Per-entry isolation:** every clientlib runs as its own `vite build()` with
  `inlineDynamicImports: true`, so code-splitting between clientlibs is by
  design impossible — each clientlib produces a single `.js` and (optional)
  `.css`. Share code via a dedicated `dependencies` clientlib instead.
- **`outDir` lifecycle:** `emptyOutDir: true` is set only for the first build;
  subsequent builds accumulate into the same `dist/`. Don't run two
  `buildClientlibs()` invocations against the same `outDir` in parallel.
- **`.ts` config loading:** uses Vite's `loadConfigFromFile`. Vite is imported
  lazily so tests that stub the loader don't pay the startup cost.
- **Descriptor parity:** build options never affect emitted descriptors —
  `.content.xml`, `js.txt`, and `css.txt` remain byte-identical to the golden
  reference regardless of mode, minify, or sourcemap settings.

## License

[MIT](./LICENSE) © Luca Nerlich

## Repository

<https://github.com/LucaNerlich/aem-vite> (this package lives in
[`packages/aem-config`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/aem-config)).
