---
name: ticket-detail-page-conventions
description: Conventions for e2e-testing the ticket detail page (/tickets/:id) without duplicating its component unit tests
metadata:
  type: project
---

The project adopted a policy (CLAUDE.md, "E2E Testing") that e2e specs must not
re-assert what the component unit tests already cover. For the ticket detail
page (`client/src/pages/TicketDetailPage.tsx`, refactored into `TicketDetail`,
`UpdateTicket`, `ReplyThread`, `ReplyForm` sub-components with their own
`*.test.tsx` files), that means e2e specs should skip: label wording,
title-case formatting, dropdown option contents, disabled-while-pending
states, and per-field validation/error copy. Wrote
`e2e/tests/ticket-detail.spec.ts` scoped to only real-browser-plus-real-backend
concerns: auth redirect, cross-page navigation + real data fetch, real 404
round trip, one persistence check per mutation (status/category/assignment),
and one reply create+reload round trip. 7 tests total.

**Why:** Unit tests already mock axios and cover UI-detail correctness fast
and reliably; e2e tests that re-assert the same things are slow, flaky-prone,
and redundant.

**How to apply:** When asked to add e2e coverage for any page that has
sibling `*.test.tsx` unit tests, read those test files first to see what's
already covered, then write only the "requires real browser + real backend +
real session" scenarios: auth/authorization boundaries, cross-page navigation
with real data, real API error responses (404/403), one persistence-after-reload
check per mutation type (not a matrix of every value transition), and any
create-then-refetch round trip (e.g. replies). Aim for a short spec (roughly
6-9 tests), not exhaustive coverage — that's what the unit tests are for.

Key gotchas discovered while writing this spec:
- The inbound-email webhook (`server/src/routes/inbound-email.ts`) responds
  with `{ ticketId, status }`, NOT `{ id }`. `tickets.spec.ts`'s existing
  webhook helper never reads the response body, so this only surfaces when a
  new spec needs the created ticket's id (e.g. to `page.goto` straight to its
  detail page). Local seed helpers must destructure `ticketId` and remap.
- Ticket ids are Prisma `cuid()` strings (`server/prisma/schema.prisma`), not
  UUIDs — an arbitrary string like `does-not-exist-12345` is a valid "not
  found" fixture; no need to generate a cuid-shaped fake id.
- `GET /api/tickets/agents` (`server/src/routes/tickets.ts`) sits inside the
  same router that's wrapped in `requireAuth` at mount time in
  `server/src/index.ts` (`app.use("/api/tickets", requireAuth, ticketsRouter)`)
  — so it needs a logged-in session, but any authenticated role (not just
  admin) can read it.
- The three `UpdateTicket` dropdowns have stable ids to target directly
  instead of role/label lookups: `#ticket-status`, `#ticket-category`,
  `#ticket-assignee`. Their values are the raw enum/id values, e.g.
  `selectOption("resolved")`, `selectOption("technical_question")`.
- The seeded agent's display name is the literal string `"Agent"` (hardcoded
  in `server/src/scripts/seed-agent.ts`, independent of the email env var).
  `e2e/tests/user-management.spec.ts` already established a
  `SEEDED_AGENT_NAME = "Agent"` constant for this — reuse that convention
  rather than re-deriving the agent's id via an extra API call.
- `ReplyForm`'s textarea is reachable via `page.getByLabel("Add a reply")`
  (id `reply-body`); submit button is `page.getByRole("button", { name: "Send reply" })`.
- **Race condition bug found via a real `bunx playwright test` run** (not
  caught during initial writing): the "assigning the ticket to an agent
  persists after reload" test originally did
  `await assigneeSelect.selectOption({ label: SEEDED_AGENT_NAME }); const id =
  await assigneeSelect.inputValue();` — a one-shot read immediately after
  `selectOption`. `UpdateTicket`'s three selects are fully server-controlled
  (`value` bound to the ticket query data, no optimistic local echo), and the
  `onChange` handlers fire `xMutation.mutate(...)` without awaiting it, so the
  DOM briefly still reflects the old value until the PATCH resolves and
  TanStack Query's cache updates. The status/category persistence tests
  already guarded against this correctly with a retrying
  `expect(select).toHaveValue("resolved")` before reloading — the assignment
  test needs the same pattern but can't hardcode the target value (it doesn't
  know the agent's id up front), so the fix is
  `await expect(assigneeSelect).not.toHaveValue("")` (retrying/auto-waiting)
  before capturing `inputValue()`. **General rule for this codebase: never
  read `.inputValue()` right after `.selectOption()` on any of these
  server-controlled selects — always sandwich a `toHaveValue`/`not.toHaveValue`
  expect in between to let the mutation settle first.**
