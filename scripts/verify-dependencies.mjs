import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

const sdk57Matrix = {
  expo: '~57.0.27',
  'expo-constants': '~57.0.21',
  'expo-linking': '~57.0.11',
  'expo-router': '~57.0.24',
  'expo-status-bar': '~57.0.1',
  react: '19.2.3',
  'react-native': '0.86.3',
  'react-native-gesture-handler': '~2.32.0',
  'react-native-reanimated': '4.5.1',
  'react-native-safe-area-context': '~5.7.0',
  'react-native-screens': '~4.26.0',
  'react-native-worklets': '0.10.2'
};

const mismatches = Object.entries(sdk57Matrix).filter(
  ([name, version]) => manifest.dependencies?.[name] !== version
);

const sdk57DevMatrix = {
  '@types/react': '~19.2.2',
  'babel-preset-expo': '~57.0.14',
  'eslint-config-expo': '~57.0.3',
  typescript: '~6.0.3'
};

const devMismatches = Object.entries(sdk57DevMatrix).filter(
  ([name, version]) => manifest.devDependencies?.[name] !== version
);

if (mismatches.length > 0 || devMismatches.length > 0) {
  const details = [
    ...mismatches.map(
      ([name, expected]) => `${name}: expected ${expected}, found ${manifest.dependencies?.[name]}`
    ),
    ...devMismatches.map(
      ([name, expected]) =>
        `${name}: expected ${expected}, found ${manifest.devDependencies?.[name]}`
    )
  ]
    .join('\n');
  throw new Error(`Expo SDK 57 dependency matrix mismatch:\n${details}`);
}

if (manifest.dependencies?.['@react-navigation/drawer']) {
  throw new Error('Expo Router 57 bundles its drawer; remove @react-navigation/drawer.');
}

console.log('Dependency verification passed: package.json matches the Expo SDK 57 matrix.');
