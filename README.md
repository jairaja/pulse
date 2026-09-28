# PULSE — Step-by-step build

## Current stage: Step 1 — local Expo foundation

This branch intentionally runs **without** Supabase, FCM, a database, MMKV, maps, charts, push notifications, or a drawer. They were removed from the runtime because the prior scaffold attempted to integrate too much before the application could be verified.

The only acceptance criteria for this step are:

1. The app opens in Expo Go without warnings/errors.
2. The Home screen renders.
3. A prediction must be selected before the vote buttons become active.
4. A vote shows a local confirmation only—no network request is made.

## Required local setup

> Do not use arbitrary `npm update` commands. Expo native dependencies must match the Expo SDK, not merely be the newest versions published to npm.

1. Use a current Node.js LTS release (Node 20 or newer).
2. Verify that the checkout contains only the Step 1 runtime files:
   ```bash
   npm run verify:step1
   ```
   If this fails, you have old source files from an earlier scaffold. Do **not** install the old libraries to silence the errors. First update your branch to this commit. If the obsolete files are untracked, preview then remove them:
   ```bash
   git clean -nd
   git clean -fd
   ```
   `git clean -fd` permanently deletes untracked files; commit or copy work you need before running it.
3. From the repository root, remove old dependency state:
   ```bash
   rm -rf node_modules package-lock.json
   ```
   On Windows PowerShell:
   ```powershell
   Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
   ```
4. Install the declared SDK 54 baseline, including Expo Router's direct native peer dependencies (`expo-constants` and `expo-linking`) and its explicitly declared Babel preset:
   ```bash
   npm install
   ```
5. Ask Expo to align every native package to SDK 54 and update `package.json`/lockfile as necessary:
   ```bash
   npx expo install --fix
   ```
6. Validate dependency health. **Do not continue if `expo-doctor` or typecheck reports any failed checks.**
   ```bash
   npx expo-doctor
   npm run typecheck
   ```
7. Start with a clean Metro cache:
   ```bash
   npx expo start --clear
   ```
8. Open the app in Expo Go. The Expo Go app must support SDK 54.

### If Metro reports `Cannot find module 'babel-preset-expo'`

This indicates an incomplete or stale `node_modules` installation. `babel.config.js` uses the Expo preset and the project now explicitly declares the matching SDK 54 preset as a development dependency. Do not install a global Babel package.

Run the complete clean-install sequence in this order:

```bash
rm -rf node_modules package-lock.json
npm install
npx expo install --fix
npx expo start --clear
```

On Windows PowerShell, replace the first command with:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
```

### If Expo Doctor reports missing Expo Router peers

Run the Expo-managed installer rather than selecting versions manually:

```bash
npx expo install expo-constants expo-linking
npx expo-doctor
```

The project manifest declares those peers so this should not recur after a clean install. If it does, delete `node_modules` and `package-lock.json`, then repeat the full setup sequence above.

## Dependency decision log

Removed from the **Step 1 runtime** because they are premature or were causing native-version risks:

- `react-native-mmkv`: requires native configuration and is not needed before local app behavior is proven.
- `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, and drawer navigation: deferred until navigation is introduced and Expo resolves their SDK-compatible versions.
- `react-native-maps`, `victory-native`, and `react-native-svg`: deferred until the results/heatmap step.
- Supabase, React Query, Zustand, NetInfo, notifications, translation APIs, and FCM: deferred until the local UX is proven.

## What comes next—only after Step 1 passes

Step 2 will introduce navigation and persistent local settings. Step 3 will introduce Supabase connectivity with a read-only health check. Voting, identity enforcement, FCM, translations, charts, maps, and moderation remain later steps.
