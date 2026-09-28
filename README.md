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
2. From the repository root, remove old dependency state:
   ```bash
   rm -rf node_modules package-lock.json
   ```
   On Windows PowerShell:
   ```powershell
   Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
   ```
3. Install the declared SDK 54 baseline:
   ```bash
   npm install
   ```
4. Ask Expo to align every native package to SDK 54 and update `package.json`/lockfile as necessary:
   ```bash
   npx expo install --fix
   ```
5. Validate dependency health:
   ```bash
   npx expo-doctor
   npm run typecheck
   ```
6. Start with a clean Metro cache:
   ```bash
   npx expo start --clear
   ```
7. Open the app in Expo Go. The Expo Go app must support SDK 54.

## Dependency decision log

Removed from the **Step 1 runtime** because they are premature or were causing native-version risks:

- `react-native-mmkv`: requires native configuration and is not needed before local app behavior is proven.
- `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, and drawer navigation: deferred until navigation is introduced and Expo resolves their SDK-compatible versions.
- `react-native-maps`, `victory-native`, and `react-native-svg`: deferred until the results/heatmap step.
- Supabase, React Query, Zustand, NetInfo, notifications, translation APIs, and FCM: deferred until the local UX is proven.

## What comes next—only after Step 1 passes

Step 2 will introduce navigation and persistent local settings. Step 3 will introduce Supabase connectivity with a read-only health check. Voting, identity enforcement, FCM, translations, charts, maps, and moderation remain later steps.
