# T17 — Server-verified Play Integrity and App Attest: implementation and owner setup

Status: planned; Android ID/IDFV, receipt recovery and database uniqueness are intermediate controls, not attestation. This issue extends the existing T17 requirement rather than creating another competing security policy.

## Work the coding agent can implement

1. Verify the maintained Expo/native integrity module against this repository's Expo SDK, then add native configuration and a Play-internal EAS profile. Expo Go cannot provide this verification.
2. Issue short-lived, single-use server challenges bound to the complete vote payload, account/install identity and idempotency key. Persist consumption/replay state transactionally; never trust client success flags.
3. Android: obtain a Standard integrity token with the request hash; decode on the server using Google-authorized credentials. Check package, allowed Play signing certificate, PLAY_RECOGNIZED, LICENSED, MEETS_DEVICE_INTEGRITY, binding and freshness. Reject unsupported form factors and invalid verdicts.
4. iOS: register an App Attest key using attestation, then use assertions. Validate the official Apple trust chain, app identity, environment, challenge, signature and increasing counter. Persist key association, revocation and replay state. Verify using trusted public Apple roots; an Apple API private key is not needed solely to verify App Attest. DeviceCheck, if separately adopted, has different API credentials.
5. Keep vote/account/fingerprint uniqueness and CAPTCHA. Add quota/outage handling, privacy-safe telemetry, automated malformed/replayed/wrong-app tests, physical-device tests and reviewed production rollout controls. Do not silently bypass attestation in production.
6. Add developer diagnostics that distinguish wrong signing, Play licensing, unsupported device, quota and provider outages without logging tokens. Use observe-only staging before reviewed enforcement; production fail-closed protects writes while reads remain available.

## Android owner steps (do these in your accounts)

1. Create/confirm a Google Play Console developer account and an app with this exact package: com.pulse.worldtoday. Confirm ownership of the package before changing identifiers.
2. In Google Cloud Console create/select a dedicated project. In Play Console > app > App integrity > Play Integrity, link that Cloud project following Google's setup flow. Enable the Play Integrity API in the linked project if prompted. Record the project number (non-secret).
3. Configure Play App Signing. Record the SHA-256 fingerprint of the **app signing certificate**, not merely the upload key/EAS local signing certificate. The server must allow the certificate installed by Play. Coordinate signing-key rotation rather than replacing allowed digests blindly.
4. Create the server identity authorized to call the Play Integrity decode API in the linked project, with least-privilege permissions. Use a supported server workload identity or, if a JSON service-account key is necessary for the deployment, enter it through secure Supabase configuration after the agent provides the exact secret binding. Never paste keys in chat, Expo public variables or Git.
5. Once the native implementation is ready, use a Play-internal EAS profile that extends preview but sets distribution=store, environment=preview and android.buildType=app-bundle. The agent will supply that profile with the integration PR. Build with `npx eas-cli@latest build --platform android --profile play-internal`.
6. Upload the AAB to Play Console > Testing > Internal testing. Add tester Google accounts and publish the internal release. Each tester must accept the opt-in link and install from Play using the enrolled account. A sideloaded preview APK does not establish the intended licensing/recognition path.
7. Provide the project number, package and signing certificate fingerprint to the agent; these are non-secret. Run physical-device canaries, then test modified builds, wrong signing, replay, offline/provider outages and data clearing. Approve enforcement only after reviewing false rejections and accessibility/support impact.

## iOS owner steps (after Apple enrollment)

1. Enroll in Apple Developer, confirm the Team ID and register com.pulse.worldtoday under the intended team.
2. Enable the App Attest capability for the identifier/provisioning setup as required by Apple's current tooling. Let the agent add the matching entitlement/config plugin; regenerate provisioning profiles after entitlement changes.
3. Register physical tester iPhones for internal development distribution or configure TestFlight for store distribution. App Attest is not a simulator/Expo Go verification path.
4. Use EAS signing with the intended team and the integration's build profile, then install that signed build on supported physical iPhones. The entitlement environment, signed application identity and server expectations must agree; do not mix development and production attestations.
5. Share only Team ID/bundle ID and non-secret diagnostics. App Attest verification itself needs trusted public roots and app configuration; do not create or send a .p8 key for it. If optional DeviceCheck is later added, configure its separate credentials securely at that stage.
6. Run registration, assertion, replay, counter, app-data clearing, reinstall, key-loss, unsupported-device and outage tests. After staging review, enable the approved production policy.

## Acceptance and limitations

- Genuine approved physical-device builds can vote; replay, payload substitution, forged app identity and unverifiable verdicts cannot authorize writes.
- Tests prove the complete client/server binding and denial paths, with privacy-safe operations evidence.
- Neither platform supplies a general permanent device identifier or unlimited reinstall-persistent per-question history. DeviceCheck/device recall are optional additional signals, not a guarantee or sole launch dependency. Keep database uniqueness and be explicit about residual limits.
- No one-human-one-vote claim. Requiring durable identity for daily voting is a separate product decision; verified account is already required for community submissions/upvotes.

Official setup references:
- https://developer.android.com/google/play/integrity/setup
- https://developer.android.com/google/play/integrity/standard
- https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity
