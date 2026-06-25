import path from 'node:path';
import { globSync } from 'tinyglobby';

const STYLE_AT_RULE_RE = /@(import|use|forward)\s+(['"])([^'"]+)\2([^;]*);/gm;
const MAGIC_RE = /[*?[\]{}!()]/;

export interface ExpandOptions {
  /** Base directory for resolving relative glob patterns. Defaults to dirname(fromFile). */
  cwd?: string;
  /** Sort comparator for the resulting per-file specifiers. Defaults to lexicographic. */
  sort?: (a: string, b: string) => number;
}

export interface ExpandResult {
  code: string;
  /** Number of glob @-rules that were expanded. */
  expanded: number;
  /** Total number of files emitted across all expansions. */
  files: number;
}

export function hasGlobMagic(spec: string): boolean {
  return MAGIC_RE.test(spec);
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function toRelativeSpec(file: string): string {
  const posix = toPosix(file);
  if (posix.startsWith('./') || posix.startsWith('../') || posix.startsWith('/')) {
    return posix;
  }
  return `./${posix}`;
}

/**
 * Expand glob `@import` / `@use` / `@forward` statements in a style source.
 *
 * - Only affects statements whose specifier contains glob magic characters.
 * - Non-glob statements (e.g. `@import 'variables';`) are left untouched.
 * - Does NOT rewrite `url(...)` paths (parity with `css-loader { url: false }`).
 * - Output file list is deterministically sorted (lexicographic by default).
 */
export function expandStyleGlobs(
  source: string,
  fromFile: string,
  options: ExpandOptions = {},
): string {
  return expandStyleGlobsWithResult(source, fromFile, options).code;
}

export function expandStyleGlobsWithResult(
  source: string,
  fromFile: string,
  options: ExpandOptions = {},
): ExpandResult {
  const baseDir = options.cwd ?? path.dirname(fromFile);
  const sortFn = options.sort ?? ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let expanded = 0;
  let files = 0;

  const code = source.replace(
    STYLE_AT_RULE_RE,
    (match, atRule: string, quote: string, specifier: string, trailing: string) => {
      if (!hasGlobMagic(specifier)) return match;

      const pattern = specifier.replace(/\\/g, '/');
      const matches = globSync(pattern, {
        cwd: baseDir,
        absolute: false,
        onlyFiles: true,
      });

      if (matches.length === 0) return match;

      const specs = matches.map(toRelativeSpec).sort(sortFn);

      const trailingTrim = trailing.trim();
      const trailingPart = trailingTrim ? ` ${trailingTrim}` : '';

      expanded += 1;
      files += specs.length;

      return specs
        .map((s) => `@${atRule} ${quote}${s}${quote}${trailingPart};`)
        .join('\n');
    },
  );

  return { code, expanded, files };
}
