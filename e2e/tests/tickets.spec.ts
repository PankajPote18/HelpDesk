import { type Page, test, expect, type APIRequestContext } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

// Tickets are only creatable today via the inbound-email webhook (no ticket
// creation UI exists yet), so this file seeds its fixtures the same way
// e2e/tests/inbound-email-webhook.spec.ts does: hit the webhook directly with
// the shared secret loaded from server/.env.test.
dotenv.config({ path: path.resolve(__dirname, "../../server/.env.test") });

const SERVER_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const WEBHOOK_URL = `${SERVER_URL}/api/webhooks/inbound-email`;
const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error(
    "INBOUND_EMAIL_WEBHOOK_SECRET is not set in server/.env.test — required for tickets.spec.ts"
  );
}

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

/**
 * Logs in via the UI and waits for the post-login redirect to '/', which now
 * renders TicketsPage (HomePage was removed this session — App.tsx routes
 * "/" straight to <ProtectedRoute><TicketsPage /></ProtectedRoute>).
 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}

test.describe("Tickets list page", () => {
  // ---------------------------------------------------------------------------
  // Access control
  // ---------------------------------------------------------------------------
  test.describe("Access control", () => {
    test("unauthenticated visit to / redirects to /login", async ({ page }) => {
      // TicketsPage is now mounted at "/" behind ProtectedRoute. The guard
      // itself is already covered in depth by auth.spec.ts ("visiting a
      // protected route while unauthenticated redirects to /login"); this
      // just confirms the tickets route inherits that same guard.
      await page.goto("/");
      await expect(page).toHaveURL("/login");
    });
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  test.describe("Rendering", () => {
    test("logged-in agent sees the tickets table with expected columns", async ({
      page,
      request,
    }) => {
      // Seed at least one ticket so the table is guaranteed non-empty
      // regardless of what other spec files have already run in this suite.
      const subject = `Rendering smoke test ${Date.now()}`;
      const response = await postInboundEmail(request, {
        from: "smoke@example.com",
        fromName: "Smoke Tester",
        subject,
        body: "Just checking the table renders.",
        messageId: uniqueMessageId("render-smoke"),
      });
      expect(response.status()).toBe(201);

      await loginAs(page, "agent@test.com", "TestAgent1!");

      await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Subject" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Requester" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Assigned to" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Created" })).toBeVisible();

      await expect(page.getByRole("row").filter({ hasText: subject })).toBeVisible();
    });

    test("a ticket row shows subject, requester name+email, open status, and Unassigned", async ({
      page,
      request,
    }) => {
      const subject = `Data check ${Date.now()}`;
      const response = await postInboundEmail(request, {
        from: "databuyer@example.com",
        fromName: "Data Buyer",
        subject,
        body: "Please check my order.",
        messageId: uniqueMessageId("ticket-data"),
      });
      expect(response.status()).toBe(201);

      await loginAs(page, "agent@test.com", "TestAgent1!");

      const row = page.getByRole("row").filter({ hasText: subject });
      await expect(row).toBeVisible();
      await expect(row.getByText(subject, { exact: true })).toBeVisible();
      await expect(
        row.getByText("Data Buyer <databuyer@example.com>", { exact: true })
      ).toBeVisible();
      await expect(row.getByText("open", { exact: true })).toBeVisible();
      await expect(row.getByText("Unassigned", { exact: true })).toBeVisible();

      // Compare against a date computed inside the browser (same JS engine
      // and locale as TicketsPage's own `new Date(...).toLocaleDateString()`
      // call), rather than computing it in Node, to avoid locale/timezone
      // drift between the test runner process and Chromium.
      const expectedDate = await page.evaluate(() => new Date().toLocaleDateString());
      await expect(row.getByText(expectedDate, { exact: true })).toBeVisible();
    });

    test("a ticket with no requester name shows just the requester email", async ({
      page,
      request,
    }) => {
      const subject = `No name check ${Date.now()}`;
      const response = await postInboundEmail(request, {
        from: "noname-ticket@example.com",
        subject,
        body: "No fromName provided.",
        messageId: uniqueMessageId("ticket-noname"),
      });
      expect(response.status()).toBe(201);

      await loginAs(page, "agent@test.com", "TestAgent1!");

      const row = page.getByRole("row").filter({ hasText: subject });
      await expect(row).toBeVisible();
      await expect(row.getByText("noname-ticket@example.com", { exact: true })).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Sort order
  // ---------------------------------------------------------------------------
  test.describe("Sort order", () => {
    test("newest ticket appears before an older ticket in row order", async ({
      page,
      request,
    }) => {
      const olderSubject = `Order test older ${Date.now()}`;
      const newerSubject = `Order test newer ${Date.now()}`;

      // Created sequentially (awaited, not parallel) so the DB-generated
      // createdAt timestamps are unambiguously ordered.
      const olderResponse = await postInboundEmail(request, {
        from: "order-older@example.com",
        subject: olderSubject,
        body: "This ticket is created first.",
        messageId: uniqueMessageId("order-older"),
      });
      expect(olderResponse.status()).toBe(201);

      const newerResponse = await postInboundEmail(request, {
        from: "order-newer@example.com",
        subject: newerSubject,
        body: "This ticket is created second, and should sort first.",
        messageId: uniqueMessageId("order-newer"),
      });
      expect(newerResponse.status()).toBe(201);

      await loginAs(page, "agent@test.com", "TestAgent1!");

      // Wait for both rows to be present before reading row order, so the
      // table has finished rendering the full ticket list.
      const newerRow = page.getByRole("row").filter({ hasText: newerSubject });
      const olderRow = page.getByRole("row").filter({ hasText: olderSubject });
      await expect(newerRow).toBeVisible();
      await expect(olderRow).toBeVisible();

      // GET /api/tickets sorts by createdAt desc, so the ticket created
      // second (newer) must render at a lower row index than the one
      // created first (older).
      const rowTexts = await page.getByRole("row").allTextContents();
      const newerIndex = rowTexts.findIndex((text) => text.includes(newerSubject));
      const olderIndex = rowTexts.findIndex((text) => text.includes(olderSubject));

      expect(newerIndex).toBeGreaterThanOrEqual(0);
      expect(olderIndex).toBeGreaterThanOrEqual(0);
      expect(newerIndex).toBeLessThan(olderIndex);
    });
  });
});
