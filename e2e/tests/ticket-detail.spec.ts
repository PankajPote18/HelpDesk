import { type Page, test, expect, type APIRequestContext } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

// Tickets are only creatable today via the inbound-email webhook (no ticket
// creation UI exists yet), so this file seeds its fixtures the same way
// tickets.spec.ts and inbound-email-webhook.spec.ts do: hit the webhook
// directly with the shared secret loaded from server/.env.test. Kept as a
// local copy per tickets.spec.ts's own convention rather than a shared import.
dotenv.config({ path: path.resolve(__dirname, "../../server/.env.test") });

const SERVER_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const WEBHOOK_URL = `${SERVER_URL}/api/webhooks/inbound-email`;
const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error(
    "INBOUND_EMAIL_WEBHOOK_SECRET is not set in server/.env.test — required for ticket-detail.spec.ts"
  );
}

/** Name assigned to the seeded agent by seed-agent.ts (see user-management.spec.ts). */
const SEEDED_AGENT_NAME = "Agent";

/** Builds a unique RFC-5322-ish Message-Id so tickets created by this file
 * never collide with tickets left behind by other spec files in the same
 * suite run (the DB is only reset once, in global-setup.ts, before the
 * whole run — not between individual tests or spec files). */
function uniqueMessageId(label: string) {
  return `<${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example.com>`;
}

function postInboundEmail(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post(WEBHOOK_URL, {
    headers: { "X-Webhook-Secret": WEBHOOK_SECRET! },
    data: body,
  });
}

/** Seeds a ticket via the inbound-email webhook and returns its id. The
 * webhook responds with `{ ticketId, status }` (see
 * server/src/routes/inbound-email.ts), not `{ id }`. */
async function seedTicket(
  request: APIRequestContext,
  overrides: { subject: string; from?: string; fromName?: string; body?: string }
): Promise<{ id: string }> {
  const response = await postInboundEmail(request, {
    from: overrides.from ?? "detail-test@example.com",
    fromName: overrides.fromName,
    subject: overrides.subject,
    body: overrides.body ?? "Default body for ticket detail e2e fixtures.",
    messageId: uniqueMessageId("detail"),
  });
  expect(response.status()).toBe(201);
  const { ticketId } = (await response.json()) as { ticketId: string; status: string };
  return { id: ticketId };
}

