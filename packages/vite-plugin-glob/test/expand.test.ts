import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import {
  expandStyleGlobs,
  expandStyleGlobsWithResult,
  hasGlobMagic,
} from '../src/expand.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCSS_DIR = path.join(__dirname, 'fixtures', 'scss');
const CSS_DIR = path.join(__dirname, 'fixtures', 'css');
const SCSS_ENTRY = path.join(SCSS_DIR, 'main.scss');
const CSS_ENTRY = path.join(CSS_DIR, 'main.css');

describe('hasGlobMagic', () => {
  it('returns false for plain specifiers', () => {
    expect(hasGlobMagic('variables')).toBe(false);
    expect(hasGlobMagic('./styles/_base')).toBe(false);
    expect(hasGlobMagic('foo.scss')).toBe(false);
  });

  it('returns true for glob specifiers', () => {
    expect(hasGlobMagic('../components/**/*.scss')).toBe(true);
    expect(hasGlobMagic('./styles/*.scss')).toBe(true);
    expect(hasGlobMagic('./{a,b}.css')).toBe(true);
    expect(hasGlobMagic('./[a].css')).toBe(true);
  });
});

describe('expandStyleGlobs — SCSS', () => {
  it('expands a glob @import into deterministically sorted per-file lines', () => {
    const source = `@import 'variables';
@import 'base';
@import './components/**/*.scss';
@import './styles/*.scss';
`;
    const expected = `@import 'variables';
@import 'base';
@import './components/alpha/_alpha.scss';
@import './components/beta/_beta.scss';
@import './components/gamma/_gamma.scss';
@import './styles/footer.scss';
@import './styles/header.scss';
`;

    expect(expandStyleGlobs(source, SCSS_ENTRY)).toBe(expected);
  });

  it('leaves non-glob @import statements untouched', () => {
    const source = `@import 'variables';
@import 'base';
`;
    expect(expandStyleGlobs(source, SCSS_ENTRY)).toBe(source);
  });

  it('preserves quote style of the original @import', () => {
    const source = `@import "./components/**/*.scss";\n`;
    const out = expandStyleGlobs(source, SCSS_ENTRY);
    expect(out).toContain('@import "./components/alpha/_alpha.scss";');
    expect(out).not.toContain("'./components/");
  });

  it('does not rewrite url() paths', () => {
    const source = `.bg { background: url('../images/*.png'); }
@import './styles/*.scss';
`;
    const out = expandStyleGlobs(source, SCSS_ENTRY);
    expect(out).toContain(`background: url('../images/*.png')`);
    expect(out).toContain('@import \'./styles/footer.scss\';');
    expect(out).toContain('@import \'./styles/header.scss\';');
  });

  it('leaves the original statement when the glob matches nothing', () => {
    const source = `@import './nope/*.scss';\n`;
    expect(expandStyleGlobs(source, SCSS_ENTRY)).toBe(source);
  });
});

describe('expandStyleGlobs — plain CSS', () => {
  it('expands a glob @import in plain CSS', () => {
    const source = `@import './parts/*.css';\n`;
    const expected =
      `@import './parts/_one.css';\n@import './parts/_two.css';\n`;
    expect(expandStyleGlobs(source, CSS_ENTRY)).toBe(expected);
  });

  it('leaves @import url(...) untouched', () => {
    const source = `@import url('./parts/_one.css');\n`;
    expect(expandStyleGlobs(source, CSS_ENTRY)).toBe(source);
  });
});

describe('expandStyleGlobsWithResult', () => {
  it('reports counts of expanded statements and emitted files', () => {
    const source = `@import 'plain';
@import './styles/*.scss';
@import './components/**/*.scss';
`;
    const result = expandStyleGlobsWithResult(source, SCSS_ENTRY);
    expect(result.expanded).toBe(2);
    expect(result.files).toBe(5);
  });
});
