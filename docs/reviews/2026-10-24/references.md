# Implementation references

The repository was inspected directly. External references below are official starting points for implementation review; their pages/pricing/plan details were not live-fetched in this restricted environment. Recheck provider availability and platform behavior when implementing.

- Android verified App Links: https://developer.android.com/training/app-links
- Apple Universal Links: https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app
- Android Install Referrer: https://developer.android.com/google/play/installreferrer
- Firebase Dynamic Links retirement: https://firebase.google.com/support/dynamic-links-faq
- Supabase sessions/refresh/inactivity: https://supabase.com/docs/guides/auth/sessions
- Cloudflare Turnstile server validation, short-lived single-use tokens: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Play Integrity Standard requests: https://developer.android.com/google/play/integrity/standard
- Apple App Attest: https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity
- PostgreSQL partitioning constraints and tradeoffs: https://www.postgresql.org/docs/current/ddl-partitioning.html
- PostgreSQL planner statistics are estimates: https://www.postgresql.org/docs/current/planner-stats.html
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Maestro: https://docs.maestro.dev/

Relevant current code: `lib/auth.tsx` session-triggered history claim; `public.claim_installation_history` in the operations migration; `lib/communityApi.ts` direct authenticated upvote RPC; `lib/deviceIntegrity.ts` advisory client evidence; `app/my-pulse.tsx` placeholder; finalized aggregate schema in `supabase/migrations/202610120001_baseline.sql`; current role values in `supabase/migrations/202610210001_community_only_brewing.sql`. These are observations of current implementation, not claims that the proposed requirements have shipped.
