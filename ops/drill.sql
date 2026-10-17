-- Staging/local only. The runner wraps this in BEGIN/ROLLBACK and enforces a timeout.
do $$
declare
  v_status text;
  v_first jsonb;
  v_second jsonb;
begin
  update private.runtime_controls set voting_enabled = false, updated_at = now() where singleton;
  if not found then raise exception 'Kill-switch control missing'; end if;
  select status into v_status from public.submit_vote(
    repeat('drill-only-', 5), null, gen_random_uuid(), 'YES', gen_random_uuid());
  if v_status is distinct from 'VOTING_DISABLED' then raise exception 'Kill switch did not reject a vote'; end if;

  -- First replay may process staging data; every write rolls back at the end.
  perform private.finalize_daily_pulse(now());
  select coalesce(jsonb_agg(to_jsonb(r) order by r.question_id), '[]'::jsonb)
    into v_first from public.question_results r;
  perform private.finalize_daily_pulse(now());
  select coalesce(jsonb_agg(to_jsonb(r) order by r.question_id), '[]'::jsonb)
    into v_second from public.question_results r;
  if v_first is distinct from v_second then raise exception 'Finalizer replay mutated snapshots'; end if;
end;
$$;
