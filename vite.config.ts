import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    // `vite-plus/prefer-vite-plus-imports` is off: vite-plus's package exports
    // (`./test`, `./fmt`, `./lint`, `./pack`) don't re-export Vite's
    // programmatic Node API (`build`, `mergeConfig`, `loadConfigFromFile`) or
    // its `Plugin`/`UserConfig`/`ResolvedConfig` types, so every `@aemvite/*`
    // package keeps importing the real `vite` package by necessity, not oversight.
    rules: { "vite-plus/prefer-vite-plus-imports": "off" },
    options: { typeAware: true, typeCheck: true },
  },
});
