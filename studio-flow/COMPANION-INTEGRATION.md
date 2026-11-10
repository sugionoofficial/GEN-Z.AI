# STUDIO FLOW Windows companion: safe integration boundary

## Current state

The website scaffold does not generate images or videos and does not communicate with Google Flow. The Generate buttons stay disabled until a companion is implemented and connected. This is deliberate: the repository does not establish a supported Google Flow generation API, and this feature must not depend on undocumented endpoints, copied Armagic internals, browser cookies, or Google passwords.

## Recommended companion architecture

1. Ship a signed Windows companion plus a narrowly scoped browser extension/native-messaging host. The companion must be user-installed and explicitly paired to the user's GEN-Z.AI account. Do not make the public web page call `localhost` or `127.0.0.1`; besides failing in proxied previews, an unauthenticated loopback listener creates a browser-to-local-network attack surface.
2. Restrict extension messaging to the exact production GEN-Z.AI origin and the signed extension ID. Pair with a short-lived, one-use code issued by the authenticated backend; bind the resulting device record to the authenticated user, expire/revoke it, and never treat a client-supplied user ID as identity.
3. Send versioned, schema-validated task envelopes with an idempotency ID, media kind, prompt, model/options, and bounded image references. Require a visible user confirmation in the companion before submitting a task. Reject unknown fields, oversized payloads, and unsupported models/options.
4. Use Google Flow only through a Google-supported integration if one becomes available, or through a user-visible workflow that Google explicitly permits. Do not use private network endpoints, steal/replay session cookies, read browser profiles, or attach to Chrome's debugging protocol. If the Flow interface cannot be automated under documented terms, keep generation manual rather than bypassing that boundary.
5. Keep Google sign-in and Flow session data in the user's browser. The companion must never request a Google password or export cookies. Do not upload prompt references or generated media without explicit user consent.
6. Persist task metadata in `studio_flow_history` under the authenticated owner's ID. The current table intentionally stores no inline media; before durable private previews are added, use an owner-scoped private Storage bucket and signed URLs rather than public object links. Limit and expire signed URLs.
7. Return task status/results through authenticated, user-scoped server routes. The webpage should never trust task owner IDs, bridge status claims, arbitrary callbacks, or result URLs without validation. Add pairing revocation, rate limits, request signing/replay protection, and an audit trail before enabling Generate.

## Deployment checklist before enabling Generate

- Review Google Flow's current supported integration options and applicable terms; record the approved mechanism.
- Build/sign the Windows app and extension/native host; pin the production extension ID and permitted site origins.
- Add expiring device-pairing and task-relay routes with owner checks; do not rely on UI-side authorization.
- Apply `20261110065601_studio_flow_history.sql` to Supabase and verify owner isolation using two independent test users.
- Add explicit consent and retry behavior, test disconnect/revoke, malformed messages, replayed task IDs, and large uploads.
- Enable buttons only after the companion handshake and server-side subscription check both succeed.
