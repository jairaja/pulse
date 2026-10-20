/** Pure display helpers. Eligibility is always decided by the database, never this countdown. */
export function utcChangeoverText(closesAt: string, serverNow: number): string {
  const deadline = Date.parse(closesAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(serverNow)) {
    return 'The daily changeover is at 00:00 UTC. Connect to refresh the schedule.';
  }
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(deadline));
  if (deadline <= serverNow) {
    return `Voting closed at 00:00 UTC on ${date}. Refresh to see the results and the new daily question.`;
  }
  const minutes = Math.ceil((deadline - serverNow) / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const tomorrow = new Date(serverNow + 86_400_000).toISOString().slice(0, 10) === new Date(deadline).toISOString().slice(0, 10);
  return `Results and the next question open in ${hours} ${hours === 1 ? 'hour' : 'hours'} and ${remainder} ${remainder === 1 ? 'minute' : 'minutes'} — ${tomorrow ? 'tomorrow at ' : ''}00:00 UTC (${date}).`;
}
