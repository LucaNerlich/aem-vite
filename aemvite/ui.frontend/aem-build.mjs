import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, rm } from 'node:fs/promises';
import { build as viteBuild } from 'vite';
import { loadAemConfig, resolveBuildOptions } from '@aemvite/aem-config';
import { emitClientlib } from '@aemvite/vite-plugin-aem-clientlib';
import { aemViteGlob } from '@aemvite/vite-plugin-glob';
import { aemResources } from '@aemvite/vite-plugin-aem-resources';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] === 'dev' ? 'development' : 'production';

const configPath = path.resolve(__dirname, 'aem.config.mjs');
const config = await loadAemConfig(configPath);

const stagingRoot = path.resolve(__dirname, 'dist');
await rm(stagingRoot, { recursive: true, force: true });

for (const cl of config.clientlibs) {
  const stagingDir = path.join(stagingRoot, `clientlib-${cl.name}`);
  const files = [];

  if (cl.entry) {
    const entry = path.resolve(__dirname, cl.entry);
    const resourceEntries = (cl.resources ?? []).map((from) => ({ from }));
    const resolved = resolveBuildOptions(mode, config.build, cl.build);

    await viteBuild({
      configFile: false,
      root: __dirname,
      mode,
      logLevel: 'warn',
      plugins: [
        aemViteGlob(),
        ...(resourceEntries.length ? [aemResources(resourceEntries)] : []),
      ],
      build: {
        outDir: stagingDir,
        emptyOutDir: true,
        minify: resolved.minify.js ? 'esbuild' : false,
        cssMinify: resolved.minify.css ? 'esbuild' : false,
        sourcemap: resolved.sourcemap,
        target: resolved.target,
        lib: {
          entry,
          formats: ['es'],
          fileName: () => `${cl.name}.js`,
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            assetFileNames: (info) => {
              const name = info.name ?? '';
              if (name.toLowerCase().endsWith('.css')) return `${cl.name}.css`;
              return '[name][extname]';
            },
          },
        },
      },
    });

    for (const entry of await readdir(stagingDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.js' || ext === '.css') {
        files.push({
          source: path.join(stagingDir, entry.name),
          basename: entry.name,
        });
      }
    }

    const resourcesDir = path.join(stagingDir, 'resources');
    for (const rel of await walk(resourcesDir)) {
      files.push({
        source: path.join(resourcesDir, rel),
        basename: rel,
      });
    }
  }

  await emitClientlib({
    clientlib: cl,
    outDir: config.clientLibRoot,
    files,
  });
}

async function walk(dir, prefix = '') {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), rel)));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}
