// Stylesheets
import './main.scss';

// Eagerly import sibling/child modules for side-effects.
// Vite's import.meta.glob replaces webpack's glob-import-loader.
// import.meta.glob does not include the calling module.
import.meta.glob('./**/*.js', {eager: true});
import.meta.glob('./**/*.ts', {eager: true});
import.meta.glob('../components/**/*.js', {eager: true});
