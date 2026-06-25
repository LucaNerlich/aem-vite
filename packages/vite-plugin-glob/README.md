# @aemvite/vite-plugin-glob

> Vite plugin that deterministically expands `@import` / `@use` / `@forward`
> glob specifiers in `.scss`, `.sass`, and `.css` source files before Vite's
> CSS pipeline runs Sass / esbuild. Drop-in replacement for the webpack
> `glob-import-loader` (styles only).

Part of the [`@aemvite/*`](https://github.com/LucaNerlich/aem-vite) toolchain.

## Install

```sh
npm i -D @aemvite/vite-plugin-glob
# Required when you import .scss/.sass; not needed for plain .css.
npm i -D sass
```

- **Peer dependency:** `vite` `^7 || ^8`
- **Engines:** Node `^20.19.0 || >=22.12.0`
- Runtime dependency: [`tinyglobby`](https://github.com/SuperchupuDev/tinyglobby) for fast, dependency-light glob matching.

## What it does

In an AEM `ui.frontend` clientlib it's normal to splat every component's
styles into a single bundle with a glob like:

```scss
@import "../components/**/*.scss";
```

Vite (and Sass / esbuild) does not natively understand glob specifiers in
`@import` / `@use` / `@forward`. This plugin runs **before** Vite's CSS
transforms, finds `@`-rules whose specifier contains glob magic characters
(`* ? [ ] { } ! ( )`), resolves them with `tinyglobby` relative to the
source file's directory, sorts the matches lexicographically (configurable),
and rewrites the single `@`-rule into one `@`-rule per matched file.

It does **not** touch:

- `@`-rules whose specifier does not contain glob magic (e.g.
  `@import "variables";` is preserved verbatim).
- `url(...)` references (parity with `css-loader { url: false }`).
- JavaScript / TypeScript files. Use Vite's native `import.meta.glob` for JS
  glob imports.

## Usage

### Vite config

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { aemViteGlob } from "@aemvite/vite-plugin-glob";

export default defineConfig({
  plugins: [aemViteGlob()],
});
```

That's it. Any `.scss` / `.sass` / `.css` file in the build will have its
glob `@`-rules expanded before Sass or esbuild sees the source.

### With options

```ts
import { aemViteGlob } from "@aemvite/vite-plugin-glob";

export default {
  plugins: [
    aemViteGlob({
      // Default: ['.scss', '.sass', '.css']. Pass a narrower list to skip files.
      extensions: [".scss", ".css"],
    }),
  ],
};
```

### Programmatic expansion

The expander is exported separately for unit tests and custom build pipelines.
Two import paths are supported — the main entry and a sub-path that ships only
the pure function (useful for non-Vite tooling):

```ts
import { expandStyleGlobs } from "@aemvite/vite-plugin-glob";
// or, dependency-free of the plugin shim:
import { expandStyleGlobs } from "@aemvite/vite-plugin-glob/expand";

const code = `@import "./components/**/*.scss";`;
const out = expandStyleGlobs(code, "/abs/path/to/styles.scss");
// out === "@import './components/button.scss';\n@import './components/card.scss';"
```

Use `expandStyleGlobsWithResult` if you want statistics:

```ts
import { expandStyleGlobsWithResult } from "@aemvite/vite-plugin-glob";

const { code, expanded, files } = expandStyleGlobsWithResult(src, fromFile);
// expanded: number of @-rules that matched a glob
// files:    total number of files emitted across all expansions
```

### Input → output

```scss
/* styles.scss */
@import "variables";
@import "./components/**/*.scss";
```

becomes (assuming `components/button.scss` and `components/card.scss` exist):

```scss
/* styles.scss */
@import "variables";
@import "./components/button.scss";
@import "./components/card.scss";
```

## API reference

### Plugin

| Export | Signature | Notes |
|---|---|---|
| `aemViteGlob` | `(options?: AemViteGlobOptions) => Plugin` | Vite plugin (also the package default export). `enforce: "pre"`, runs in `transform()`. |

#### `AemViteGlobOptions`

| Field | Type | Default | Effect |
|---|---|---|---|
| `extensions` | `string[]` | `[".scss", ".sass", ".css"]` | File extensions to scan. Files whose `id` (minus query) does not end with one of these are ignored. |

### Functions (also exported from `@aemvite/vite-plugin-glob/expand`)

| Export | Signature | Notes |
|---|---|---|
| `expandStyleGlobs` | `(source: string, fromFile: string, options?: ExpandOptions) => string` | Pure transform. Returns the rewritten source. |
| `expandStyleGlobsWithResult` | `(source: string, fromFile: string, options?: ExpandOptions) => ExpandResult` | Same as above, but returns `{ code, expanded, files }`. |
| `hasGlobMagic` | `(spec: string) => boolean` | True if `spec` contains any glob magic character (`* ? [ ] { } ! ( )`). |

#### `ExpandOptions`

| Field | Type | Default | Effect |
|---|---|---|---|
| `cwd` | `string` | `dirname(fromFile)` | Base directory for resolving relative glob patterns. |
| `sort` | `(a: string, b: string) => number` | lexicographic ascending | Comparator used to order the matched files inside each expansion. |

#### `ExpandResult`

| Field | Type | Notes |
|---|---|---|
| `code` | `string` | Rewritten source. |
| `expanded` | `number` | How many `@`-rules contained a glob and were expanded. |
| `files` | `number` | Total file specifiers emitted across all expansions. |

## Notes & caveats

- **Deterministic ordering.** Matches are sorted lexicographically by default,
  so the same source tree always produces the same output (important for
  CSS specificity and for byte-stable builds). Pass a custom `sort` if you
  need a different order.
- **`@-rules` only.** The regex targets `@import` / `@use` / `@forward`. Other
  Sass / CSS constructs are not rewritten.
- **Glob magic gate.** Specifiers without any of `* ? [ ] { } ! ( )` are left
  untouched verbatim — non-glob `@import 'variables';` is a no-op.
- **No `url()` rewriting.** This is intentional — the plugin only mutates
  `@`-rules. CSS `url(...)` paths are left alone for parity with the historical
  `css-loader { url: false }` setting.
- **No JS handling.** Use Vite's built-in `import.meta.glob` for JS / TS glob
  imports. This plugin is styles-only.
- **Zero matches → no rewrite.** If a glob resolves to nothing, the original
  `@`-rule is preserved unchanged so authoring errors surface as Sass errors
  rather than silent drops.
- **Path style.** Output specifiers are normalized to POSIX (`/`) and made
  relative (`./…`) when not already absolute or parent-relative.

## License

[MIT](./LICENSE) © Luca Nerlich

## Repository

<https://github.com/LucaNerlich/aem-vite> (this package lives in
[`packages/vite-plugin-glob`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/vite-plugin-glob)).
