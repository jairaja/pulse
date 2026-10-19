# Voting after app storage is cleared

## Expected behavior

Clearing Android app data removes the SecureStore installation credential, SQLite vote receipts and
query cache. It does not normally change Android ID for the same app signing key, Android user and
device. The gateway HMACs that signal with DEVICE_FINGERPRINT_PEPPER; PostgreSQL's unique fingerprint
index maps it to the existing installation. Raw platform identifiers are never stored in the database.

Before this change, selecting a different choice after reset returned ALREADY_VOTED, but selecting
the original choice with a new idempotency key returned the old receipt as ACCEPTED. That could look
like a second vote in the UI even though the existing row was reused. This observation alone does not
prove the hosted database gained another row.

The app now restores an existing receipt through the gateway's read-only `operation: status` before
enabling voting. The service-only get_device_vote_receipt RPC does not register an installation,
rotate a credential or submit a vote. Unknown/error responses do not unlock voting. Local receipts
are scoped to the Supabase project, so shared development seed IDs do not cross environments.

A new submission after an existing vote always returns ALREADY_VOTED with the original choice,
receipt ID and acceptance time. The app shows “Your vote was already counted.” Only retrying the
same original idempotency key and payload returns ACCEPTED; it still does not insert another row.
The SQL uniqueness constraints remain the final authority if status checking and submission race.

## Rollout

From the checkout linked to the intended hosted development project, inspect then apply the new
forward migration without resetting the database:

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy vote --project-ref <DEV_PROJECT_REF>
```

The migration is `202610200001_vote_reset_resistance.sql`. Inspect any other pending migrations before
proceeding. Do not rotate DEVICE_FINGERPRINT_PEPPER: changing it changes every derived fingerprint.
No new secret or database reset is required.

Deploy the migration and gateway before shipping the client. The new client intentionally disables
voting if the deployed gateway cannot verify its receipt status. Rebuild and install the EAS preview
APK with the same hosted project environment. Restart Metro for Expo Go/development-client testing;
Metro does not change an already-installed standalone preview binary.

## Physical-device regression

1. Before testing, note the hosted question ID and the device's current receipt ID/choice (if any).
2. Cast one eligible vote; verify exactly one corresponding row and record its accepted_at.
3. Force-stop, clear storage/cache and reopen the app on the same physical device.
4. With network available, the app should restore the original receipt and hide vote actions without
   another CAPTCHA/submission. The receipt ID, choice, timestamp and database row count stay unchanged.
5. Repeat the reset while offline or while the vote gateway is unavailable. Voting remains disabled;
   reconnect/retry and restore the same receipt. Clearing data must not become a verification bypass.
6. Also test a second eligible physical device and tomorrow's newly opened question: each can accept
   its own first vote. Same-device fresh-key submissions of either choice must never insert another.

Automated pgTAP coverage uses real PostgreSQL to check credential rotation, same/opposite choices,
idempotent retries, immutable receipt data, row counts, account conflicts and read-only grants.
Gateway/client tests check that restoration never calls register_installation/submit_vote or treats
an outage/malformed status as permission to vote. These tests do not establish real-device attestation.

## Remaining boundary

This is resistance to ordinary app-data resets, not proof of a unique human or unforgeable physical
device. Android ID can change across users/profiles, factory reset or signing identities. iOS IDFV has
its own reset boundaries. The current client-supplied evidence can be forged by a modified client;
CAPTCHA cannot prevent that. A legacy row with no recorded fingerprint can only be recovered using
its old credential or verified account, not a newly invented fingerprint.

Production hardening still requires server-verified Play Integrity / App Attest and abuse controls
per docs/device-integrity-policy.md. Those require platform enrollment and server credentials; they
must not be represented as implemented by this change. A stricter account requirement is a separate
product decision. Do not weaken eligibility or log raw identifiers/tokens to diagnose reset behavior.
