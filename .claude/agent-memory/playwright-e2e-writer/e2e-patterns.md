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

## Ticket creation has no UI yet — seed via the inbound-email webhook

There is no ticket-creation UI. The only way to get a ticket into the DB (outside of raw SQL) is
`POST /api/webhooks/inbound-email` with header `X-Webhook-Secret: <INBOUND_EMAIL_WEBHOOK_SECRET>` and body
`{ from, fromName?, subject, body, messageId, inReplyTo? }` → `201 { ticketId, status: "created" }`.
`e2e/tests/tickets.spec.ts` mirrors the `postInboundEmail`/`uniqueMessageId` helper pattern from
`inbound-email-webhook.spec.ts` (own local copy, not imported — each spec file defines its own helpers per
existing convention) to seed fixtures for UI-level assertions on `TicketsPage`.

## TicketsPage (mounted at "/") — table row locator conventions

- `<h1>Tickets</h1>` — real heading, use `getByRole("heading", { name: "Tickets" })`.
- Columns: Subject, Requester, Status, Assigned to, Created — `getByRole("columnheader", { name: ... })`.
- Row scoping: `page.getByRole("row").filter({ hasText: uniqueSubject })` (same pattern as user-management's
  email-based row scoping) — use a unique, timestamp-suffixed subject per test since the DB is not reset
  between spec files in the same run.
- Requester cell text is exactly `"{name} <{email}>"` when `requesterName` is set, else just the bare email.
- Status cell renders the raw enum text (`open`/`resolved`/`closed`) as a badge `<span>` — `row.getByText("open", { exact: true })` works since no other cell text collides.
- Assigned cell renders `"Unassigned"` when `assignedTo` is null (no assignment UI/API exists yet, so this is the only case currently testable).
- Created cell is `new Date(createdAt).toLocaleDateString()`. To assert this without Node/Chromium
  locale-timezone drift, compute the expected string **inside the browser** via
  `await page.evaluate(() => new Date().toLocaleDateString())` rather than in the Node test process.
- Sort order (`orderBy: { createdAt: "desc" }`, newest first): create two tickets sequentially (awaited, not
  parallel) via the webhook, wait for both rows to be visible, then compare index via
  `(await page.getByRole("row").allTextContents()).findIndex(...)` rather than asserting on absolute row
  position (other spec files may have left rows in the table).

## Gotcha: JS default parameters do NOT distinguish `undefined` from omitted

`inbound-email-webhook.spec.ts`'s `postInboundEmail(request, body, secret = WEBHOOK_SECRET)` originally used
`secret: string | undefined` with `undefined` as the "omit this header" sentinel. Explicitly passing
`postInboundEmail(request, body, undefined)` still triggers the default parameter — it's indistinguishable
from omitting the third argument entirely — so the "missing X-Webhook-Secret header" test was silently
sending the *real* secret and asserting a 401 that could never happen (bug shipped, only surfaced once the
suite was actually run end-to-end). Fixed by using `null` as the explicit-omission sentinel instead
(`secret: string | null = WEBHOOK_SECRET`, check `secret !== null`) — `null` never triggers a default
parameter.

**How to apply:** Never use `undefined` as a caller-facing "omit this" sentinel on a parameter that also has a
default value. Use `null` (or a distinct sentinel value) instead.

## Gotcha: modal overlays don't remove the underlying page content from the DOM

UsersPage's delete-confirmation modal is an overlay `div`, not a native `<dialog>` — the table row behind it
stays in the DOM. `page.getByText(name)` after opening the modal matches **both** the still-present table
cell and the modal's own confirmation text, which is a strict-mode violation (multiple elements). Always
scope post-modal-open assertions to the modal card locator (`heading.locator("xpath=..")`), never a bare
page-level `getByText`, for any text that might also appear in the underlying page.
