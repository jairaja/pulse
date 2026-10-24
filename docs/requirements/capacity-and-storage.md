# Vote storage capacity review

**Design arithmetic, not a hosted benchmark or Supabase cost estimate.** `docs/reviews/2026-10-24/review-models.mjs` reproduces the numbers. Assume the user counts are daily active participants, every one casts one vote every day, and the year has 365 days. Registered users or 10% participation would have very different volumes. Upvotes, submissions and account/device/history records are additional workloads.

| Daily active voters | Votes/year | Average daily-vote writes/s | Burst: 10% vote in 5 min | Primary vote+index planning range/year |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 365,000 | 0.012 | 0.33/s | 91–183 MB |
| 100,000 | 36,500,000 | 1.16 | 33/s | 9.1–18.3 GB |
| 1,000,000 | 365,000,000 | 11.6 | 333/s | 91–183 GB |
| 100,000,000 | 36,500,000,000 | 1,157 | 33,333/s | 9.1–18.3 TB |

Storage uses an illustrative 250–500 bytes per accepted vote including a planning allowance for basic indexes, **not a measured physical row size**. It excludes WAL, replicas, backups, dead tuples/bloat, idempotency/history records, privacy/audit data and other tables. Actual schema, indexes, retention, compression and maintenance can change it substantially. GB/TB are decimal. No dollar price or assertion that one Supabase instance handles these peaks is inferred.

## One logical votes table versus one independent table per question

| Concern | Indexed logical table | Separate per-question tables |
| --- | --- | --- |
| Write volume | Same accepted-vote volume | Same volume; more tables do not remove writes |
| Exact account/device uniqueness | Central constraints and transaction contract | Must be repeated and kept correct on every table |
| Past Results | Read one finalized `question_results` row per question | Still needs a stored aggregate; catalog estimates are not exact counts |
| Personal history | Stable indexed query/read model | Dynamic table discovery/unions and more complicated permission checks |
| Operations | One schema, optionally declaratively partitioned later | New DDL/RLS/index/backup/analytics handling for every daily table |
| Growth | Partition/prune and tune after measurements | Schema proliferation; manual partitioning without the database abstraction |

With an appropriate index, a raw per-question count need not scan every row in the table, but exact counting still processes matching visible rows; a physically separate table also needs to count its rows. A metadata estimate is not a substitute. Declarative partitioning can supply physical pruning without handwritten daily table routing. One table per question means roughly 365 new tables a year, not a table per user; the objection is operational/query/constraint complexity, not a claim that 365 tables cannot work.

The current repository already stores immutable YES/NO counts and totals in `question_results`. A million visitors reading a finalized result need not trigger a million raw `COUNT(*)` scans. Cache/publicly serve that snapshot with stable IDs and keyset pagination. PostgreSQL relation statistics/metadata count estimates are not authoritative voting totals because of MVCC and their update schedule.

## Suggested evolution, subject to benchmarks

- **1K / 100K daily voters:** start with indexed storage, correct predicates, bounded history/result queries, pooling and measured retention. Inspect real query plans/index sizes and load around midnight; a larger registered-user count alone is not a partitioning trigger.
- **1M daily voters / hundreds of millions of rows/year:** prototype declarative range-by-UTC-date or hash-by-question partitions and separate history/read models, then benchmark against representative data and contention. Range partitioning changes the unique-constraint design: PostgreSQL generally requires partition keys in partitioned unique/primary keys. A server-validated question→UTC-day relationship/composite FK must prevent the same question being placed in two partitions. Preserve account/device and idempotency uniqueness; do not accidentally permit duplicate votes by including an untrusted date. Hash-by-question has different pruning/retention tradeoffs.
- **100M daily voters:** treat this as an architecture program: peak ingestion, identity/attestation/provider quotas, read caching, connection limits, retention and regional failure behavior require measured budgets. Partitioning alone is not a scale guarantee. Do not promise one database/compute tier will sustain the modeled 33K writes/s peak.

The read pattern may dominate first: 100 million **concurrently open** clients polling once every 30 seconds would request about 3.33 million reads/s. That is a separate hypothetical from 100M DAU. Prefer cached public payloads, conditional requests, foreground-aware refresh, jitter and a carefully bounded boundary update. One counter row updated on every vote can be a hot lock; do not casually replace the finalization snapshot with that bottleneck. Brewing counters and rankings need their own measured/read-optimized strategy at large scale.

## What to measure before choosing a partition or bill

Use staged synthetic data and expected read/write mix: EXPLAIN (ANALYZE, BUFFERS), p50/p95/p99 latency, sustained/peak successful and denied writes, lock waits, CPU/IOPS, index/table size, pool saturation, WAL/replication lag, backups/restore, finalization duration, cross-partition history/uniqueness and vacuum/retention cost. Include midnight retries and provider failures, not just average requests. Use a separate test project with a budget/stop condition. None of these hosted measurements is claimed by this review.
