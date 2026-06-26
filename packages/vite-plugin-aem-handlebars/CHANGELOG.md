# Changelog

All notable changes to **@aemvite/vite-plugin-aem-handlebars** will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-06-26

### Added

- Initial public release.
- `aemHandlebars()` Vite plugin (`enforce: "pre"`) that precompiles
  `*.template.hbs` files into runtime Handlebars functions, emitting a tiny
  ESM module of the shape
  `import Handlebars from "handlebars/runtime"; export default Handlebars.template(<precompiled>);`.
  Mirrors the legacy webpack `handlebars-loader` behavior so
  `import Foo from "./foo.template.hbs"; Foo({ data })` keeps working.
- Built-in stubbing of Storybook-only modules — `*.stories.{js,ts,tsx}` and
  non-template `*.hbs` partials are resolved to an empty ESM module so dynamic
  imports transitively reaching them never break the build. Matches the
  legacy webpack `IgnorePlugin` configuration. Configurable / disablable via
  the `ignore` option.
- Configurable `templateSuffix` (default `.template.hbs`), `runtime` module
  (default `handlebars/runtime`), and `precompileOptions` (default
  `{ strict: false }`) forwarded verbatim to `Handlebars.precompile`.
- `handlebars` is declared as a peer dependency so consumers control the
  Handlebars version their templates compile against.
