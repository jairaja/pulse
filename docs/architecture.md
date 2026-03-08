# PULSE architecture

## Frontend
- Expo Router route-driven module boundaries.
- Zustand for device identity and vote step state.
- TanStack Query for remote state (questions, results, history).
- Componentized visualization layer (Victory + map).

## Backend (Supabase)
- Postgres tables for users/questions/votes/predictions/submissions.
- SQL RPCs for feed/result/history queries.
- Edge Functions for daily cron jobs (notifications, question promotion).
- RLS policies should enforce anonymous identity isolation and moderation-only admin actions.

## Scalability
- Read patterns offloaded to RPC aggregations.
- Polling can migrate to Supabase Realtime channels.
- Caching via React Query stale/fresh strategy.
- Moderation operations modeled as immutable status transitions.
