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
- Depends on `@aemvite/vite-plugin-aem-clientlib` (installed automatically).

## What it does

- Lets you declare every clientlib as plain data (`name`, `entry`,
  `categories`, …) instead of hand-writing webpack entry blobs.
- Loads your `aem.config.ts` via Vite's bundled esbuild — no `jiti`, no
  pre-compile step.
- Resolves per-clientlib build options (`minify`, `sourcemap`, `target`) in
  three layers: mode baseline → global → per-clientlib.
- Runs one Vite library build per entry with `inlineDynamicImports: true`
  into a shared `outDir`, then triggers the clientlib descriptor emitter.
- Ships an `aem-build` CLI you can call from `npm` scripts (so Maven's
  `frontend-maven-plugin` stays unchanged).

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
| `loadAemConfig` | `(path: string) => Promise<ResolvedAemConfig>` | Load a `.ts`/`.mts`/`.cts` config via Vite's bundled esbuild (`loadConfigFromFile`), or a `.js`/`.mjs` config via dynamic `import()`. Merges defaults before returning. |
| `mergeDefaults` | `(config: AemConfig) => ResolvedAemConfig` | Apply package + user `defaults` to every clientlib. |
| `resolveBuildOptions` | `(mode: BuildMode, global?: BuildOptions, perClientlib?: BuildOptions) => ResolvedBuildOptions` | Resolve the three-layer build options for a single clientlib. Exported for tooling and tests. |
| `buildClientlibs` | `(options: BuildClientlibsOptions & { emitter?: ClientlibEmitter \| null }) => Promise<{ config: ResolvedAemConfig; outDir: string }>` | Run one Vite library build per entry into `outDir`, then invoke the clientlib emitter. Pass `emitter: null` to skip emission (e.g. in tests). |
| `resolveClientlibEmitter` | `() => Promise<ClientlibEmitter \| null>` | Optionally resolve the emitter from `@aemvite/vite-plugin-aem-clientlib`. Returns `null` if not installed. |

### Constants

| Export | Type | Value |
|---|---|---|
| `defaults` | `Required<Pick<AemClientlib, "allowProxy" \| "serializationFormat" \| "cssProcessor" \| "jsProcessor">>` | Built-in per-clientlib defaults (see `AemClientlib` table). |
| `modeBaselines` | `Record<BuildMode, BuildOptions>` | `development`: `{ minify: false, sourcemap: "inline" }`. `production`: `{ minify: { js: true, css: true }, sourcemap: false }`. |
| `defaultTarget` | `string` | `"es2015"`. |

### Types

`AemConfig`, `AemClientlib`, `BuildOptions`, `BuildMode`, `BuildClientlibsOptions`,
`ProcessorList`, `ResolvedAemClientlib`, `ResolvedAemConfig`,
`ResolvedBuildOptions`, `ClientlibEmitter`, `ClientlibEmitterInput`.

## CLI: `aem-build`

```
Usage: aem-build [options]

Options:
  --mode, -m  <dev|prod|development|production>   Build mode (default: production)
  --config, -c <path>                             Path to aem.config.ts
                                                  (default: ./aem.config.ts,
                                                   then .mts, then .js)
  --out-dir, -o <path>                            Output directory
                                                  (default: ./dist)
  -h, --help                                      Show help
```

Both shorthand (`dev`/`prod`) and full (`development`/`production`) mode names
are accepted. The CLI exits with code `1` and prints the error stack on any
failure.

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
