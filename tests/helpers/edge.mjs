import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
export function edgeModule(file, dependencies, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(`../../supabase/functions/${file}`, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText;
  runInNewContext(javascript, { exports, require: name => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected module ${name}`); return dependencies[name];
  }, crypto: globalThis.crypto, TextEncoder, Uint8Array, atob, AbortSignal, Response, Request, FormData, URL,
  Date, Intl, JSON, ...globals });
  return exports;
}
