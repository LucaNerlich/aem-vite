import type { ClientlibDefinition } from './types.js';

/**
 * Locked defaults that match the captured golden reference.
 * Do NOT change without updating the golden fixtures in `test/__golden__/`.
 */
const DEFAULT_CSS_PROCESSOR = ['default:none', 'min:none'] as const;
const DEFAULT_JS_PROCESSOR = ['default:none', 'min:none'] as const;
const DEFAULT_ALLOW_PROXY = true;

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';
const NS_CQ = 'http://www.day.com/jcr/cq/1.0';
const NS_JCR = 'http://www.jcp.org/jcr/1.0';

/** Encode a string[] as the AEM multi-value attribute `[a,b,c]`. */
function encodeArray(values: readonly string[]): string {
  return `[${values.join(',')}]`;
}

/**
 * Render the `.content.xml` for a clientlib, byte-for-byte matching the AEM
 * archetype output (single trailing `\n`).
 *
 * Attribute order is locked: `jcr:primaryType`, `categories`, `dependencies`?,
 * `cssProcessor`, `jsProcessor`, `allowProxy`. The `dependencies` attribute is
 * omitted when empty or undefined.
 */
export function renderContentXml(def: ClientlibDefinition): string {
  if (!def.categories || def.categories.length === 0) {
    throw new Error(
      `renderContentXml: clientlib "${def.name}" requires at least one category`,
    );
  }
  const cssProcessor = def.cssProcessor ?? [...DEFAULT_CSS_PROCESSOR];
  const jsProcessor = def.jsProcessor ?? [...DEFAULT_JS_PROCESSOR];
  const allowProxy = def.allowProxy ?? DEFAULT_ALLOW_PROXY;

  const lines: string[] = [];
  lines.push(XML_DECL);
  lines.push(`<jcr:root xmlns:cq="${NS_CQ}" xmlns:jcr="${NS_JCR}"`);
  lines.push(`    jcr:primaryType="cq:ClientLibraryFolder"`);
  lines.push(`    categories="${encodeArray(def.categories)}"`);
  if (def.dependencies && def.dependencies.length > 0) {
    lines.push(`    dependencies="${encodeArray(def.dependencies)}"`);
  }
  lines.push(`    cssProcessor="${encodeArray(cssProcessor)}"`);
  lines.push(`    jsProcessor="${encodeArray(jsProcessor)}"`);
  // Last attribute closes the self-closing root element on the same line.
  const lastLine = `    allowProxy="{Boolean}${allowProxy}"/>`;
  return lines.join('\n') + '\n' + lastLine + '\n';
}

/**
 * Render a clientlib `js.txt` / `css.txt` index file.
 *
 * Format (byte-exact):
 *   `#base=<base>\n\n<file1>\n<file2>...\n<fileN>`  (no trailing newline)
 * When `files` is empty:
 *   `#base=<base>\n\n`
 */
export function renderTxt(base: string, files: readonly string[]): string {
  return `#base=${base}\n\n${files.join('\n')}`;
}

/** Render `js.txt` for files placed under `js/`. */
export function renderJsTxt(files: readonly string[]): string {
  return renderTxt('js', files);
}

/** Render `css.txt` for files placed under `css/`. */
export function renderCssTxt(files: readonly string[]): string {
  return renderTxt('css', files);
}
