import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export interface AemCssUrlPassthroughOptions {
  /**
   * Resource subdirectory names (under `resources/`) whose `url(...)`
   * references should be rewritten back to the canonical
   * `../resources/<sub>/<file>` form. Defaults to `["images", "fonts"]` —
   * the most common AEM clientlib buckets.
   */
  resourceDirs?: readonly string[];
}

const DEFAULT_RESOURCE_DIRS = ['images', 'fonts'] as const;
// CSS `url()` regex broken across substitutions for readability.
//   group 1: optional opening quote (`'`, `"`, or empty)
//   group 2: the URL body (no closing paren / matching quote)
//   group 1 (back-reference): matching closing quote
const URL_RE_OPEN = String.raw`url\(\s*(['"]?)`;
const URL_RE_BODY = String.raw`([^'")]+)`;
const URL_RE_CLOSE = String.raw`\1\s*\)`;

/**
 * Vite plugin that rewrites `url(...)` references in built clientlib CSS
 * files back to the canonical `../resources/<sub>/<file>` form used by AEM
 * clientlibs.
 *
 * AEM clientlibs serve CSS at `<clientlib>/css/<name>.css` and static assets
 * at `<clientlib>/resources/<sub>/<file>`. SCSS authors therefore write
 * `url("../resources/images/foo.svg")` relative to that final layout. The
 * legacy webpack stack preserved those literals via `css-loader: { url: false }`.
 * Vite/Rolldown by default rewrites `url()` relative to the source SCSS file,
 * producing paths like `../../../components/header/resources/images/foo.svg`
 * that 404 against the AEM clientlib.
 *
 * In `writeBundle`, every emitted `.css` file in the build output directory
 * is scanned and any `url(...)` whose body contains `resources/<configured-sub>/`
 * is rewritten in place to `../resources/<sub>/<rest>`. Other URLs (absolute
 * `http(s)://`, `data:`, and paths that don't go through a configured
 * `resources/<sub>/` bucket) are left untouched.
 *
 * `writeBundle` is used instead of `generateBundle` because Vite's lib-mode
 * CSS extraction emits `.css` outside the Rollup chunk map.
 *
 * @example
 * ```ts
 * import { aemCssUrlPassthrough } from "@aemvite/vite-plugin-aem-css-url-passthrough";
 *
 * export default defineConfig({
 *   plugins: [aemCssUrlPassthrough({ resourceDirs: ["images", "fonts", "icons"] })],
 * });
 * ```
 */
export function aemCssUrlPassthrough(
  options: AemCssUrlPassthroughOptions = {},
): Plugin {
  const dirs = (options.resourceDirs && options.resourceDirs.length > 0
    ? options.resourceDirs
    : DEFAULT_RESOURCE_DIRS) as readonly string[];
  const escaped = dirs.map(escapeRegex).join('|');
  const urlRe = new RegExp(`${URL_RE_OPEN}${URL_RE_BODY}${URL_RE_CLOSE}`, 'g');
  const resourceMarkerRe = new RegExp(`(^|/)resources/(${escaped})/`);
  let resolved: ResolvedConfig | undefined;

  return {
    name: 'aemvite:css-url-passthrough',
    apply: 'build',
    configResolved(config) {
      resolved = config;
    },
    async writeBundle(outputOptions) {
      const root = resolved?.root ?? process.cwd();
      const dirRaw = outputOptions.dir ?? resolved?.build.outDir ?? 'dist';
      const dir = path.isAbsolute(dirRaw) ? dirRaw : path.resolve(root, dirRaw);

      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.css')) {
          continue;
        }
        const full = path.join(dir, entry.name);
        const source = await fs.readFile(full, 'utf8');
        const rewritten = source.replace(urlRe, (match, quote, raw) => {
          if (shouldSkip(raw)) return match;
          const m = resourceMarkerRe.exec(raw);
          if (!m) return match;
          const tail = raw.slice(raw.indexOf(`resources/${m[2]}/`));
          return `url(${quote}../${tail}${quote})`;
        });
        if (rewritten !== source) {
          await fs.writeFile(full, rewritten, 'utf8');
        }
      }
    },
  };
}

function shouldSkip(raw: string): boolean {
  // Leave data URIs, absolute URLs, and protocol-relative URLs untouched.
  if (raw.startsWith('data:')) return true;
  if (raw.startsWith('//')) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return true;
  return false;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default aemCssUrlPassthrough;
