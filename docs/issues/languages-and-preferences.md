# Language settings, account preferences, and stored content translations

Update the existing internationalization issue if one exists; do not duplicate the question-translation issue. Link the two issues with the `question-translation` label (create that label if absent).

Requested languages, as explicitly chosen by the owner: English (`en`), Mandarin Chinese (`zh-Hans`, simplified script initially), Hindi (`hi`), Spanish (`es`), Modern Standard Arabic (`ar`), French (`fr`), Bengali (`bn`), Portuguese (`pt`), Russian (`ru`), Urdu (`ur`). This is the owner's launch selection, not a claim that these are the ten largest individual languages by native speakers. Regional/script variants can follow.

Implemented in this change:

- Settings language selector with native language names; immediate static UI, navigation, accessibility labels, dates, numbers and countdown language changes. Arabic/Urdu use right-to-left text and layout. Vote values and stored content are never translated by dictionary substitution.
- Guest theme/language stored in SQLite on the current app installation. Clearing app storage removes guest settings; a different device starts with defaults. Current appearance remains after logout.
- Account language/theme saved in `user_preferences` through owner-checked, authenticated RPCs; restored at sign-in on another device. New-device defaults never replace existing account settings. Pending offline edits retry on reconnect/foreground and update only edited fields. The same-field last successful write wins; multi-device session exclusion is a separate issue.
- Existing device theme migrates forward. Whitelisted values, strict owner validation, no public preference-table access, per-project/account pending cache, explicit sync status/retry.
- Today/final results request the selected content language. Missing stored question translations fall back to original text, without disguising fallback as translated content.

Remaining content translation requirement (link T11 / existing AI-question issue):

- Keep original question, detected source language, immutable source revision and human correction provenance. Translate using one server-side AI provider into all supported languages, persist reviewed/selected versions in `question_translations`; never translate on every app read. No provider key in app builds.
- Community submissions can use any language. Automatically promoted submissions currently carry `source_language='und'` until source-language detection/content translation is implemented. An app-language preference is not proof of the language someone typed.
- Announcements use the same supported locale policy but a separate revisioned content table/workflow. Publishing requires complete translations or an explicit visible original-language fallback policy.
- Human linguistic review, Android/iOS large-text and screen-reader testing, RTL checks, mixed-script content, localized email templates/CAPTCHA provider language and regional variants remain release checks. Provider-generated diagnostics are not guaranteed to be localized by the static UI catalog.

Acceptance: all static message catalogs have matching keys and interpolation placeholders; switching language does not change question IDs, vote choices or receipt identity. Guest restart, sign-out, account switch, cross-device restore, offline edit/restart/reconnect, stale responses and independent-field updates pass. Static-string internationalization and AI-generated question translation have separate acceptance and deployment status.
