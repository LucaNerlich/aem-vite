# @aemvite/vite-plugin-aem-resources

> Vite plugin that copies one or more AEM clientlib `resources/` trees into
> the build output at the end of the build. Drop-in replacement for
> `copy-webpack-plugin` in AEM clientlib builds.

Part of the [`@aemvite/*`](https://github.com/LucaNerlich/aem-vite) toolchain.

## Install

```sh
npm i -D @aemvite/vite-plugin-aem-resources
```

- **Peer dependency:** `vite` `^8`
- **Engines:** Node `^20.19.0 || ^22.18.0 || >=24.11.0`
- No runtime dependencies — uses only Node's built-in `node:fs` and
  `node:path`.

## What it does

AEM clientlibs frequently include a `resources/` folder with fonts, images,
icons, or other static assets that must end up alongside `js/` and `css/`
inside the deployed `clientlib-<name>` folder. The webpack build did this with
`copy-webpack-plugin`; this plugin does the same thing for Vite, with two AEM-
specific behaviors baked in:

- **`.gitkeep` placeholders are skipped.** Source trees whose only files are
  `.gitkeep` are treated as empty (this matches the AEM archetype convention
  of committing `resources/fonts/.gitkeep` and `resources/images/.gitkeep` to
  keep the directories in git).
- **Empty / placeholder-only sources are a complete no-op.** Nothing is
  written, and no destination directory is created — so an empty
  `resources/fonts/` source does **not** materialize an empty `fonts/` folder
  in the build output. This preserves the byte-identical clientlib tree
  required by `@aemvite/vite-plugin-aem-clientlib`.

Files are **byte-copied**. There is no URL rewriting, no hashing, and no
transformation pipeline — the plugin is intentionally dumb.

## Usage

### Single source (most common)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { aemResources } from "@aemvite/vite-plugin-aem-resources";

export default defineConfig({
  plugins: [
    aemResources({
      from: "src/main/webpack/resources",
      // `to` is optional; defaults to "resources" inside the build outDir.
    }),
  ],
});
```

Produces (when the source has real files):

```
<outDir>/
  resources/
    fonts/MyFont.woff2
    images/logo.svg
```

### Multiple sources

```ts
aemResources([
  { from: "src/main/webpack/resources" },
  { from: "src/main/webpack/icons", to: "resources/icons" },
]);
```

Or with the explicit `entries` shape:

```ts
aemResources({
  entries: [
    { from: "src/main/webpack/resources" },
    { from: "src/main/webpack/legal", to: "resources/legal" },
  ],
});
```

### Absolute paths

`from` and `to` can be absolute paths. Relative `from` is resolved against the
Vite project `root`; relative `to` is resolved against the Vite build
`outDir`.

```ts
import path from "node:path";

aemResources({
  from: path.resolve(__dirname, "src/main/webpack/resources"),
  to: path.resolve(__dirname, "../ui.apps/.../clientlibs/clientlib-site/resources"),
});
```

## API reference

### Plugin

| Export | Signature | Notes |
|---|---|---|
| `aemResources` | `(options: AemResourcesOptions) => Plugin` | Vite plugin (also the package default export). `apply: "build"`, runs at `closeBundle`. |

### Types

```ts
type AemResourcesOptions =
  | ResourceCopy
  | ResourceCopy[]
  | { entries: ResourceCopy | ResourceCopy[] };
```

#### `ResourceCopy`

| Field | Type | Default | Effect |
|---|---|---|---|
| `from` | `string` | — | Source directory. Absolute, or relative to the Vite project `root`. Missing directories are silently skipped. |
| `to` | `string?` | `"resources"` | Destination directory. Absolute, or relative to the Vite build `outDir`. |

## Notes & caveats

- **`.gitkeep` no-op.** A `from` that exists but contains only `.gitkeep`
  placeholders (recursively) is treated as empty — no destination directory is
  created. The placeholder check uses an exact filename match on `.gitkeep`
  and is recursive across subdirectories.
- **Missing source = no-op.** `from` directories that don't exist are also
  treated as zero files, no error.
- **No URL rewriting, no hashing.** Byte-identical copies into `to`. If you
  need cache-busting, do it at the consumer level (AEM clientlib
  fingerprinting / dispatcher cache) — this plugin will not rewrite asset
  references in your JS/CSS bundles.
- **Runs at `closeBundle`.** Resources are copied after Vite finishes the
  asset graph, so they never collide with files emitted by Rollup.
- **Sequential per entry.** Multi-entry copies happen in input order, which
  matches the `@aemvite/vite-plugin-aem-clientlib` deterministic-output
  philosophy.

## License

[MIT](./LICENSE) © Luca Nerlich

## Repository

<https://github.com/LucaNerlich/aem-vite> (this package lives in
[`packages/vite-plugin-aem-resources`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/vite-plugin-aem-resources)).
