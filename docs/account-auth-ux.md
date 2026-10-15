# Optional account and authentication UX

**Status:** The email-code session, device-only nickname, contextual prompts, and local logout UX
are implemented as an authentication foundation. Cross-device history, vote ownership, question
ownership, notifications, and account deletion remain blocked on the secure server-side voting and
canonical merge work below. The UI must not claim those capabilities are active yet.

## Product position

PULSE is anonymous-first. An account is never required to read, vote, or view public finalized
results. It exists to provide continuity and optional creator benefits:

- restore answered-question history on another device;
- preserve submitted questions across reinstalls/devices;
- receive an email or push notification when a submitted question is selected;
- show personal My Pulse insights from canonical history;
- optionally add an approved public nickname to a shared result.

Do not ask for a legal/full name. It adds sensitive personal data without helping authentication,
history merge, recovery, or notifications—especially risky for a youth audience. A nickname is a
separate optional profile field and is not a login identifier.

## Reject the proposed account-existence flow

The proposed flow—enter an ID, reveal whether it exists, then show either password or account
creation—creates an account-enumeration oracle. Attackers can test emails, usernames, or phone
numbers and learn who uses PULSE. It also produces surprising behavior when a person mistypes their
email: instead of a failed login, the UI invites them to create a second account.

Do not use a nickname as the ID. Nicknames are public-facing, changeable, moderation-sensitive,
subject to impersonation and Unicode-confusable attacks, and poor recovery credentials.

## Recommended authentication method

### Preferred: one-time email code

Use one screen:

1. Heading: **Keep your Pulse**
2. Copy: **Save your voting history and questions across devices. Optional, always.**
3. Field: **Email**
4. Primary action: **Email me a code**
5. Secondary action: **Not now**
6. Next screen: six-digit code and **Verify**

Use the same outward response whether or not the email already has an account. The verified flow can
create a new account or sign in an existing one without disclosing account existence. A code avoids
password creation, confirmation, memory, and reset flows. It also avoids dependence on email-link
handling for the primary UX, although deep/universal links may be added as a convenience.

This requires production SMTP, branded email templates, resend countdown, expiry handling, rate
limits, abuse protection, and generic responses. Supabase's built-in trial email service is not a
production delivery system.

### If passwords are a firm requirement

Use explicit **Sign in** and **Create account** modes. Do not infer the mode by checking whether an
email exists.

**Sign in**

- Email
- Password with show/hide control
- **Sign in**
- **Forgot password?**
- **Create account** text link

**Create account**

- Email
- Password
- Confirm password
- Password requirements shown before submission
- **Create account**
- **Already have an account? Sign in**

After verified account creation, offer optional nickname setup on a separate skippable screen. Do
not put full name or nickname on the sign-in form. Authentication should ask only for authentication
data.

## Password reset UX

1. Screen title: **Reset your password**
2. Ask only for email.
3. Action: **Send reset instructions**
4. Always show: **If an account exists for this email, we sent reset instructions.**
5. Offer **Back to sign in** and a rate-limited resend action.
6. Reset link opens the app through a configured universal/deep link.
7. Authenticated reset screen asks for new password and confirmation, then revokes other sessions if
   the user chooses.

Never report “email not found.” Supabase deliberately returns a non-revealing password-reset result;
the UI must preserve that protection.

## Entry points: where account prompts belong

Use contextual prompts, not repeated login banners.

### Primary, persistent entry

Add an **Account** section in Settings. Signed out: **Sign in or create account**. Signed in: email,
optional nickname, notification preference, **Log out**, and **Delete account**. This is the one
predictable place where account controls always exist.

### Contextual entry points

- **My Pulse:** strongest prompt—**Keep your history and unlock insights across devices.**
- **Brewing Questions:** after the user starts/submits a question—**Save this question and know if it
  goes live.** Do not block drafting; require verified identity only at final submission if abuse
  prevention demands it.
- **Past Results:** keep the existing subtle card—**Changing phones someday? Keep your voting
  history.**
- **After a confirmed vote:** one quiet text action—**Keep this vote across devices**. Show at most
  occasionally; never interrupt the vote receipt with a modal.

Do not put a prominent sign-in call to action above today's question. It competes with the single
daily action and makes optional accounts feel mandatory. About may explain accounts but does not
need another button. The drawer may show a compact signed-in identity footer later, but Settings
remains the canonical account-management destination.

## Account creation completion

After email verification:

1. Merge server-accepted installation history into the account using the canonical merge transaction.
2. Show progress: **Bringing your Pulse with you…**
3. Show result: **12 answers and 2 questions are now protected.**
4. Offer optional nickname: **What should PULSE call you?** with **Skip**.
5. Ask separately whether to notify the user when their question is selected.
6. Return to the context that initiated authentication.

Do not claim local votes were saved unless the server confirms the merge. Never use client-side
last-write-wins behavior for immutable votes.

## Logout UX

Account section action: **Log out**. Confirmation copy:

> Log out on this device? Your account history stays safe. Personal account data cached on this
> device will be removed. You can keep using PULSE without an account.

On confirmation:

- revoke/end the local Supabase session;
- stop auth token refresh;
- clear account-derived history, profile, and private submission cache;
- retain only anonymous/device data that the privacy policy explicitly permits;
- return to the same screen in signed-out mode.

Do not describe logout as deleting history. Account deletion is a separate, destructive flow with
reauthentication and clear vote-anonymization/deletion semantics.

## Notifying a question author

Use two independent channels:

1. **Verified account email:** durable across device changes; recommended default for selected-
   question notices.
2. **Push token tied to a server-issued submission receipt:** useful for anonymous users on the same
   installation, but it can be lost after uninstall, token rotation, or device replacement.

The submission stores an internal owner account ID or opaque installation/submission ID. Public APIs
must not expose email, auth user ID, installation token, or device fingerprint. If an anonymous user
loses the installation credential, PULSE cannot safely recover ownership; explain that before final
submission and offer optional account linking.

## Identity on shared result snapshots

Never print a unique device ID, device fingerprint, installation ID, auth UUID, or email on a share
image. These are security/privacy identifiers, not display names. Publishing one creates a stable
cross-share tracking token and teaches users to expose an identifier the backend may rely on.

Recommended attribution:

- Default: **My PULSE · 14 Oct 2026** (no identifier).
- If an account has a nickname and the user explicitly enables attribution for that share:
  **@nickname · My PULSE**.
- For selected community questions, default public credit is **Community question**. Offer
  **Credit me as @nickname** only as an explicit per-question opt-in, subject to moderation.

Nicknames need length and character rules, case-insensitive uniqueness only if `@nickname` is meant
to be addressable, reserved-name protection, profanity/impersonation moderation, Unicode-confusable
handling, change limits, and a fallback when a nickname is removed. If those operations are not
ready, use non-unique display names without `@` and do not imply identity uniqueness.

## Required states and edge cases

- Offline, timeout, 429/rate-limited, invalid/expired code, wrong password, and email delivery delay.
- Email entered with case/whitespace differences.
- Existing account with an unverified email.
- Login on a second device containing overlapping answered questions.
- Interrupted/idempotent history merge and deterministic duplicate-vote conflict handling.
- Deleted/banned account, changed email, lost email access, and session revoked remotely.
- Nickname collision, moderation rejection, rename, and account deletion.
- Shared device logout and complete removal of private cached account data.
- Child/youth privacy review, age requirements, consent, retention, export, and deletion obligations
  for every launch country—not just the database design.

## Recommended implementation order

1. Finish secure server-confirmed vote receipts and installation credentials.
2. Finish canonical account-history merge and account-only RLS tests.
3. Configure production SMTP, redirect URLs, email templates, rate limits, and CAPTCHA/abuse controls.
4. Implement auth session provider and foreground token refresh.
5. Implement email-code sign in (or explicit password sign-in/create modes if approved).
6. Implement reset/deep-link handling only if password auth is selected.
7. Add Settings account management and logout/cache cleanup.
8. Add contextual prompts in My Pulse, Brewing Questions, Past Results, and occasional vote receipts.
9. Add nickname/profile moderation and opt-in share attribution last.

Authentication is not the next coding step merely because the Supabase client now connects. The
server-side identity, merge, notification ownership, privacy, and abuse contracts must be approved
first.

## Dashboard setup for the implemented email-code foundation

1. In Supabase, open **Authentication → Providers → Email** and keep email authentication enabled.
2. Open **Authentication → Email Templates → Magic Link**. Include `{{ .Token }}` in the template;
   the app verifies this six-digit token rather than relying on the magic-link redirect.
3. Configure a production SMTP provider before inviting real users. Supabase's default sender is
   for limited testing, not production delivery.
4. Configure Auth rate limits and CAPTCHA before public launch. A resend timer in the client is only
   UX; it is not an abuse boundary.
5. Test a new email and an existing email. Both must show the same outward flow: email → code →
   verified account. The client deliberately does not check whether an account exists.
6. Test expiry, invalid code, delayed email, offline, app background/foreground, logout, and restart
   on physical Android and iOS devices.

The current foundation uses `shouldCreateUser: true`, so a verified code signs in an existing user
or creates a new one. Nicknames use device storage keyed by the authenticated user ID and are
deleted from that device at logout. They are never written to Supabase.
