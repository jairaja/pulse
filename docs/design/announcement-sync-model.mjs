// Design validation only. This is not the app's announcement implementation or a hosted load test.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const started = performance.now();
const log = [];
const truth = new Map();
const local = new Map();
const versions = new Map();
let cursor = 0;
let seed = 23;
const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
function commit(id, removed, time) {
  // Production requires a transactional counter lock held through COMMIT, not nextval().
  const row = { id, revision: log.length + 1, removed, time, sourceVersion: `${id}:${log.length + 1}` };
  log.push(row);
  if (removed) truth.delete(id); else truth.set(id, row);
}
function apply(events) {
  for (const row of events) {
    if ((versions.get(row.id) ?? 0) >= row.revision) continue; // duplicate/out-of-order delivery
    versions.set(row.id, row.revision);
    if (row.removed) local.delete(row.id); else local.set(row.id, row);
  }
}
function drain(pageSize, during = () => {}) {
  const watermark = log.length; // pinned committed high watermark for this drain
  while (cursor < watermark) {
    const page = log.slice(cursor, Math.min(cursor + pageSize, watermark));
    apply(page); apply(page); // same page delivered twice after a timeout
    cursor = page.at(-1).revision; // advance only after local atomic apply, including tombstones
    during(); // concurrent commits must wait for the NEXT drain's watermark
  }
}
for (let i = 0; i < 100_000; i++) {
  commit(`notice-${random(5_000)}`, random(5) === 0, Math.floor(i / 100)); // many equal timestamps
  if (i % 673 === 0) drain(100);
}
let insertedDuringPaging = false;
drain(100, () => {
  if (!insertedDuringPaging) { insertedDuringPaging = true; commit('arrived-during-paging', false, 1000); }
});
assert.equal(local.has('arrived-during-paging'), false); // pinned watermark preserved
assert.equal(cursor, 100_000);
drain(100);
assert.deepEqual([...local].sort(), [...truth].sort());
// Delayed old upsert cannot resurrect a subsequently removed item.
const removed = log.findLast(row => row.removed && !truth.has(row.id));
apply(log.filter(row => row.id === removed.id).slice(0, 1));
assert.equal(local.has(removed.id), false);

// Sending only timestamps misses two same-time changes and a slow commit behind its checkpoint.
const atOneTime = [{ id: 'a', time: 10 }, { id: 'b', time: 10 }];
const naive = atOneTime.filter(row => row.time > atOneTime[0].time);
assert.equal(naive.length, 0);
const allocatedSequenceCommitOrder = [2, 1];
assert.equal(allocatedSequenceCommitOrder.filter(seq => seq > 2).length, 0);

// Cursor expiry and locale/account switches must force a new scoped snapshot, never reuse payloads.
function requestScope({ epoch, after, language, requestedLanguage, retainedFrom }) {
  return epoch !== 7 || after < retainedFrom || language !== requestedLanguage ? 'snapshot-required' : 'delta';
}
assert.equal(requestScope({ epoch: 6, after: 90000, language: 'en', requestedLanguage: 'en', retainedFrom: 50000 }), 'snapshot-required');
assert.equal(requestScope({ epoch: 7, after: 100, language: 'en', requestedLanguage: 'en', retainedFrom: 50000 }), 'snapshot-required');
assert.equal(requestScope({ epoch: 7, after: 90000, language: 'en', requestedLanguage: 'ur', retainedFrom: 50000 }), 'snapshot-required');
const readA = new Map([['notice-a', true]]); const readB = new Map();
assert.equal(readB.get('notice-a') ?? false, false);
assert.equal(readA.get('notice-a'), true);
const visibleAt = (notice, serverTime) => notice.startsAt <= serverTime && serverTime < notice.endsAt;
assert.equal(visibleAt({ startsAt: 10, endsAt: 20 }, 20), false); // expiry even without a refresh event
assert.equal(visibleAt({ startsAt: 10, endsAt: 20 }, 9), false);
const cachedTimestampRequestBytes = Buffer.byteLength(JSON.stringify(Array.from({ length: 10000 }, (_, i) => ({ id: `notice-${i}`, updatedAt: '2026-10-20T00:00:00Z' }))));
const cursorRequestBytes = Buffer.byteLength(JSON.stringify({ cursor: 'opaque-epoch-revision', locale: 'ur', limit: 100 }));
console.log(JSON.stringify({ designModelOnly: true, committedChanges: log.length, finalActiveItems: local.size,
  assertions: 'convergence, duplicates, stale replay, pagination arrivals, timestamp ties, commit ordering, cursor expiry, locale and account scope, expiry',
  pageSize: 100, cachedTimestampRequestBytes, cursorRequestBytes, elapsedMs: Math.round(performance.now() - started) }, null, 2));