/**
 * Logs in via the UI and waits for the post-login redirect to '/', which
 * renders TicketsPage.
 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}

test.describe("Ticket detail page", () => {
  // ---------------------------------------------------------------------------
  // Access control
  // ---------------------------------------------------------------------------
  test.describe("Access control", () => {
    test("unauthenticated visit to /tickets/:id redirects to /login", async ({ page, request }) => {
      // Mirrors tickets.spec.ts's "unauthenticated visit to / redirects to
      // /login" — the guard itself is covered in depth by auth.spec.ts; this
      // just confirms the detail route inherits the same ProtectedRoute.
      const ticket = await seedTicket(request, { subject: `Access control fixture ${Date.now()}` });

      await page.goto(`/tickets/${ticket.id}`);
      await expect(page).toHaveURL("/login");
    });
  });

  // ---------------------------------------------------------------------------
  // Navigation + real data fetch
  // ---------------------------------------------------------------------------
  test.describe("Navigation", () => {
    test("clicking a ticket's subject in the list navigates to its detail page with real data", async ({
      page,
      request,
    }) => {
      const subject = `Navigation fixture ${Date.now()}`;
      const ticket = await seedTicket(request, {
        subject,
        from: "navfixture@example.com",
        fromName: "Nav Fixture",
        body: "This body should render on the detail page after navigation.",
      });

      await loginAs(page, "agent@test.com", "TestAgent1!");

      await page.getByRole("link", { name: subject }).click();
      await page.waitForURL(`/tickets/${ticket.id}`);

      await expect(page.getByRole("heading", { name: subject })).toBeVisible();
      await expect(page.getByText("Nav Fixture <navfixture@example.com>")).toBeVisible();
      await expect(
        page.getByText("This body should render on the detail page after navigation.")
      ).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------
  test.describe("Not found", () => {
    test("visiting a non-existent ticket id shows the real 'Ticket not found' error", async ({ page }) => {
      await loginAs(page, "agent@test.com", "TestAgent1!");

      await page.goto("/tickets/does-not-exist-12345");

      await expect(page.getByText("Ticket not found")).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Mutation persistence (one real round trip per mutation type)
  // ---------------------------------------------------------------------------
  test.describe("Mutation persistence", () => {
    test("changing the status dropdown persists after reload", async ({ page, request }) => {
      const ticket = await seedTicket(request, { subject: `Status persistence ${Date.now()}` });

      await loginAs(page, "agent@test.com", "TestAgent1!");
      await page.goto(`/tickets/${ticket.id}`);

      const statusSelect = page.locator("#ticket-status");
      await expect(statusSelect).toBeVisible();
      await statusSelect.selectOption("resolved");
      // Wait for the mutation to actually settle server-side before reloading,
      // rather than racing the PATCH with the reload.
      await expect(statusSelect).toHaveValue("resolved");

      await page.reload();

      await expect(page.locator("#ticket-status")).toHaveValue("resolved");
    });

    test("changing the category dropdown persists after reload", async ({ page, request }) => {
      const ticket = await seedTicket(request, { subject: `Category persistence ${Date.now()}` });

      await loginAs(page, "agent@test.com", "TestAgent1!");
      await page.goto(`/tickets/${ticket.id}`);

      const categorySelect = page.locator("#ticket-category");
      await expect(categorySelect).toBeVisible();
      await categorySelect.selectOption("technical_question");
      await expect(categorySelect).toHaveValue("technical_question");

      await page.reload();

      await expect(page.locator("#ticket-category")).toHaveValue("technical_question");
    });

    test("assigning the ticket to an agent persists after reload", async ({ page, request }) => {
      const ticket = await seedTicket(request, { subject: `Assignment persistence ${Date.now()}` });

      await loginAs(page, "agent@test.com", "TestAgent1!");
      await page.goto(`/tickets/${ticket.id}`);

      const assigneeSelect = page.locator("#ticket-assignee");
      await expect(assigneeSelect).toBeVisible();
      await assigneeSelect.selectOption({ label: SEEDED_AGENT_NAME });

      // The assignee <select> is server-controlled with no optimistic local
      // echo: onChange fires assignMutation.mutate() without awaiting it, so
      // the DOM briefly still shows the old (empty) value until the PATCH
      // resolves and the query cache updates. Wait for it to settle to some
      // non-empty value (a retrying assertion, not a one-shot read) before
      // capturing the id, rather than racing the mutation with inputValue().
      await expect(assigneeSelect).not.toHaveValue("");

      // Capture the id the UI resolved the label to, then confirm it's still
      // selected after a real reload + refetch (rather than hardcoding the
      // seeded agent's id, which isn't otherwise known to the test).
      const assignedId = await assigneeSelect.inputValue();
      expect(assignedId).not.toBe("");

      await page.reload();

      await expect(page.locator("#ticket-assignee")).toHaveValue(assignedId);
    });
  });

  // ---------------------------------------------------------------------------
  // Replies
  // ---------------------------------------------------------------------------
  test.describe("Replies", () => {
    test("submitting a reply creates it on the server and it survives a reload", async ({
      page,
      request,
    }) => {
      const ticket = await seedTicket(request, { subject: `Reply round trip ${Date.now()}` });
      const replyBody = `E2E reply body ${Date.now()}`;

      await loginAs(page, "agent@test.com", "TestAgent1!");
      await page.goto(`/tickets/${ticket.id}`);

      await page.getByLabel("Add a reply").fill(replyBody);
      await page.getByRole("button", { name: "Send reply" }).click();

      await expect(page.getByText(replyBody)).toBeVisible();

      await page.reload();

      // Confirms the reply was actually persisted as a TicketReply row via
      // POST, not just optimistically rendered client-side.
      await expect(page.getByText(replyBody)).toBeVisible();
    });
  });
});
