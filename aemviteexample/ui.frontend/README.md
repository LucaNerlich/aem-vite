# ui.frontend

Vite-based AEM `ui.frontend` module powered by [`@aemvite/aem-config`](../../packages/aem-config).

It replaces the legacy **webpack + Babel + PostCSS + `aem-clientlib-generator`** toolchain with
**Vite + esbuild + Sass**, while emitting clientlib descriptors (`.content.xml`, `js.txt`,
`css.txt`) **byte-identical** to the AEM archetype's historical output. Dispatcher
invalidation, Cloud Manager packaging, and downstream caches require no changes.

> This module uses `file:` links to the local monorepo packages so the example always builds
> against the current source. A real adopter would install `@aemvite/aem-config` from the
> npm registry (see [migration guide](#migration-guide-webpack-→-vite) below).

## Prerequisites

- **Node.js** `^20.19.0 || >=22.12.0` (required by Vite 8)
- **npm** 7+ (or pnpm 8+ — both auto-install peer dependencies)

When building via Maven, `frontend-maven-plugin` downloads and caches the right Node version
automatically (see `pom.xml`).

## Install

```sh
npm ci
```

## Scripts

| Script         | What it does                                                                                          |
|----------------|--------------------------------------------------------------------------------------------------------|
| `npm run dev`  | Build all clientlibs in development mode — no minification, inline sourcemaps.                        |
| `npm run prod` | Build all clientlibs in production mode — esbuild minification (JS + CSS), no sourcemaps.             |

Both call the `aem-build` CLI shipped with `@aemvite/aem-config`. There is no custom build
script — all configuration lives in `aem.config.mjs`.

## Configuration

`aem.config.mjs` is the single source of truth for what clientlibs are built and where they
land:

- `clientlib-dependencies` — descriptor-only placeholder (`entry: ''`); emits only
  `.content.xml`, `js.txt`, `css.txt`.
- `clientlib-site` — JS + CSS + resources; entry is `src/main/frontend/site/main.ts`.

## Source layout

```
src/main/frontend/
├── components/         # Component SCSS (glob-imported by main.scss)
├── resources/          # Copied to clientlib-site/resources/
└── site/
    ├── main.ts         # JS entry → site.js
    ├── main.scss       # CSS entry (imported from main.ts) → site.css
    ├── _variables.scss
    └── _base.scss
```

- **JS globbing**: use Vite's native [`import.meta.glob`](https://vite.dev/guide/features.html#glob-import)
  in `main.ts` — no webpack loaders needed.
- **SCSS globbing**: `@aemvite/vite-plugin-glob` expands glob `@import` patterns
  (`@import '../components/**/*.scss';`) before Sass sees them. Non-glob imports
  (`@import 'variables';`) pass through unchanged.

## Output

Built clientlibs land directly in:

```
../ui.apps/src/main/content/jcr_root/apps/aemviteexample/clientlibs/
├── clientlib-dependencies/   # .content.xml, js.txt, css.txt
└── clientlib-site/
    ├── .content.xml
    ├── js.txt
    ├── css.txt
    ├── js/site.js
    ├── css/site.css
    └── resources/            # only present when real files exist
```

## Maven integration

`pom.xml` wires `frontend-maven-plugin` to run `npm ci` then `npm run prod` during the
`generate-resources` phase. The `fedDev` profile runs `npm run dev` instead. **No `pom.xml`
changes are required by the migration** — only the npm scripts behind `run prod` / `run dev`
swap.

---

## Migration guide (webpack → Vite)

This is the exact change set used to migrate this module from the AEM archetype's default
webpack toolchain to `@aemvite/aem-config`. Mirror it in your own `ui.frontend`.

### 1. Rename the source folder (optional, but recommended)

The archetype's `src/main/webpack` name is misleading once webpack is gone. Rename it to
`src/main/frontend`:

```sh
git mv src/main/webpack src/main/frontend
```

If you keep the old name, just leave the `entry` and `resources` paths in `aem.config.mjs`
pointing at `src/main/webpack` instead.

### 2. Replace `package.json`

Replace every webpack-related entry with a single dependency on `@aemvite/aem-config` (npm
7+/pnpm 8+ auto-install its peers `vite` and `esbuild`):

```jsonc
{
  "name": "your.ui.frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev":  "aem-build --mode dev  --config aem.config.mjs",
    "prod": "aem-build --mode prod --config aem.config.mjs"
  },
  "devDependencies": {
    "@aemvite/aem-config": "^0.2.2",
    "sass": "^1.101.0",
    "typescript": "^5.6.0"
  }
}
```

You can drop `sass` if you have no `.scss` files, and `typescript` if you author only `.js`.

### 3. Create `aem.config.mjs`

This file replaces `webpack.common.js`, `webpack.dev.js`, `webpack.prod.js`, **and**
`clientlib.config.js`. Adjust `clientLibRoot`, `categories`, and the `entry`/`resources`
paths to match your project:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineAemConfig } from '@aemvite/aem-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineAemConfig({
  clientLibRoot: path.resolve(
    __dirname,
    '../ui.apps/src/main/content/jcr_root/apps/aemviteexample/clientlibs',
  ),
  build: { target: 'es2015' },
  clientlibs: [
    {
      name: 'dependencies',
      entry: '',
      categories: ['aemviteexample.dependencies'],
    },
    {
      name: 'site',
      entry: 'src/main/frontend/site/main.ts',
      categories: ['aemviteexample.site'],
      dependencies: ['aemviteexample.dependencies'],
      resources: ['src/main/frontend/resources'],
      build: { minify: { js: true, css: true }, sourcemap: false },
    },
  ],
});
```

### 4. Update `site/main.ts`

Replace the legacy `glob-import-loader` syntax with Vite's native `import.meta.glob`:

```ts
// Stylesheets
import './main.scss';

