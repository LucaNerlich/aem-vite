import { defineConfig } from 'vite-plus';

// Required for `vp lint`, not for `vp test` (defaults are sufficient for the
// latter, same as the four packages with no config file at all). Without a
// local vite-plus config present, oxlint's type-aware check loses `@types/node`
// resolution for this package's test/*.ts files (Buffer, node:fs, etc. become
// "cannot find name") — empirically confirmed the content below doesn't matter
// (even `defineConfig({})` fixes it), only the file's presence does. Likely
// related to this package's test/__golden__/ fixture directory, which no
// other package has, tripping up vp lint's config-root discovery.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
