# Hosted testing after OTP setup

Prepared 10 November 2026. These are execution plans with expected outcomes, not claims that hosted tests have passed.

- [Mobile app plan](app.md): OTP/CAPTCHA, account creation and first-device import, logout/reset, one active device, independent account/device duplicate checks, UTC selection, Brewing/review/upvotes, personal history, preferences, sharing, accessibility and operator concurrency checks.
- [Public website plan](website.md): public browsing/filtering/pagination/search, source/aggregate correctness, sharing, PDF/print, display/languages, UTC/cache/outage behavior, public-only APIs and abuse/capacity checks.

## Email delivery: what “permitted recipients” means

Supabase Auth creates/verifies the OTP and owns accounts/sessions. An email service transports the message. The default built-in transport is intended for limited testing and, under its documented policy, restricts recipients to addresses associated with organization team members. Creating a row in Authentication → Users, entering a valid email, verifying an app user or buying Pro template customization does not by itself authorize general outbound email delivery.

Example: your organization-owner email may receive a signup code while a friend's Gmail address is rejected before delivery. Repeating the request or changing template text cannot fix that recipient policy. Do not add ordinary testers to the Supabase organization merely to receive OTPs; that can grant infrastructure access they do not need.

Pro subscription/features, editable email templates, permitted recipients, Auth send throttles, provider quotas and inbox deliverability are separate concerns. Pro is not a promise that Supabase's built-in mail transport accepts arbitrary recipients. Exact limits/available dashboard features change: inspect the current project and [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp), rather than relying on an old numerical limit. No live dashboard/billing policy was inspected for this documentation change.

For outside testers and eventual production, configure a dedicated SMTP provider (for example Resend) and its verified sender/domain in the **hosted test project's** Auth SMTP settings. Supabase still generates and verifies the code; the provider delivers it. Custom SMTP does not inherently require Supabase Pro. It does require correct credentials, sender authorization, configured Auth/provider rates, and bounce/spam monitoring. SMTP acceptance is not a guarantee of inbox delivery; test actual new-account and existing-account messages with real permitted test inboxes at multiple email providers.

Use the same provider account for test/production if it supports that, but configure each Supabase project separately. Prefer separate sending keys/labels and controlled test sender identity so testing errors do not compromise production credentials or reputation. No service/SMTP key goes into the mobile app or public website.

Interpret failure in order: request accepted by Pulse → accepted by Supabase Auth → accepted by mail provider → delivered/bounced → arrived in spam/inbox → correct code verified → post-OTP CAPTCHA → Pulse lease active. Logs identify which stage failed. Never “fix” nondelivery by bypassing OTP/CAPTCHA or marking an email confirmed by hand in a normal user journey.

## Website CAPTCHA decision

**No routine CAPTCHA for the current public read-only website.** Visitors browse public questions/results, search, share and generate PDFs locally. A mandatory challenge adds friction/accessibility and older-device failures without protecting a website write or account endpoint.

Use bounded queries, short public caching, validation and operational monitoring first. Add targeted Cloudflare rate controls/managed challenges only when observed abuse warrants them and the chosen plan supports them. No such new rule is enabled by this document. A read-only site can still create upstream query costs; existing cache/bounds are not a full rate limiter.

If the website later adds forms, subscriptions, login or voting, assess those actions and validate CAPTCHA tokens on the server where appropriate. A challenge on the page alone does not protect direct API calls. Public Supabase endpoints remain public under their database permissions; a website CAPTCHA is not proof of a physical device or a unique person.

App daily votes, signed-in Brewing writes and post-OTP activation keep their existing purpose-bound verification. Post-OTP CAPTCHA does not prevent the earlier email-send request from being spammed; sending-rate controls and any future pre-email step-up must be assessed separately.

## Running the plans

1. Confirm hosted project/build alignment and complete one new-account and one existing-account OTP/CAPTCHA flow.
2. Prepare accounts/devices/fixtures using each plan's setup section; do not reset a hosted database or delete real user data.
3. Record a new run with every case NOT RUN. Execute happy paths, then failures/privacy/quotas, then a real UTC-midnight observation.
4. Record PASS/FAIL/BLOCKED evidence per case. Missing iOS signing, SMTP permission or domain association is a blocker for that case, not a pass.
5. Keep operator security/concurrency and hosted capacity work scoped separately. Capacity tests need agreed request rates/budget before execution; writing these plans does not authorize a production load test.
