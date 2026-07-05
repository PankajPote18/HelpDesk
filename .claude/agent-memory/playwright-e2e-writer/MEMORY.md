# Playwright E2E Writer — Memory Index

- [Auth test patterns](e2e-auth-patterns.md) — loginAs helper, confirmed locators, Better Auth error messages, redirect chains, HomePage→TicketsPage route change, CardTitle caveat
- [E2E Patterns](e2e-patterns.md) — modal scoping, row scoping, TicketsPage table locators, webhook-seeding pattern, `undefined`-default-param gotcha, modal-overlay strict-mode gotcha
- [API auth testing](e2e-api-auth-testing.md) — testing requireAuth/requireAdmin directly via the `request` fixture's cookie jar + Better Auth sign-in endpoint
- [Ticket Detail Page Conventions](ticket-detail-page-conventions.md) — don't duplicate unit-test coverage; webhook response is `{ticketId}` not `{id}`; seeded agent name; dropdown ids
