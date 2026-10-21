import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const locales = ['en', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'ru', 'ur'];
const source = JSON.parse(read('lib/locales/en.json'));
const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('all ten catalogs have complete messages and preserve interpolation parameters', () => {
  for (const locale of locales) {
    const catalog = JSON.parse(read(`lib/locales/${locale}.json`));
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(source).sort(), locale);
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim().length > 0, `${locale}: ${key}`);
      assert.deepEqual(parameters(value), parameters(key), `${locale}: ${key}`);
    }
  }
});

test('static product translation calls are represented in the source catalog', () => {
  for (const dir of ['app', 'components', 'lib']) {
    for (const name of readdirSync(new URL(`../${dir}`, import.meta.url)).filter(name => /\.(tsx|ts)$/.test(name))) {
      const file = ts.createSourceFile(name, read(`${dir}/${name}`), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isCallExpression(node) && (node.expression.getText(file) === 't' || node.expression.getText(file) === 'localized.t') &&
          node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          assert.ok(Object.hasOwn(source, node.arguments[0].text), `${name}: ${node.arguments[0].text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  }
});
