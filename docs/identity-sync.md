# Optional account and voting-history sync

## Product rule

PULSE remains usable without an account. An account is an optional continuity feature for people
who want their answered-question history to survive device replacement. Email authentication is
sufficient for this purpose. First and last name add personal data without improving sync, so they
must not be required; a display name can be an optional profile feature later.

The corresponding user-facing flows and safe public-attribution rules are documented in
[`account-auth-ux.md`](./account-auth-ux.md).

## Data authority

The server-accepted vote is authoritative. Device storage is a cache of question IDs, choices, and
server vote IDs—not a second mutable vote database. Voting requires connectivity, so an unconfirmed
local record must never be uploaded later as if the server had accepted it.

## Link and merge transaction

After email ownership is verified, a server-side transaction must:

1. Identify the caller from `auth.uid()`; never accept an account ID supplied by the client.
2. Verify the current installation credential.
3. Find server-accepted votes belonging to that installation but not yet linked to an account.
4. Link votes for questions the account has not answered.
5. For a duplicate question, keep the vote already attached to the account. Never overwrite an
   established account vote with a newly linked device vote.
6. Record the merge in an audit table and return the complete canonical answered-question history.
7. Replace the device cache atomically with that canonical response.

On every later login, the client downloads the canonical account history and merges it into its
cache by immutable question ID. Signing out clears account-derived cache entries from that device
but does not delete server history.

## Constraints required before implementation

- One account vote per question: a partial unique index on `(auth_user_id, question_id)` where the
  account ID is not null.
- One installation vote per question, enforced by the server rather than only local storage.
- Row-level security that exposes account-linked history only to `auth.uid()`.
- Email verification before an installation can be linked.
- A defined account deletion flow that removes profile data and either deletes or irreversibly
  anonymizes account linkage according to the published privacy policy.
- Idempotent merge requests so interrupted logins can retry safely.

Do not implement generic two-way last-write-wins sync for votes. Votes are immutable submissions;
allowing a device copy to overwrite an account copy would create both integrity and abuse problems.
