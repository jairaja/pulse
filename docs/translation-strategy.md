# Translation strategy decision

**Status:** Static UI localization and account preferences are implemented for the ten owner-selected locales. The dynamic question translation workflow below remains proposed; no AI translation jobs are enabled by this change. See `docs/issues/languages-and-preferences.md`.

## The actual product requirement

PULSE does not merely need translated text. It needs every voter in a language cohort to answer the
same stable proposition, and it must be able to show that exact wording with the finalized result
later. A translation that changes after voting starts corrupts the meaning of the aggregate even if
the replacement translation is linguistically better.

The source question remains authoritative. A translation is a versioned publication artifact for a
specific locale, not disposable presentation text.

## Why `question_translations` exists

The current table can hold candidate translations by question, language, and provider and mark one
candidate as selected. The read RPC returns that selected text and falls back to source text when no
selection exists. This gives deterministic wording, one translation request per publication rather
than per reader, low-latency reads, historical reproducibility, and an editorial correction path.

It is not required if Phase 1 launches in one language. In that case the disciplined choice is to
leave the table empty—or remove/defer it before the baseline is deployed—not to build an unused
translation system. It becomes justified when PULSE commits to serving dynamic questions in two or
more locales.

## Approaches

### A. Pre-translate and store every supported locale

Translate each approved question before it goes live, validate the output, then publish one immutable
translation per supported locale.

**Advantages**

- Every user in a locale sees identical wording throughout voting and in historical results.
- No translation-provider latency or outage is on the app's read path.
- Cost scales with questions × supported locales, not questions × users.
- Translations can be reviewed, corrected, tested for layout, and audited before publication.
- The app can cache results and operate with previously downloaded content.
- Provider/model changes cannot silently rewrite an old poll.

**Disadvantages**

- Publishing must wait for translation and quality checks.
- Supporting many locales creates operational review work.
- Stored copies need source-version invalidation when an editor changes the source question.
- Database rows and workflow states must be managed, although the storage volume is negligible for
  one short question per day.

### B. Translate in real time for every read

Send the source question to a translation or general AI API whenever a user requests a locale.

**Advantages**

- Minimal translation schema and no up-front generation job.
- New locales appear without a publication batch.
- The provider can use its newest model automatically.

**Disadvantages**

- The first screen now depends on another network service, adding latency and failure modes.
- Repeated requests waste money and expose the system to traffic-amplification abuse.
- Model/provider updates and nondeterminism can show voters materially different propositions.
- There is no reliable historical record of what wording a voter saw.
- Provider credentials require a trusted server; putting them in the Expo app would leak them.
- Rate limits or outages can make today's question unavailable globally.
- A malicious submitted question can become prompt-injection input if a general AI prompt is not
  tightly isolated and treated as untrusted data.

This approach is unacceptable for the canonical voting question.

### C. Translate on first request, then persist/cache

Generate a missing locale once on a trusted server, store it, and reuse it.

**Advantages**

- Avoids generating long-tail locales that nobody requests.
- After the first request, cost, consistency, and latency approach the stored model.
- Can expand language coverage incrementally.

**Disadvantages**

- The first user in each locale gets slower and less reliable service.
- An unreviewed first output becomes canonical unless a publication state is enforced.
- Concurrent first requests require idempotency/locking to avoid duplicate or conflicting outputs.
- A source edit still needs explicit invalidation and regeneration.

This is useful only as a controlled long-tail fallback, not for launch locales.

### D. Bundle translations in the mobile release

Store translated questions in application localization files.

**Advantages**

- Fast, offline, and operationally simple for static interface copy.
- No translation API is needed at runtime.

**Disadvantages**

- A new app-store release is required for every daily question or correction.
- Users on old app versions see stale content.
- It couples editorial publishing to mobile release approval.

Use this for static UI labels only, never for daily questions.

### E. Rely on device/OS translation

**Advantages:** no translation backend to operate.

**Disadvantages:** inconsistent availability and quality, no audit trail, no guarantee that results
reuse the same wording, and no product control over sensitive ambiguity. This may be an optional user
accessibility action, but cannot define the poll text.

## Recommendation: publication-time storage with a controlled fallback

1. Launch in English only unless PULSE can operationally review additional launch locales.
2. For each supported locale, generate a candidate on the server when a question is scheduled—not
   when a user opens the app.
3. Prefer a dedicated translation service for the first deterministic candidate. Use a general AI
   model only for alternatives, terminology/context checks, or languages where measured evaluation
   proves it better.
4. Require editorial approval for launch locales and freeze the published text before voting opens.
5. Store the exact published translation and return source text when no published locale exists.
6. Never silently swap a translation during an open vote. A material correction should cancel or
   restart the question; a cosmetic correction needs an auditable revision policy.
7. Consider generate-on-first-request-and-persist only for approved long-tail locales, behind a
   server-side job with idempotency, quotas, validation, and source-language fallback.

This hybrid preserves global reach without putting AI availability or nondeterminism in the critical
vote path.

## Required schema/workflow hardening before multilingual launch

The baseline table is sufficient to prove read behavior, but it is not a finished translation
workflow. Before using it in production, add a forward migration and tests for:

- BCP 47 locale tags (`pt-BR`, `zh-Hant`) rather than assuming two-letter language codes.
- Explicit `draft`, `reviewed`, `published`, `rejected`, and `superseded` states.
- Source revision/hash so stale translations cannot be published after source edits.
- Provider, model/version, generation timestamp, reviewer, and review timestamp metadata.
- Exactly one published translation per question and locale.
- Immutability while a question is live and after results are finalized.
- Server-only write permissions; clients receive published rows only.
- Length, Unicode, bidirectional-text, interpolation/markup, and prohibited-content validation.
- Idempotent jobs, retries, provider timeouts, quotas, budget alerts, and fallback behavior.

Do not treat a numeric AI “quality score” as proof. Quality requires representative bilingual review,
back-translation or independent checks, and product tests for ambiguous/modally sensitive questions.

## Stress-test scenarios

The feature is not ready until tests cover:

- Negation, double negatives, modality (`should`, `must`, `can`), idioms, and culturally loaded terms.
- Regional variants where the same language has different common meanings.
- Right-to-left layouts and mixed-direction numbers/punctuation.
- Text expansion on narrow screens and large accessibility font sizes.
- Source edits after candidates were generated.
- Translation provider timeout, malformed output, unsupported locale, and quota exhaustion.
- Two workers generating the same locale concurrently.
- A question crossing the UTC publication boundary while translation is incomplete.
- Historical results displaying exactly the wording published during that vote.
- User-submitted text containing instructions intended to manipulate a general AI model.

## Decision gate

Before implementation, choose and document:

1. Launch locales and fallback locale.
2. Dedicated translation provider and optional secondary reviewer/model.
3. Which locales require human approval.
4. Maximum publication lead time and failure behavior.
5. Source-edit/correction policy after voting opens.
6. Measured quality benchmark, monthly budget, quota, and alert thresholds.

Until these are approved, keep English as the only guaranteed locale and keep all translation API
credentials out of the app.
