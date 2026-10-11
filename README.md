# PULSE — Step-by-step build

## Phase 1 UX concept

See the editable four-state launch mockup: [Vote today, discover the world tomorrow](docs/design/pulse-phase1-launch-flow.svg).

The runtime now follows this approved direction. It remains a local prototype until backend voting is introduced.

## Current stage: Phase 1 local UX

The runtime now implements the approved matte Phase 1 experience and drawer navigation. It still runs **without** Supabase, FCM, a database, persistence, maps, charts, or push notifications. The vote is local and resets when the app reloads.

Phase 1 deliberately exposes no in-progress voting data. It contains:

- **Today:** one question and a direct YES/NO vote.
- **Past Results:** every finalized question, with the user's vote shown when one exists locally.
- **Brewing Questions:** a placeholder for community questions, including a disabled “Ask a question” action.
- **About:** the privacy and product explanation.

Phase 1 is world-first and does not collect or infer a user's country. Phone locale, SIM/calling
code, and IP geolocation are not reliable proof of residence, so the app must not label aggregates
as “your country” without an explicit, optional country declaration and minimum sample safeguards.

The future account prompt is optional and exists only to preserve answered-question history across
devices. Email authentication is sufficient; first and last names are not required for syncing and
should remain optional profile fields if they are introduced later.

The only acceptance criteria for this step are:

1. The app opens in Expo Go without warnings/errors.
2. The Home screen renders.
3. The local vote completes without a runtime error.
4. No network request is made.

## Required local setup

> Do not use arbitrary `npm update` commands. Expo native dependencies must match the Expo SDK, not merely be the newest versions published to npm.

1. Use a current Node.js LTS release (Node 20 or newer).
2. Verify that discarded scaffold directories have not been restored:
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
4. Install the declared SDK 54 baseline, including the Expo-compatible drawer dependencies:
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
   npm run verify:typecheck-scope
   npm run typecheck
   ```
7. Start with a clean Metro cache through the guarded project command:
   ```bash
   npm run start -- --clear
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

### If Expo Router tries to bundle old `app/(drawer)` or `app/components` files

Those source trees are not part of the current flat-route architecture. Their presence means you are either on an old branch/commit or you still have untracked legacy files locally. This is **not** fixed by adding their old dependencies.

First, inspect tracked versus untracked legacy paths:

```bash
git ls-files "app/(drawer)/**" "app/components/**" "app/providers/**" "src/**"
git status --short
```

- If the first command prints files, your current branch is old. Switch to or merge the branch containing this Step 1 change before continuing.
- If it prints nothing but `npm run verify:step1` fails, the paths are untracked leftovers. Preview their deletion with `git clean -nd`, then remove them with `git clean -fd` only after safeguarding work you need.

Start the app with `npm run start -- --clear`, not `npx expo start --clear`. The project start command now runs the stale-source guard first and will refuse to bundle an invalid checkout.

### If `npm run typecheck` reports a Deno import under `supabase/functions`

The mobile TypeScript project must not typecheck Supabase Edge Functions. Their imports use Deno URLs and are validated by Supabase/Deno tooling, not by the React Native compiler.

The mobile `tsconfig.json` includes every Expo Router screen while leaving Supabase's Deno function outside the mobile compiler. Run:

```bash
npm run verify:typecheck-scope
npm run typecheck
```

If the Deno function still appears in the error output, your checkout does not contain the current `tsconfig.json`; update or merge this change before debugging dependencies.

## Dependency decision log

Still deferred because they are premature for the local Phase 1 UX:

- `react-native-mmkv`: requires native configuration and is not needed before local app behavior is proven.
- The drawer uses Expo SDK 54-compatible `react-native-reanimated`, `react-native-worklets`, and `react-native-gesture-handler` versions installed through `npx expo install`.
- `react-native-maps`, `victory-native`, and `react-native-svg`: deferred until the results/heatmap step.
- Supabase, React Query, Zustand, NetInfo, notifications, translation APIs, and FCM: deferred until the local UX is proven.

## What comes next—only after this local UX passes

The next step should introduce Supabase connectivity with a read-only health check. Persistent voting, identity enforcement, settings, FCM, translations, charts, maps, and moderation remain later steps. In-progress vote trends are explicitly out of scope.