// import.meta.glob does not include the calling module.
import.meta.glob('./**/*.js', { eager: true });
import.meta.glob('./**/*.ts', { eager: true });
import.meta.glob('../components/**/*.js', { eager: true });
```

### 5. SCSS globs need no change

`main.scss` keeps its glob imports — `@aemvite/vite-plugin-glob` (auto-wired by
`aem-build`) understands them:

```scss
@import 'variables';
@import 'base';
@import '../components/**/*.scss';
@import './styles/*.scss';
```

### 6. Delete obsolete files

```sh
rm webpack.common.js webpack.dev.js webpack.prod.js clientlib.config.js
```

The intermediate `dist/` directory is no longer used — `aem-build` writes straight into
`ui.apps`. `assembly.xml` can stay as-is (it produces an empty distribution zip but does no
harm), or be removed along with its `maven-assembly-plugin` block if you don't need it.

### 7. `tsconfig.json` — make it Vite-friendly

Vite resolves modules with the bundler algorithm and transpiles via esbuild. A minimal
modern config:

```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "lib": ["es2022", "dom", "dom.iterable"],
    "allowJs": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["./src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 8. `pom.xml` — no changes needed

`frontend-maven-plugin` just runs `npm run prod` (or `npm run dev` under `fedDev`); the
script body is now `aem-build` instead of `webpack`, but the Maven side doesn't notice.

### 9. Reinstall

```sh
rm -rf node_modules package-lock.json dist
npm install
npm run prod
```

If `npm run prod` writes `.content.xml`, `js.txt`, `css.txt` and `js/<name>.js` +
`css/<name>.css` under your `clientLibRoot`, the migration is complete.

For deeper details (advanced `plugins` / `vite` passthrough, per-clientlib overrides), see
the [root `MIGRATION.md`](../../MIGRATION.md) and the
[`@aemvite/aem-config` README](../../packages/aem-config/README.md).
