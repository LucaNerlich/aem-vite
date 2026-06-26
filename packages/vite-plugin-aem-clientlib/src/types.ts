/**
 * Public types for the AEM clientlib descriptor emitter.
 *
 * Inputs are intentionally structural (plain objects) so this package has no
 * runtime dependency on `@aemvite/aem-config`.
 */

/**
 * Definition of a single AEM clientlib folder, as authored in the merged
 * AEM config. Field order mirrors the locked attribute order written into
 * the resulting `.content.xml`.
 */
export interface ClientlibDefinition {
  /** Bare clientlib name (no `clientlib-` prefix). E.g. `"site"`. */
  name: string;
  /** `categories="[...]"` — required, must be non-empty. */
  categories: readonly string[];
  /** `dependencies="[...]"` — omitted entirely when empty/undefined. */
  dependencies?: readonly string[];
  /** `embed="[...]"` — omitted entirely when empty/undefined. */
  embed?: readonly string[];
  /** `cssProcessor="[...]"`. Default `["default:none","min:none"]`. */
  cssProcessor?: readonly string[];
  /** `jsProcessor="[...]"`. Default `["default:none","min:none"]`. */
  jsProcessor?: readonly string[];
  /** `allowProxy="{Boolean}..."`. Default `true`. */
  allowProxy?: boolean;
}

/** A single source file to lay out into the clientlib output tree. */
export interface SourceFile {
  /** Absolute or process-relative path to the source file on disk. */
  source: string;
  /** Path inside the clientlib (relative). Usually just the basename. */
  basename: string;
}

/** Where a file is placed inside the emitted clientlib folder. */
export type FileBucket = 'js' | 'css' | 'resources';

/** Options for {@link emitClientlib}. */
export interface EmitClientlibOptions {
  /** Clientlib metadata. */
  clientlib: ClientlibDefinition;
  /** Absolute directory in which the `clientlib-<name>` folder will be created. */
  outDir: string;
  /** Files to lay out under `js/`, `css/`, or `resources/`. */
  files?: SourceFile[];
}

/** Result of an emit operation, describing what was written. */
export interface EmitResult {
  /** Path of the emitted `clientlib-<name>` folder. */
  clientlibDir: string;
  /** Files placed under `js/`, in the order written to `js.txt`. */
  jsFiles: string[];
  /** Files placed under `css/`, in the order written to `css.txt`. */
  cssFiles: string[];
  /** Files placed under `resources/`. */
  resourceFiles: string[];
}
