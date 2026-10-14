import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
const expectedInclude = [
  'app/**/*.tsx',
  'lib/**/*.ts',
  'lib/**/*.tsx',
  '.expo/types/**/*.ts',
  'expo-env.d.ts'
];

if (!Array.isArray(config.include) || config.include.length !== expectedInclude.length) {
  throw new Error('tsconfig.json must include the complete Expo Router app surface.');
}

for (const pattern of expectedInclude) {
  if (!config.include.includes(pattern)) {
    throw new Error(`tsconfig.json is missing ${pattern}.`);
  }
}

if ('files' in config) {
  throw new Error('tsconfig.json must not hide valid routes behind a fixed files list.');
}

console.log('TypeScript scope verification passed: every Expo Router screen is included.');
