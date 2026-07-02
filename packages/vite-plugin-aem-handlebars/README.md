# @aemvite/vite-plugin-aem-handlebars

> Vite plugin that precompiles `*.template.hbs` files into runtime Handlebars
> functions and stubs Storybook-only / non-template `.hbs` partials. Drop-in
> replacement for the legacy webpack `handlebars-loader` + `IgnorePlugin`
> pair used by AEM clientlib builds.

Part of the [`@aemvite/*`](https://github.com/LucaNerlich/aem-vite) toolchain.

## Install

```sh
npm i -D @aemvite/vite-plugin-aem-handlebars handlebars
```

- **Peer dependencies:** `vite` `^8`, `handlebars` `^4.7`
- **Engines:** Node `^20.19.0 || ^22.18.0 || >=24.11.0`
- Consumers must install `handlebars` themselves so they control the
  templating runtime version.

## What it does

Two concerns under one plugin, both mirroring legacy webpack behavior:

1. **Precompile templates.** Every `*.template.hbs` file is read at build
   time, run through `Handlebars.precompile`, and replaced with a tiny ESM
   module that imports `handlebars/runtime` and exports the compiled
   template function. So `import Foo from "./foo.template.hbs"; Foo({ data })`
   keeps returning an HTML string.

2. **Stub Storybook-only modules.** Storybook stories (`*.stories.{js,ts,tsx}`)
   and non-template `*.hbs` partials are resolved to an empty ESM module so
   any transitive dynamic imports that reach them do not break the
   production build.

## Usage

### Direct (any Vite project)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { aemHandlebars } from "@aemvite/vite-plugin-aem-handlebars";

export default defineConfig({
  plugins: [aemHandlebars()],
});
```

### Through `@aemvite/aem-config` (recommended)

Set the `handlebars` flag in your `aem.config.{ts,mjs}` and the plugin is
auto-wired into every clientlib build:

```ts
import { defineAemConfig } from "@aemvite/aem-config";

export default defineAemConfig({
  clientLibRoot: "../ui.apps/.../clientlibs",
  handlebars: true, // or: { precompileOptions: { strict: true } }
  clientlibs: [
    /* ... */
  ],
});
```

The same field is available per-clientlib and takes precedence over the
global value. Set `handlebars: false` per-clientlib to opt out when the
global is enabled.

## API reference

### Plugin

| Export | Signature | Notes |
|---|---|---|
| `aemHandlebars` | `(options?: AemHandlebarsOptions) => Plugin` | Vite plugin (also the package default export). `enforce: "pre"`. |

### Types

```ts
interface AemHandlebarsOptions {
  /** Default: ".template.hbs". */
  templateSuffix?: string;
  /** Forwarded verbatim to `Handlebars.precompile`. Default: { strict: false }. */
  precompileOptions?: Record<string, unknown>;
  /** Module specifier for the emitted import. Default: "handlebars/runtime". */
  runtime?: string;
  /**
   * Built-in stubbing always covers `*.stories.{js,ts,tsx}` and non-template
   * `*.hbs` partials. Pass an array of RegExp / pattern strings to add
   * ADDITIONAL stub patterns. Pass `false` to disable stubbing entirely.
   */
  ignore?: false | readonly (RegExp | string)[];
}
```

## Emitted module shape

For a file `foo.template.hbs`:

```js
import Handlebars from "handlebars/runtime";
export default Handlebars.template(<precompiled program>);
```

So consumers keep the webpack-era ergonomics:

```ts
import Foo from "./foo.template.hbs";
const html = Foo({ data });
```

Make sure the Handlebars helpers your templates depend on are registered on
the same `handlebars/runtime` module **before** the templates execute (a
typical pattern is a small `handlebars-helpers.ts` imported early in the
clientlib entry).

## Behavior

- **Only `*.template.hbs` files are transformed.** All other module IDs
  pass through the `transform` hook untouched.
- **Stubbing is `enforce: "pre"`** so the empty module is loaded before any
  other plugin (e.g. an asset loader) tries to parse the `.hbs` source.
- **`handlebars` is a peer dependency.** The plugin imports it once and
  uses `Handlebars.precompile` at build time; consumers ship
  `handlebars/runtime` at runtime.
- **Idempotent and pure.** No filesystem mutations, no temp files; only
  the `transform` / `resolveId` / `load` hooks run.

## Notes & caveats

- The default `ignore` list does **not** include project-specific paths
  (e.g. legacy `vendors/tabs.js`). Add them via `ignore: [/vendors\/tabs\.js$/]`
  or layer a small project-local plugin in your `aem.config.{ts,mjs}`
  `plugins:` array.
- Source maps are emitted as `null` for the transformed templates — the
  precompiled output bears no useful relationship to the source `.hbs`
  syntax. Storybook-stub modules also have no map.

## License

[MIT](./LICENSE) © Luca Nerlich

## Repository

<https://github.com/LucaNerlich/aem-vite> (this package lives in
[`packages/vite-plugin-aem-handlebars`](https://github.com/LucaNerlich/aem-vite/tree/main/packages/vite-plugin-aem-handlebars)).
