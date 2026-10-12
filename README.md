# PULSE — Step-by-step build

## Phase 1 UX concept

See the editable four-state launch mockup: [Vote today, discover the world tomorrow](docs/design/pulse-phase1-launch-flow.svg).

The runtime now follows this approved direction. It remains a local prototype until backend voting is introduced.

## Current stage: Phase 1 local UX

The runtime now implements the approved matte Phase 1 experience and drawer navigation. It still runs **without** Supabase, FCM, a database, persistence, maps, charts, or push notifications. The vote is local and resets when the app reloads.

Phase 1 deliberately exposes no in-progress voting data. It contains:

- **Today:** one question and a direct YES/NO vote.
- **Past Results:** every finalized question, with the user's vote shown when one exists locally.
- **My Pulse:** a placeholder for personal agreement insights after at least 10 answered questions.
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

1. Use Node.js 22.13 or newer. SDK 57 does not support older Node releases.
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
4. Install the declared SDK 57 baseline, including the Expo-compatible drawer dependencies:
   ```bash
   npm install
   ```
5. Ask Expo to validate every native package against SDK 57 and update `package.json`/lockfile as necessary:
   ```bash
   npx expo install --fix
   ```
6. Validate dependency health. **Do not continue if `expo-doctor` or typecheck reports any failed checks.**
   ```bash
   npx expo-doctor
   npm run verify:dependencies
   npm run verify:typecheck-scope
   npm run lint
   npm run typecheck
   ```
7. Start with a clean Metro cache through the guarded project command:
   ```bash
   npm run start -- --clear
   ```
8. Open the app in an SDK 57 development build. Expo Go may be used for this local prototype, but
   a development build is the production-oriented workflow and must be regenerated after native
   dependency upgrades.

### If Metro reports `Cannot find module 'babel-preset-expo'`

This indicates an incomplete or stale `node_modules` installation. `babel.config.js` uses the Expo preset and the project explicitly declares the matching SDK 57 preset as a development dependency. Do not install a global Babel package.

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

The project targets Expo SDK 57, the latest stable SDK. SDK 58 is still pre-release and is not used
for production. Expo-managed native packages follow the SDK 57 compatibility matrix rather than
their independent npm `latest` tags. Run `npx expo install --fix` after every SDK change and commit
the generated `package-lock.json`; do not use `npm update` to choose native package versions.
The `verify:dependencies` command delegates to `expo install --check`; the repository does not
duplicate Expo's compatibility table in a hand-maintained script.

Still deferred because they are premature for the local Phase 1 UX:

- `react-native-mmkv`: requires native configuration and is not needed before local app behavior is proven.
- Expo Router 57 bundles the drawer navigator. The app directly installs only its SDK-compatible
  native peers: `react-native-reanimated`, `react-native-worklets`, and
  `react-native-gesture-handler`.
- `react-native-maps`, `victory-native`, and `react-native-svg`: deferred until the results/heatmap step.
- Supabase, React Query, Zustand, NetInfo, notifications, translation APIs, and FCM: deferred until the local UX is proven.

## What comes next—only after this local UX passes

The next step should introduce Supabase connectivity with a read-only health check. Persistent voting, identity enforcement, settings, FCM, translations, charts, maps, and moderation remain later steps. In-progress vote trends are explicitly out of scope.

The database has been consolidated into one pre-production baseline. Follow
[`docs/supabase-setup.md`](docs/supabase-setup.md) to build and test a fresh local and remote Supabase
project; do not apply the squashed baseline over a database containing real data.
