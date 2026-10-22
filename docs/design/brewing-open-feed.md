# Brewing layout rethink: an open feed

The recommended phone layout is a single shared surface of question rows, separated by quiet dividers. It replaces heavy individually outlined cards while keeping a comfortable reading width. The interactive exploration is `brewing-open-feed.html`; its layout selector compares the recommendation with a two-column grid at 360/390/430 px and larger text sizes.

The primary hierarchy:

1. “Brewing questions” and a brief invitation explaining the 00:00 UTC changeover. Remove duplicated section headings and lengthy rule paragraphs above the list.
2. One clear “Ask a question” action. Guests get an invitation to sign in; the underlying guest browsing remains available.
3. Compact sort/filter controls. Most upvoted remains the default; other existing server options stay unchanged. Pull-to-refresh remains in the app, with an optional accessible refresh icon.
4. Each row leads with the complete question. Beneath it is a quieter absolute submission timestamp in UTC and, when appropriate, “Your question”. A consistent trailing control combines the up arrow and readable count, with a sufficiently large touch target. It mirrors with RTL layout.
5. Own/upvoted/allowance-used states remain explained and accessible; counts do not need to disappear or become hard to read simply because another upvote is unavailable. A short confirmation after success explains the next 00:00 UTC allowance reset.
6. Moderator removal remains secondary and appears only to authorized users; its reason/confirm/cancel audit flow remains unchanged. There is no public clutter from moderator controls for other users.

Short questions make a more compact feed appropriate, but a character cap alone does not promise a fixed line count: screen width, ten supported languages, translations and accessibility text settings still matter. The grid comparison demonstrates its narrower reading width and uneven cell heights without hiding or truncating question text. Avoid ranking questions by visual size; generous row spacing helps each one receive attention. A wider tablet layout can be considered separately.

The current app/database limit remains 280 characters. A future lower cap needs one agreed policy enforced by both client and server, clear counting semantics for Unicode, and a decision about existing questions/translations. This design pass does not silently choose or change it.

Prototype scope: sample questions/counts/timestamps, local filtering/sorting and a simulated single upvote. It sends no network requests, makes no actual vote/moderation/authentication changes, and is not a production replacement screen. It is a concrete reviewable proposal for the end-user experience.
