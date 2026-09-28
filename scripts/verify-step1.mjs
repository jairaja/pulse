import { existsSync } from 'node:fs';

const legacyRuntimePaths = [
  'app/(drawer)',
  'app/components',
  'app/providers',
  'src'
];

const found = legacyRuntimePaths.filter(existsSync);

if (found.length > 0) {
  console.error('Step 1 verification failed. Obsolete runtime paths were found:');
  found.forEach((path) => console.error(`- ${path}`));
  console.error('\nThis checkout must contain only app/_layout.tsx and app/index.tsx under app/.');
  console.error('Follow the clean-checkout procedure in README.md before running Expo.');
  process.exit(1);
}

console.log('Step 1 verification passed: no obsolete runtime source paths were found.');
