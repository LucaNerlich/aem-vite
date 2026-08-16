import path from 'node:path';
import { globSync } from 'tinyglobby';

const STYLE_AT_RULE_RE = /@(import|use|forward)\s+(['"])([^'"]+)\2([^;]*);/gm;
const MAGIC_RE = /[*?[\]{}!()]/;
// Matches a code fragment ending in an @-rule keyword followed by
// whitespace — i.e. the position right before a specifier string.
const AT_RULE_PREFIX_RE = /@(?:import|use|forward)\s+$/;

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
  /** Glob specifiers that matched zero files and were left in place. */
  unmatched: string[];
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

interface CodeSegment {
  start: number;
  end: number;
}

/**
 * Split a style source into "code" segments, skipping line comments
 * (`//`), block comments (`/* *\/`), and quoted strings. Positions map
 * back onto the original source so expansion can be spliced in without
 * touching the skipped regions.
 *
 * `//` preceded by a colon (e.g. `https://` inside a custom property) is
 * treated as code, and `url(...)` bodies are skipped wholesale so
 * `url(//cdn.example.com/x.png)` is not misread as a comment.
 */
function codeSegments(source: string): CodeSegment[] {
  const segments: CodeSegment[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i];
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && source[j] !== ch) {
        if (source[j] === '\\') j++;
        j++;
      }
      i = j < n ? j + 1 : n;
      continue;
    }
    const start = i;
    while (i < n) {
      const c = source[i];
      if (source.startsWith('url(', i)) {
        const close = source.indexOf(')', i + 4);
        i = close === -1 ? n : close + 1;
        continue;
      }
      if (c === '"' || c === "'") {
        // A quote right after an @-rule keyword opens the statement's
        // specifier — keep it inside the code segment so the @-rule regex
        // can match across it. Any other quote starts a string literal.
        if (AT_RULE_PREFIX_RE.test(source.slice(start, i))) {
          let j = i + 1;
          while (j < n && source[j] !== c) {
            if (source[j] === '\\') j++;
            j++;
          }
          i = j < n ? j + 1 : n;
          continue;
        }
        break;
      }
      if (
        c === '/' &&
        (source[i + 1] === '/' || source[i + 1] === '*') &&
        source[i - 1] !== ':'
      ) {
        break;
      }
      i++;
    }
    if (i > start) segments.push({ start, end: i });
  }
  return segments;
}

/**
 * Expand glob `@import` / `@use` / `@forward` statements in a style source.
 *
 * - Only affects statements whose specifier contains glob magic characters.
 * - Non-glob statements (e.g. `@import 'variables';`) are left untouched.
 * - Statements inside comments (`//`, `/* *\/`) or string literals are never
 *   expanded, so commented-out imports stay commented out.
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
  const unmatched: string[] = [];

  const expandInCode = (segment: string): string =>
    segment.replace(
      STYLE_AT_RULE_RE,
      (match, atRule: string, quote: string, specifier: string, trailing: string) => {
        if (!hasGlobMagic(specifier)) return match;

        const pattern = specifier.replace(/\\/g, '/');
        const matches = globSync(pattern, {
          cwd: baseDir,
          absolute: false,
          onlyFiles: true,
        });

        if (matches.length === 0) {
          unmatched.push(specifier);
          return match;
        }

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

  let code = '';
  let cursor = 0;
  for (const segment of codeSegments(source)) {
    code += source.slice(cursor, segment.start);
    code += expandInCode(source.slice(segment.start, segment.end));
    cursor = segment.end;
  }
  code += source.slice(cursor);

  return { code, expanded, files, unmatched };
}
