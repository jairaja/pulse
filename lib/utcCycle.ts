/** Pure display helpers. Eligibility is always decided by the database, never this countdown. */
export function utcChangeoverText(closesAt: string, serverNow: number, localized?: { t: (source: string, values?: Record<string, string | number>) => string; locale: string }): string {
  const deadline = Date.parse(closesAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(serverNow)) {
    const message = 'The daily changeover is at 00:00 UTC. Connect to refresh the schedule.';
    return localized ? localized.t(message) : message;
  }
  const date = new Intl.DateTimeFormat(localized?.locale ?? 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(deadline));
  if (deadline <= serverNow) {
    return localized ? localized.t('Voting closed at 00:00 UTC on {date}. Refresh for results and the new question.', { date })
      : `Voting closed at 00:00 UTC on ${date}. Refresh to see the results and the new daily question.`;
  }
  const minutes = Math.ceil((deadline - serverNow) / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const tomorrow = new Date(serverNow + 86_400_000).toISOString().slice(0, 10) === new Date(deadline).toISOString().slice(0, 10);
  if (localized) return localized.t('Results and the next question in {hours}h {minutes}m · 00:00 UTC ({date}).', { hours, minutes: remainder, date });
  return `Results and the next question open in ${hours} ${hours === 1 ? 'hour' : 'hours'} and ${remainder} ${remainder === 1 ? 'minute' : 'minutes'} — ${tomorrow ? 'tomorrow at ' : ''}00:00 UTC (${date}).`;
}
