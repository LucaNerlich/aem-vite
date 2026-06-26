# @aemvite/vite-plugin-aem-clientlib

> Emit AEM clientlib descriptors (`.content.xml`, `js.txt`, `css.txt`) and lay
> out `js/` / `css/` / `resources/` — **byte-identical** to the AEM archetype
> output. Drop-in replacement for `aem-clientlib-generator`.

Part of the [`@aemvite/*`](https://github.com/LucaNerlich/aem-vite) toolchain.
This package contains the deterministic descriptor renderer + on-disk emitter.
It is invoked by the
[`@aemvite/aem-config`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/aem-config)
orchestrator, but can also be used directly (programmatically or as a Vite
plugin) when you need to wire clientlib output into a different build flow.

## Install

```sh
npm i -D @aemvite/vite-plugin-aem-clientlib
```

- **Engines:** Node `^20.19.0 || >=22.12.0`.
- **No declared peer dependency on Vite.** This package intentionally ships no
  `peerDependencies`. The renderer + `emitClientlib(s)` functions are pure
  Node and never `import` from `vite`. The optional `aemClientlibPlugin` is
  typed against a local `VitePluginLike` interface, so it slots into any
  Vite-compatible host without forcing a version constraint on consumers.
  Vite itself is needed by the wider `@aemvite/*` setup (it is a peer of
  `@aemvite/aem-config`, `@aemvite/vite-plugin-glob`, and
  `@aemvite/vite-plugin-aem-resources`), but **not** by this package on its
  own.

## What it does

- Renders an AEM clientlib `.content.xml` with locked attribute order
  (`categories → dependencies → cssProcessor → jsProcessor → allowProxy`),
  declared namespaces `xmlns:cq` + `xmlns:jcr`, omits `dependencies` when
  empty, and produces a trailing-newline-correct byte stream.
- Renders `js.txt` and `css.txt` in the `#base=<bucket>\n\n<file>\n…` format
  (no trailing newline).
- Lays out files under `js/`, `css/`, and `resources/` based on extension.
  Sub-folders are only created when at least one file lands in them, matching
  the archetype (no empty `resources/` dir).
- Wipes the target `clientlib-<name>/` folder before writing for clean,
  deterministic output.
- Asserts **byte-for-byte equality** against a captured golden fixture via
  `Buffer.equals()` in its unit test suite.

## Usage

### Programmatic (recommended)

```ts
import {
  emitClientlibs,
  type ClientlibDefinition,
  type SourceFile,
} from "@aemvite/vite-plugin-aem-clientlib";

const clientlibs: Array<{
  clientlib: ClientlibDefinition;
  files?: SourceFile[];
}> = [
  {
    clientlib: {
      name: "site",
      categories: ["aemvite.site"],
      dependencies: ["aemvite.dependencies"],
    },
    files: [
      { source: "/abs/path/dist/site/site.js",  basename: "site.js" },
      { source: "/abs/path/dist/site/site.css", basename: "site.css" },
    ],
  },
  {
    clientlib: { name: "dependencies", categories: ["aemvite.dependencies"] },
  },
];

await emitClientlibs("/abs/path/to/clientlib-root", clientlibs);
// Writes: <root>/clientlib-site/{.content.xml,js.txt,css.txt,js/site.js,css/site.css}
//         <root>/clientlib-dependencies/{.content.xml,js.txt,css.txt}
```

### Vite plugin

`aemClientlibPlugin` runs the same emitter at `closeBundle`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { aemClientlibPlugin } from "@aemvite/vite-plugin-aem-clientlib";

export default defineConfig({
  plugins: [
    aemClientlibPlugin({
      outDir: "/abs/path/to/clientlib-root",
      clientlibs: [
        {
          clientlib: { name: "site", categories: ["aemvite.site"] },
          files: [{ source: "dist/site.js", basename: "site.js" }],
        },
      ],
    }),
  ],
});
```

> In practice, you don't wire this plugin by hand — `@aemvite/aem-config`
> orchestrates per-entry Vite builds and calls `emitClientlibs` for you. Reach
> for the direct API when integrating into a custom build script.

### Just the renderers

The descriptor renderers are pure and side-effect free:

```ts
import {
  renderContentXml,
  renderJsTxt,
  renderCssTxt,
} from "@aemvite/vite-plugin-aem-clientlib";

const xml = renderContentXml({
  name: "site",
  categories: ["aemvite.site"],
  dependencies: ["aemvite.dependencies"],
});
const js = renderJsTxt(["site.js"]);   // "#base=js\n\nsite.js"
const css = renderCssTxt([]);          // "#base=css\n\n"
```

## API reference

### Functions

| Export | Signature | Effect |
|---|---|---|
| `renderContentXml` | `(def: ClientlibDefinition) => string` | Render `.content.xml` byte-for-byte. Throws when `categories` is empty. |
| `renderTxt` | `(base: string, files: readonly string[]) => string` | Render a generic `#base=<base>\n\n<file>\n…` index (no trailing newline). |
| `renderJsTxt` | `(files: readonly string[]) => string` | Shortcut for `renderTxt("js", files)`. |
| `renderCssTxt` | `(files: readonly string[]) => string` | Shortcut for `renderTxt("css", files)`. |
| `classifyFile` | `(filename: string) => "js" \| "css" \| "resources"` | Case-insensitive extension-based bucket classifier. `*.js.map` / `*.css.map` route to `resources` (see Notes & caveats). |
| `emitClientlib` | `(options: EmitClientlibOptions) => Promise<EmitResult>` | Emit a single `clientlib-<name>/` folder to disk. Wipes the target directory first. |
| `emitClientlibs` | `(outDir: string, clientlibs: Array<{ clientlib, files? }>) => Promise<EmitResult[]>` | Emit multiple clientlibs into the same `outDir`. |
| `aemClientlibPlugin` | `(options: AemClientlibPluginOptions) => VitePluginLike` | Vite plugin (`apply: "build"`) that runs `emitClientlibs` at `closeBundle`. |

### Types

`ClientlibDefinition`, `SourceFile`, `FileBucket`,
`EmitClientlibOptions`, `EmitResult`, `AemClientlibPluginOptions`,
`VitePluginLike`. See `dist/*.d.ts` for full signatures.

#### `ClientlibDefinition`

| Field | Type | Default | Notes |
|---|---|---|---|
| `name` | `string` | — | Bare name; the folder will be `clientlib-<name>`. |
| `categories` | `string[]` | — | Required, non-empty. |
| `dependencies` | `string[]` | _(omitted)_ | Attribute is left out of `.content.xml` when undefined or empty. |
| `cssProcessor` | `string[]` | `["default:none","min:none"]` | |
| `jsProcessor` | `string[]` | `["default:none","min:none"]` | |
| `allowProxy` | `boolean` | `true` | Rendered as `allowProxy="{Boolean}…"`. |

#### `SourceFile`

| Field | Type | Notes |
|---|---|---|
| `source` | `string` | Absolute or process-relative path to the source file on disk. |
| `basename` | `string` | Destination basename inside the clientlib bucket (`js/`, `css/`, or `resources/`). |

#### `EmitResult`

| Field | Type | Notes |
|---|---|---|
| `clientlibDir` | `string` | Path of the emitted `clientlib-<name>` folder. |
| `jsFiles` | `string[]` | Files placed under `js/`, in `js.txt` order. |
| `cssFiles` | `string[]` | Files placed under `css/`, in `css.txt` order. |
| `resourceFiles` | `string[]` | Files placed under `resources/`. |

## Notes & caveats

- **Byte-identical guarantee.** The renderer is locked to the AEM archetype's
  exact attribute order, namespace declarations, whitespace, and trailing
  newlines. Unit tests assert `Buffer.equals()` against a captured golden
  fixture. **Do not** change `DEFAULT_CSS_PROCESSOR`, `DEFAULT_JS_PROCESSOR`,
  `DEFAULT_ALLOW_PROXY`, or the line-join logic in `descriptors.ts` without
  also updating the golden fixtures — this is the package's contract.
- **`dependencies` omission is structural.** `renderContentXml` omits the
  attribute entirely (no empty `dependencies=""`) when the array is undefined
  or empty. The result is two lines shorter, matching the archetype output for
  `clientlib-dependencies`-style clientlibs.
- **No empty directories.** `js/`, `css/`, and `resources/` are only
  materialized when at least one file is bucketed into them. A clientlib whose
  `resources/` source contains only `.gitkeep` will not produce a
  `resources/` folder (matches the captured golden).
- **Sourcemap routing.** `*.js.map` and `*.css.map` route to the `resources/`
  bucket — never `js/` or `css/` — and are excluded from `js.txt` / `css.txt`.
  This is required because AEM's clientlib aggregator concatenates everything
  in `js/`/`css/` into the served response and Sling URL decomposition 404s
  `.js.map` at the proxy root. Callers that want maps nested deeper pass a
  `SourceFile.basename` with a leading path segment (e.g. `sourcemaps/site.js.map`);
  `emitClientlib` honours nested basenames via `mkdir({ recursive: true })`.
  `@aemvite/aem-config` uses this to land maps at `resources/sourcemaps/` and
  rewrite the `sourceMappingURL` comment to match — see the
  [root README](https://github.com/LucaNerlich/aem-vite#sourcemaps-when-enabled).
- **Destructive emit.** `emitClientlib` calls `rm(clientlibDir, {
  recursive: true, force: true })` before writing. Don't aim it at a directory
  whose siblings you care about — `clientLibRoot` itself is preserved, but the
  per-clientlib folder is wiped.
- **`emitClientlibs` is sequential.** Folders are emitted in input order; this
  keeps logs deterministic and avoids racing on shared parent directories.
- **No Vite runtime dep for the API.** Only `aemClientlibPlugin` carries a
  notional `vite` peer dep; the renderers and `emitClientlib(s)` are pure Node
  and import zero Vite types.

## License

[MIT](./LICENSE) © Luca Nerlich

## Repository

<https://github.com/LucaNerlich/aem-vite> (this package lives in
[`packages/vite-plugin-aem-clientlib`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/vite-plugin-aem-clientlib)).

