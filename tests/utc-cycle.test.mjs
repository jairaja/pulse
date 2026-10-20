import assert from 'node:assert/strict';
import { test } from 'node:test';
import { utcChangeoverText } from '../lib/utcCycle.ts';

test('countdown identifies the exact next UTC midnight and absolute date', () => {
  const message = utcChangeoverText('2026-10-21T00:00:00Z', Date.parse('2026-10-20T20:15:00Z'));
  assert.match(message, /3 hours and 45 minutes/);
  assert.match(message, /tomorrow at 00:00 UTC \(21 Oct 2026\)/);
  assert.match(utcChangeoverText('2026-10-21T00:00:00Z', Date.parse('2026-10-20T23:59:59Z')), /0 hours and 1 minute/);
});
test('midnight closes the old countdown with no noon boundary or negative duration', () => {
  const exact = utcChangeoverText('2026-10-21T00:00:00Z', Date.parse('2026-10-21T00:00:00Z'));
  assert.match(exact, /Voting closed at 00:00 UTC on 21 Oct 2026/);
  assert.doesNotMatch(exact, /-\d|12:00/);
  const noon = utcChangeoverText('2026-10-21T00:00:00Z', Date.parse('2026-10-20T12:00:00Z'));
  assert.match(noon, /12 hours and 0 minutes/);
  assert.match(utcChangeoverText('invalid', NaN), /refresh the schedule/);
});
