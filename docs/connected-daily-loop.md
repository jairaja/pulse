# Connected daily loop: T04–T07

## Implemented contracts

### T04 — Today

- The app reads only `get_today_question('en')`.
- The response includes authoritative server time and the voting close timestamp.
- Cached content may be displayed during a failure, but voting is disabled while stale, refreshing,
  offline, or past the server-derived close time.
- The query is invalidated at the server-derived UTC boundary and on reconnect/foreground.

### T05 — Past Results

- The app cursor-paginates `list_finalized_results` by the unique `asked_on` date.
- Only immutable finalized snapshots are returned; raw votes and live totals remain unreadable.
- Successful pages are cached for seven days. Local receipt markers are joined on-device and are
  never exposed by the public result RPC.

### T06 — Voting

- A 256-bit opaque installation credential is generated on-device and stored in SecureStore.
- Only its SHA-256 hash is stored in Postgres.
- The privileged RPCs have an empty search path, narrow execute grants, transaction locks,
  installation/account uniqueness, immutable votes, bounded attempts, and idempotency receipts.
- The client displays `Vote counted` only after receiving and persisting an accepted server receipt.

### T07 — Offline behavior

- Public successful queries are persisted in SQLite-backed key/value storage.
- Connectivity drives TanStack Query's online state and explicit offline UI.
- Vote mutations use `networkMode: 'always'`, perform an explicit connectivity gate, are not
  dehydrated, and have no retry queue. A vote is never represented as pending acceptance offline.

## Security boundary

This implementation provides one accepted vote per installation and, once authenticated, per
account. It cannot prove one human. A determined actor can reinstall, use multiple devices, automate
new installation credentials, or use multiple email accounts. Android removes SecureStore data on uninstall;
iOS Keychain data can survive reinstall but Apple does not guarantee that behavior as a permanent app identity.
The product must therefore treat reinstall resistance as best-effort, not an identity guarantee. The database attempt window limits
noise from one credential; it is not global bot prevention.

Before a public global launch, put registration/voting behind a globally distributed abuse gateway,
add privacy-reviewed App Attest/Play Integrity signals and challenge escalation, perform load and
penetration testing, and define incident/rollback controls. Do not add invasive fingerprinting or
claim statistically representative world opinion.

## Operational invariants

- Never ship a secret key, service-role key, raw database credential, or installation credential in
  logs or analytics.
- Never grant mobile roles direct insert/update/delete access to votes.
- Never edit an applied migration; add a reviewed forward migration.
- Never publish live vote totals.
- Never count a client-only receipt as an accepted vote.


## Production operations added after T04–T07

- Mobile vote traffic uses the `vote` Edge Function; the underlying privileged RPCs execute only for
  `service_role`. The function derives an optional account id from a verified bearer token and never
  accepts an account id from request JSON.
- A database kill switch can suspend voting without shipping a client update. This is an emergency
  control, not a substitute for monitoring or incident response.
- `private.finalize_daily_pulse` atomically snapshots every expired live question, archives it, and
  activates today's scheduled question. `pg_cron` invokes it at 12:00 UTC; the transaction lock and
  conflict handling make retries safe.
- Authenticated users can idempotently claim server-known votes from the current installation.
  Conflicts preserve the account's existing question link and are audit-counted; accepted votes and
  finalized aggregates are never rewritten.

Automation breaks one-human-one-vote because software can create many fresh installation credentials,
run many app instances/emulators, and obtain multiple accounts much faster than a person using the UI.
Cryptographic randomness proves that credentials are distinct; it does not prove they belong to distinct
humans. Attestation raises abuse cost but likewise does not establish human uniqueness.
