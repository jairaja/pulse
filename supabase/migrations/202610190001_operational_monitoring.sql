-- Privacy-safe operational health surface. Detailed votes and identifiers are never returned.
create or replace function public.get_operational_health()
returns table (
  checked_at timestamptz,
  voting_enabled boolean,
  live_question_count bigint,
  overdue_question_count bigint,
  minutes_since_last_finalization numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select now(),
    coalesce((select r.voting_enabled from private.runtime_controls r where r.singleton), false),
    (select count(*) from public.questions q where q.status = 'live'),
    (select count(*) from public.questions q where q.status = 'live' and q.asked_on < (now() at time zone 'utc')::date),
    extract(epoch from (now() - max(q.results_finalized_at))) / 60
  from public.questions q;
$$;

revoke all on function public.get_operational_health() from public, anon, authenticated;
grant execute on function public.get_operational_health() to service_role;
comment on function public.get_operational_health() is
  'Service-only aggregate health indicators without device, account, vote, IP, or credential data.';
