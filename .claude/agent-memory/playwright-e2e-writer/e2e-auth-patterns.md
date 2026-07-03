---
name: e2e-auth-patterns
description: Auth test patterns established in auth.spec.ts — loginAs helper, locator conventions, redirect chains, Better Auth error messages
metadata:
  type: project
---

## loginAs helper (defined in auth.spec.ts, not a shared fixture yet)

```typescript
async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}
```

No shared fixture file exists yet. If multiple spec files need login, extract to `e2e/fixtures.ts`.

## Key locators confirmed from source

- Email field: `page.getByLabel("Email address")` (label `for="email"` → `<Input id="email">`)
- Password field: `page.getByLabel("Password")` (label `for="password"` → `<Input id="password">`)
- Submit button: `page.getByRole("button", { name: "Sign in" })`
- Sign-out button: `page.getByRole("button", { name: "Sign out" })` (in Navbar)
- Admin nav link to /users: `page.getByRole("link", { name: "Users" })` (Navbar, admin-only)

## Client-side zod validation error messages

- Empty/invalid email: `"Enter a valid email address"`
- Empty password: `"Password is required"`

## Better Auth error messages

- Wrong password or unknown email: `"Invalid email or password"` (error code `INVALID_EMAIL_OR_PASSWORD`, status 401)
- These surface via `ctx.error.message` → `setServerError(...)` → rendered in the error `div`

## Redirect chains

- Unauthenticated visiting `/` → ProtectedRoute → `/login`
- Unauthenticated visiting `/users` → AdminRoute → `/` → ProtectedRoute → `/login`
- Agent (authenticated) visiting `/users` → AdminRoute checks role → `/` (home, not /login)
- Admin route guard redirects to `/`, NOT `/login`, for non-admins

## Server routes

`/api/auth/*` (Better Auth), `GET /api/health` (unprotected), `/api/tickets` (`requireAuth`, any role),
`/api/users` (`requireAuth` + `requireAdmin`), `/api/webhooks/inbound-email` (shared-secret header, no session).
The two API-level 401/403 boundary tests that used to be `test.fixme()` in `auth.spec.ts` ("Role-based access"
describe block) are now active — see [[e2e-api-auth-testing]] for the implementation pattern.

## HomePage was removed — "/" now renders TicketsPage

As of the tickets-list-page feature, `client/src/pages/HomePage.tsx` no longer exists. `App.tsx` routes `"/"`
directly to `<ProtectedRoute><TicketsPage /></ProtectedRoute>`. TicketsPage renders a real `<h1>Tickets</h1>`.

**Why it matters:** Several tests across `auth.spec.ts` and `user-management.spec.ts` used to assert
`page.getByRole("heading", { name: "Welcome to Helpdesk" })` after a redirect to `/` — that heading is gone.
All such occurrences in `auth.spec.ts` were updated to assert `{ name: "Tickets" }` instead.

**How to apply:** Before writing any new test that lands on `/` post-login/redirect, check `client/src/App.tsx`
for the current route table rather than assuming HomePage still exists — this is exactly the kind of drift that
breaks tests silently until the suite is actually run.

## CardTitle is a `<div>`, not a heading

`client/src/components/ui/card.tsx` renders `CardTitle` as `<div data-slot="card-title">`.
Use `page.getByText("...")` not `getByRole("heading")` for card titles.
`<h1>` headings exist on TicketsPage ("Tickets") and UsersPage ("Users") — those DO use `getByRole("heading")`.

**Why:** Avoids selector failures from assuming semantic heading nesting inside shadcn Card.
**How to apply:** Always read the card.tsx component before asserting on card titles.
