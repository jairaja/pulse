# What the 100,001-change announcement simulation means

The announcement feature is still specification-only. `announcement-sync-model.mjs` is an in-memory design experiment run in Node, with no hosted database, real phone, network or production users.

A “change” means one publication/update/removal event, not one distinct announcement or one concurrent user. The model generated 100,000 events across repeated announcement IDs, then added one event while pagination was in progress: 100,001 total. Its fake server held the latest truth; its fake device maintained a separate cache. “Converged” means their final ID/content/revision maps matched after every outstanding page was applied.

## The proposed algorithm with an example

1. The app stores a compact cursor, for example “successfully applied through committed revision 240”, plus the selected language/feed version. It does not send the timestamps of every item it has.
2. The server fixes a high watermark for this refresh, say 350, and returns changes 241–340 in a page capped at 100. The app atomically applies them and saves cursor 340. It then fetches 341–350.
3. If a new event 351 commits while those pages are downloading, it belongs to the next refresh. Pinning 350 prevents an endless moving finish line and losing the new item.
4. Each announcement has an ID and increasing revision. Receiving a page twice after a timeout is harmless: the app ignores an already-applied/older revision. An old delayed update cannot overwrite a newer edit.
5. Removal is sent as a tombstone (“remove ID X at revision 312”). Without that record, a client fetching only currently live items could keep an obsolete cached announcement forever. Time-based expiry also uses server timing; it cannot depend solely on receiving a removal event.
6. If the cursor is too old for the retained change log, the feed was reset, or the app language changed, the server requests a fresh scoped snapshot. Account read/unread state remains separate from public content and guest “new” dot state.

## What the script exercises

- Many events share timestamps: an algorithm that only asks for timestamps strictly greater than its last timestamp can miss another event at exactly that time.
- Every fetched page is deliberately applied twice. The cache remains correct.
- One new change arrives during pagination. It is excluded from the current pinned watermark, then included in the next refresh.
- A stale earlier event is replayed after a later removal. The deleted announcement stays deleted.
- Basic model checks cover expired cursors/feed versions, language switches, separate account read-state maps and scheduled start/expiry times. These are model assertions, not integrations of those features.
- A separate counterexample shows that ordinary database sequence numbers are allocation-ordered, not necessarily commit-ordered. If A allocates 100 and waits, B commits 101, then the client checkpoints 101 before A commits, it could miss 100. The model assumes commit-ordered revisions; real implementation must establish that property, for example with a transactional counter lock held until commit.

The example request containing 10,000 cached ID/timestamp pairs was 558,891 bytes. Cursor/locale/limit metadata was 60 bytes. This compares request metadata only, not response traffic or a guaranteed production compression ratio. The local script ran in roughly 0.1 seconds; that is not an estimate of API latency.

## What it does not prove

It does not simulate 100,001 users hitting Supabase simultaneously, SQL transaction failures, real network retries, rate limits, database index/lock performance, cache persistence crashes, mobile background behavior, screen-reader UI, AI translation quality or production read/unread authorization. Those need actual implementation, database/concurrency tests, physical devices and a separate staged load test with agreed latency/error targets. The simulation validates the basic reconciliation idea and exposes failure cases before implementation; it is not proof that a production Announcements service has shipped or scales to that traffic.
