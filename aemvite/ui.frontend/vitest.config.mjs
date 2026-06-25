import { defineConfig } from 'vitest/config';

// Override the project's vite.config.mjs `root` (which points at the
// static dev-server root) so vitest discovers tests under ui.frontend.
export default defineConfig({
  test: {
    root: '.',
    include: ['test/**/*.test.mjs'],
  },
});
