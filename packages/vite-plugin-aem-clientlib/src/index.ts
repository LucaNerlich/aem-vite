/**
 * @aemvite/vite-plugin-aem-clientlib
 *
 * Descriptor emitter for AEM clientlib folders. Replaces
 * `aem-clientlib-generator`. Reproduces `.content.xml`, `js.txt`, and
 * `css.txt` byte-for-byte against the captured archetype golden reference.
 */
export {
  renderContentXml,
  renderTxt,
  renderJsTxt,
  renderCssTxt,
} from './descriptors.js';
export { classifyFile } from './layout.js';
export { emitClientlib, emitClientlibs } from './emit.js';
export { aemClientlibPlugin } from './plugin.js';
export type {
  AemClientlibPluginOptions,
  VitePluginLike,
} from './plugin.js';
export type {
  ClientlibDefinition,
  SourceFile,
  FileBucket,
  EmitClientlibOptions,
  EmitResult,
} from './types.js';
