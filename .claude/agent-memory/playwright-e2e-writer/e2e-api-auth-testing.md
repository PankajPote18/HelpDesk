---
name: e2e-api-auth-testing
description: How to test requireAuth/requireAdmin API boundaries directly (no UI) using the standalone `request` fixture's cookie jar
metadata:
  type: project
---

## Pattern: sign in via raw API call, reuse the `request` fixture for the follow-up call

The standalone `request` fixture (not `page.request`) is its own isolated `APIRequestContext`, but it
**does** maintain its own cookie jar across multiple calls made through the same fixture within one test
(confirmed via Context7 Playwright docs — `APIRequestContext` cookie management). So you can log in with a
raw POST and then immediately reuse `request` for an authenticated follow-up call, no manual cookie header
wiring needed:

```ts
const signInResponse = await request.post(`${SERVER_URL}/api/auth/sign-in/email`, {
  data: { email: "agent@test.com", password: "TestAgent1!" },
});
expect(signInResponse.ok()).toBeTruthy();

const response = await request.get(`${SERVER_URL}/api/users`);
expect(response.status()).toBe(403);
```

Better Auth's `POST /sign-in/email` (mounted under `/api/auth/*`) accepts JSON `{ email, password }` and
returns `200 { redirect, token, user }` with a `Set-Cookie` session cookie on success (confirmed via Context7
Better Auth docs).

**Why hit `SERVER_URL` directly instead of relative paths:** these tests use `SERVER_URL` from
`server/.env.test`'s `BETTER_AUTH_URL` (same dotenv-load pattern as `inbound-email-webhook.spec.ts`), not the
Playwright config's `baseURL` (`http://localhost:5173`, the Vite client). Better Auth cookies must be set on
the server's own origin — see `client/src/lib/auth-client.ts`, which bypasses the Vite proxy for the same
reason. Going through the proxy for these tests risks cookie-domain mismatches; hitting the server directly
sidesteps that entirely.

## Confirmed error shapes

- `requireAuth` failure: `401 { error: "Unauthorized" }`
- `requireAdmin` failure: `403 { error: "Forbidden" }`

(both in `server/src/middleware/auth.ts`)

## Where this lives

`e2e/tests/auth.spec.ts`, "Role-based access" describe block — two tests that used to be `test.fixme()`
pending `/api/tickets` and `/api/users` existing are now active, using this pattern.
