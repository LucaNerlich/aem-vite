# @aemvite/vite-plugin-aem-css-url-passthrough

> Vite plugin that rewrites CSS `url(...)` references in built AEM clientlib
> stylesheets back to the canonical `../resources/<sub>/<file>` form. Drop-in
> replacement for webpack's `css-loader: { url: false }` in AEM clientlib
> builds.

Part of the [`@aemvite/*`](https://github.com/LucaNerlich/aem-vite) toolchain.

## Install

```sh
npm i -D @aemvite/vite-plugin-aem-css-url-passthrough
```

- **Peer dependency:** `vite` `^8`
- **Engines:** Node `^20.19.0 || ^22.18.0 || >=24.11.0`
- No runtime dependencies — uses only Node's built-in `node:fs` and
  `node:path`.

## What it does

AEM clientlibs serve CSS at `<clientlib>/css/<name>.css` and static assets at
`<clientlib>/resources/<sub>/<file>`. SCSS authors typically write
`url("../resources/images/foo.svg")` relative to the final clientlib layout.
The webpack stack preserved those literals via `css-loader: { url: false }`,
but Vite/Rolldown by default rewrites `url()` relative to the source SCSS
file, producing paths like `../../components/header/resources/images/foo.svg`
that 404 against the deployed clientlib.

This plugin runs at `writeBundle`, scans every emitted `.css` file in the
build output directory, and rewrites every `url(...)` whose body contains
`resources/<configured-sub>/` to the canonical `../resources/<sub>/<rest>`
form. Other URLs are left untouched.

`writeBundle` is used (not `generateBundle`) because Vite's lib-mode CSS
extraction emits the `.css` outside the Rollup chunk map.

## Usage

### Direct (any Vite project)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { aemCssUrlPassthrough } from "@aemvite/vite-plugin-aem-css-url-passthrough";

export default defineConfig({
  plugins: [
    aemCssUrlPassthrough({
      // Optional; defaults to ["images", "fonts"].
      resourceDirs: ["images", "fonts", "icons", "storybook-assets"],
    }),
  ],
});
```

### Through `@aemvite/aem-config` (recommended)

Set the `cssUrlPassthrough` flag in your `aem.config.{ts,mjs}` and the plugin
is auto-wired into every clientlib build:

```ts
import { defineAemConfig } from "@aemvite/aem-config";

export default defineAemConfig({
  clientLibRoot: "../ui.apps/.../clientlibs",
  cssUrlPassthrough: true, // or: { resourceDirs: ["images", "fonts", "icons"] }
  clientlibs: [
    /* ... */
  ],
});
```

The same field is available per-clientlib and takes precedence over the
global value.

## API reference

### Plugin

| Export | Signature | Notes |
|---|---|---|
| `aemCssUrlPassthrough` | `(options?: AemCssUrlPassthroughOptions) => Plugin` | Vite plugin (also the package default export). `apply: "build"`, runs at `writeBundle`. |

### Types

```ts
interface AemCssUrlPassthroughOptions {
  /** Default: ["images", "fonts"]. */
  resourceDirs?: readonly string[];
}
```

## Behavior

- **Only `.css` files in the build output directory are scanned.** No URL
  rewriting touches the bundled JavaScript or any nested subdirectory.
- **Only `url(...)`s whose body contains `resources/<configured-sub>/`** are
  rewritten. The rewritten URL becomes `../resources/<sub>/<rest>`.
- **Data URIs, absolute `http(s)://` URLs, and protocol-relative `//host`
  URLs are skipped.** External CDN references are never touched.
- **Idempotent.** A url() already in canonical form (`url(../resources/...)`)
  is matched and rewritten to the identical string.
- **Sync content only.** The plugin runs once per build, after Rollup writes
  the bundle, and rewrites in place.

## Notes & caveats

- The plugin only walks the top level of the build output directory. AEM
  clientlib builds emit a single flat `<name>.css` per clientlib, so this is
  by design.
- Configure every `resources/<sub>/` bucket your stylesheets reference. If a
  url() goes through a directory you didn't list, it will be left as-is and
  will likely 404 against the AEM clientlib.

## License

[MIT](./LICENSE) © Luca Nerlich

## Repository

<https://github.com/LucaNerlich/aem-vite> (this package lives in
[`packages/vite-plugin-aem-css-url-passthrough`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/vite-plugin-aem-css-url-passthrough)).
