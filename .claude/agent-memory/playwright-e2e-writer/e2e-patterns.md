---
name: e2e-patterns
description: Established Playwright patterns in this project — login helper, modal scoping, seeded data facts, and test isolation approach
metadata:
  type: project
---

## Login helper

`loginAs(page, email, password)` is defined at the top of `e2e/tests/auth.spec.ts`. New test files should define their own scoped helper or import it. The pattern is:
```ts
await page.goto("/login");
await page.getByLabel("Email address").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("/");
```

## Seeded test data (from .env.test + seed scripts)

- Admin: email `admin@test.com`, password `TestAdmin1!`, name `"Admin"`, role `admin`
- Agent: email `agent@test.com`, password `TestAgent1!`, name `"Agent"`, role `agent`
- Edit icon button aria-label pattern: `"Edit {user.name}"` (e.g., `"Edit Agent"`)

## Modal scoping pattern

UsersPage modals are inline `div` overlays (not native `<dialog>`), so `getByRole("dialog")` does NOT work. The h2 heading is a direct child of the modal card div. Use:

```ts
const modalCard = page.getByRole("heading", { name: "Modal Title" }).locator("xpath=..");
await modalCard.getByLabel("Name").fill(value);
await modalCard.getByRole("button", { name: "Submit" }).click();
```

This is necessary when the same button text appears both in the page body and inside the modal (e.g., "Create user" button exists on the page header AND as the modal submit button).

## Table row scoping

To scope a button click to a specific row (e.g., Delete button per row):
```ts
const row = page.getByRole("row").filter({ hasText: userEmail });
await row.getByRole("button", { name: "Delete" }).click();
```

## Test isolation approach

- `fullyParallel: false` — tests run sequentially within a run
- Each test gets an isolated browser context (no shared cookies/storage)
- The DB is NOT reset between individual tests within a run — only before the full suite via `global-setup.ts`
- Tests that mutate data should use unique emails (`Date.now()`) and avoid permanently modifying seeded users
- Delete tests: create a throwaway user within the test rather than deleting the seeded agent

## Modal heading → card relationship (UsersPage.tsx)

- Create: h2 "Create agent" → parent is the card div containing the form and all buttons
- Edit: h2 "Edit user" → parent is the card div
- Delete: h2 "Delete user" → parent is the card div (max-w-sm)

## beforeEach pattern

When all tests in a describe block share the same setup (e.g., login + navigate to /users), use `test.beforeEach` at the describe level.

**Why:** Reduces duplication. Confirmed working in `user-management.spec.ts`.

**How to apply:** Put login + navigation in `beforeEach`; individual tests start from the expected page state.
