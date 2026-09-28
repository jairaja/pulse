import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
const expectedFiles = ['app/_layout.tsx', 'app/index.tsx'];

if (!Array.isArray(config.files) || config.files.length !== expectedFiles.length) {
  throw new Error('tsconfig.json must use an explicit Step 1 files list.');
}

for (const file of expectedFiles) {
  if (!config.files.includes(file)) {
    throw new Error(`tsconfig.json is missing ${file}.`);
  }
}

if ('include' in config || 'exclude' in config) {
  throw new Error('tsconfig.json must not use broad include/exclude globs in Step 1.');
}

console.log('TypeScript scope verification passed: mobile typecheck includes only Step 1 app files.');
