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
new installation credentials, or use multiple email accounts. The database attempt window limits
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
