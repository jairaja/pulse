// Offline review experiments only: no app imports, database calls, network or production changes.
// Sequential models demonstrate assumptions; they are NOT a concurrency or hosted load test.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const attempts = 100_000;
const eligibleOldSession = { account: 'A', device: 'D', loginDay: '2026-10-23', day: '2026-10-24', question: 'Q' };
let waitingRuleAccepts = 0, guardedAccepts = 0;
const accounts = new Set(), devices = new Set();
for (let i = 0; i < attempts; i++) {
  if (eligibleOldSession.loginDay < eligibleOldSession.day) waitingRuleAccepts++;
  const ak = `${eligibleOldSession.account}:${eligibleOldSession.question}`;
  const dk = `${eligibleOldSession.device}:${eligibleOldSession.question}`;
  if (!accounts.has(ak) && !devices.has(dk)) { accounts.add(ak); devices.add(dk); guardedAccepts++; }
}
assert.equal(waitingRuleAccepts, attempts); assert.equal(guardedAccepts, 1);
// An account has used Q even if a new device has not; a device has used Q even if another account has not.
assert.equal(accounts.has('A:Q'), true); assert.equal(devices.has('new-device:Q'), false);
assert.equal(accounts.has('B:Q'), false); assert.equal(devices.has('D:Q'), true);
const upvoteDays = new Set(); let acceptedAcrossDays = 0;
for (let i = 0; i < attempts; i++) {
  const key = `member-${i % 100}:${Math.floor(i / 100)}`;
  if (!upvoteDays.has(key)) { upvoteDays.add(key); acceptedAcrossDays++; }
}
let sharedDeviceWithAccountGuardOnly=0, sharedDeviceWithBothGuards=0; const usedSharedDevices=new Set();
for(let member=0;member<100;member++){sharedDeviceWithAccountGuardOnly++;if(!usedSharedDevices.has('shared-device:day')){usedSharedDevices.add('shared-device:day');sharedDeviceWithBothGuards++;}}
assert.equal(sharedDeviceWithAccountGuardOnly,100);assert.equal(sharedDeviceWithBothGuards,1);
assert.equal(acceptedAcrossDays, attempts); // Same question, 100 members, 1000 distinct UTC days each.

function importModel() {
  let decision = 'pending', receipt = null;
  return ({ isNew, originDevice, device, consent, votes }) => {
    if (!isNew || device !== originDevice) return { status: 'ineligible', imported: [] };
    if (decision !== 'pending') return receipt;
    decision = consent ? 'applied' : 'declined';
    receipt = { status: decision, imported: consent ? votes.filter(v => v.accepted && v.owner === null && v.at <= 10).map(v => v.id) : [] };
    return receipt;
  };
}
const votes = [{ id: 1, accepted: true, owner: null, at: 1 }, { id: 2, accepted: true, owner: 'other', at: 1 },
  { id: 3, accepted: false, owner: null, at: 1 }, { id: 4, accepted: true, owner: null, at: 11 }];
const call = { isNew: true, originDevice: 'signup-device', device: 'signup-device', consent: true, votes };
const imported = importModel(); assert.deepEqual(imported(call).imported, [1]); assert.deepEqual(imported(call).imported, [1]);
const declined = importModel(); assert.equal(declined({ ...call, consent: false }).status, 'declined');
assert.equal(declined(call).status, 'declined');
assert.equal(importModel()({ ...call, isNew: false }).status, 'ineligible');
assert.equal(importModel()({ ...call, device: 'another-device' }).status, 'ineligible');
let generation = 0; const leases = [];
for (let i = 0; i < 1000; i++) leases.push(++generation); // The atomic claim is ASSUMED here, not implemented/tested in PostgreSQL.
assert.equal(leases.filter(lease => lease === generation).length, 1);
const beforeCodeRequest = generation; assert.equal(generation, beforeCodeRequest); // Requesting an OTP has no revocation transition.
let latestRequest = 2, visibleSuggestions = [];
for (const response of [{ seq: 2, items: ['current matches'] }, { seq: 1, items: ['stale matches'] }]) {
  if (response.seq === latestRequest) visibleSuggestions = response.items;
}
assert.deepEqual(visibleSuggestions, ['current matches']);
const route = state => ({ brewing: 'Brewing detail', live: 'Home/live question', finalized: 'Past Results detail', removed: 'Unavailable public page' })[state];
assert.deepEqual(['brewing','live','finalized','removed'].map(route), ['Brewing detail','Home/live question','Past Results detail','Unavailable public page']);
const words = text => new Set(text.toLowerCase().match(/[a-z]+/g));
const a = words('Should schools start later?'), b = words('Should schools start earlier?');
const overlap = [...a].filter(word => b.has(word)).length / new Set([...a, ...b]).size;
assert.equal(overlap, 0.6); // High lexical overlap does not mean the same proposition.
const capacity = [1000,100000,1000000,100000000].map(dau => ({ dailyActiveUsers: dau,
  dailyVotes: dau, yearlyRows: dau * 365, averageWritesPerSecond: dau / 86400,
  burstWritesPerSecond_10PercentIn5Minutes: dau * .1 / 300,
  yearlyPrimaryGB_250BytesPerRow: dau * 365 * 250 / 1e9,
  yearlyPrimaryGB_500BytesPerRow: dau * 365 * 500 / 1e9 }));
const report = { method: 'Offline sequential predicate/state models and arithmetic; no hosted load, SQL, attestation, real email, browser/store handoff or AI search tested.',
  voteAttempts: attempts, loginWaitOnlyAcceptances: waitingRuleAccepts, independentGuardAcceptances: guardedAccepts,
  sharedDeviceSameDay: { accountsAttempting:100, accountDayOnlyAcceptances:sharedDeviceWithAccountGuardOnly, proposedAccountAndDeviceDayAcceptances:sharedDeviceWithBothGuards },
  repeatQuestionUpvotesAcrossDifferentDays: acceptedAcrossDays, modeledAccountCount: 100, modeledDistinctDevices: 100, modeledDays: 1000,
  importChecks: ['new-account only','bound originating device','explicit consent','decline sealed','same-operation retry','server-accepted unowned pre-cutoff votes only'],
  leaseClaimsModeled: 1000, remainingValidLease: 1, staleTypeaheadResponseIgnored: true,
  lexicalOverlapOfOppositeTimingQuestions: overlap,
  cooldownWaitMinutes: { loginAt0001UTC: 1439, loginAt2359UTC: 1 },
  hypotheticalReadRequestsPerSecond_100MillionConcurrentAppsPolling30Seconds: 100000000 / 30,
  assumptions: '100% of stated DAU cast one daily vote; 365 days; 250–500 bytes per vote including planning allowance for base indexes; no WAL/replicas/backups/history/upvote/audit/bloat allowance. Not a measured row size or price quote.', capacity };
if (process.argv.includes('--write-report')) writeFileSync(new URL('./model-results.json', import.meta.url), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
