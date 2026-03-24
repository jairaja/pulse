# PULSE Architecture (MVP)

## Frontend modules

- `app/(drawer)`: route-level screens via Expo Router
- `app/components`: reusable UI modules
- `src/stores`: Zustand stores (session/settings)
- `src/hooks`: React Query hooks per feature
- `src/api`: Supabase gateway + RPC wrappers

## Backend modules

- PostgreSQL tables for users, votes, predictions, submissions, translations
- RPCs for today question, live results, heat map
- Edge function for daily push dispatch orchestration

## Scalability choices

- Server-side aggregation RPCs to minimize mobile overfetch
- Stateless clients with anonymous identity primitives
- Partition-friendly vote tables by `asked_on` in future migration
- Materialized views for heavy historical analytics

## Security

- Row-level security policies should restrict writes by device identity claims
- IP hash + device uniqueness + UUID heuristics block replay/duplicate votes
- Moderation statuses disable abusive content globally
