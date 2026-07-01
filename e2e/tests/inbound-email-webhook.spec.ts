import { test, expect, type APIRequestContext } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";
import { Client } from "pg";

// This endpoint is a pure server-to-server webhook (no session cookies, no UI),
// so these tests hit the Express server directly with the `request` fixture
// rather than driving a `page`. Auth is a shared-secret header, not Better Auth.
//
// The webhook secret and DATABASE_URL live in server/.env.test (gitignored),
// loaded the same way e2e/global-setup.ts loads it, since Playwright workers
// don't automatically inherit dotenv values applied inside globalSetup.
dotenv.config({ path: path.resolve(__dirname, "../../server/.env.test") });

const SERVER_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const WEBHOOK_URL = `${SERVER_URL}/api/webhooks/inbound-email`;
const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error(
    "INBOUND_EMAIL_WEBHOOK_SECRET is not set in server/.env.test — required for inbound-email-webhook.spec.ts"
  );
}

interface TicketRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  requesterEmail: string;
  requesterName: string | null;
  messageId: string | null;
}

/** Builds a unique RFC-5322-ish Message-Id so tests never collide, since the
 * test DB is not reset between individual tests within a run (only across
 * full suite runs via global-setup.ts). */
function uniqueMessageId(label: string) {
  return `<${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example.com>`;
}

/** POSTs to the inbound-email webhook. Pass `secret: undefined` to omit the
 * X-Webhook-Secret header entirely (as opposed to sending a wrong value). */
function postInboundEmail(
  request: APIRequestContext,
  body: Record<string, unknown>,
  secret: string | undefined = WEBHOOK_SECRET
) {
  return request.post(WEBHOOK_URL, {
    headers: secret !== undefined ? { "X-Webhook-Secret": secret } : {},
    data: body,
  });
}

test.describe("Inbound email webhook", () => {
  let db: Client;

  test.beforeAll(async () => {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
  });

  test.afterAll(async () => {
    await db.end();
  });

  async function getTicketById(id: string): Promise<TicketRow | undefined> {
    const res = await db.query('SELECT * FROM "Ticket" WHERE id = $1', [id]);
    return res.rows[0];
  }

  // ---------------------------------------------------------------------------
  // Creating a ticket
  // ---------------------------------------------------------------------------
  test.describe("New ticket creation", () => {
    test("an inbound email with no inReplyTo and no existing match creates a new ticket", async ({
      request,
    }) => {
      const messageId = uniqueMessageId("create");
      const response = await postInboundEmail(request, {
        from: "customer@example.com",
        fromName: "Jane Doe",
        subject: "Refund request",
        body: "I would like a refund for order #123.",
        messageId,
      });

      expect(response.status()).toBe(201);
      const payload = await response.json();
      expect(payload.status).toBe("created");
      expect(typeof payload.ticketId).toBe("string");

      const ticket = await getTicketById(payload.ticketId);
      expect(ticket).toBeDefined();
      expect(ticket?.subject).toBe("Refund request");
      expect(ticket?.body).toBe("I would like a refund for order #123.");
      expect(ticket?.status).toBe("open");
      expect(ticket?.requesterEmail).toBe("customer@example.com");
      expect(ticket?.requesterName).toBe("Jane Doe");
      expect(ticket?.messageId).toBe(messageId);
    });

    test("fromName is optional — requesterName is stored as null when omitted", async ({
      request,
    }) => {
      const messageId = uniqueMessageId("create-no-name");
      const response = await postInboundEmail(request, {
        from: "noname@example.com",
        subject: "General question",
        body: "What are your support hours?",
        messageId,
      });

      expect(response.status()).toBe(201);
      const payload = await response.json();

      const ticket = await getTicketById(payload.ticketId);
      expect(ticket?.requesterName).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Threading via inReplyTo
  // ---------------------------------------------------------------------------
  test.describe("Threading via inReplyTo", () => {
    test("a reply whose inReplyTo matches an existing ticket's messageId is appended to that ticket", async ({
      request,
    }) => {
      const originalMessageId = uniqueMessageId("thread-original");
      const createResponse = await postInboundEmail(request, {
        from: "thread@example.com",
        fromName: "Thread Person",
        subject: "Login issue",
        body: "I cannot log in.",
        messageId: originalMessageId,
      });
      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();

      const replyMessageId = uniqueMessageId("thread-reply");
      const replyResponse = await postInboundEmail(request, {
        from: "thread@example.com",
        fromName: "Thread Person",
        subject: "Re: Login issue",
        body: "Still broken, any update?",
        messageId: replyMessageId,
        inReplyTo: originalMessageId,
      });

      expect(replyResponse.status()).toBe(200);
      const replyPayload = await replyResponse.json();
      expect(replyPayload.status).toBe("appended");
      expect(replyPayload.ticketId).toBe(created.ticketId);

      const ticket = await getTicketById(created.ticketId);
      expect(ticket?.body).toContain("I cannot log in.");
      expect(ticket?.body).toContain("Still broken, any update?");
      expect(ticket?.body).toContain(
        "--- Reply from Thread Person <thread@example.com> ---"
      );
      // messageId advances to the latest message so the next reply threads correctly.
      expect(ticket?.messageId).toBe(replyMessageId);
      expect(ticket?.status).toBe("open");
    });

    test("a reply to a resolved ticket reopens it to open", async ({ request }) => {
      const originalMessageId = uniqueMessageId("reopen-original");
      const createResponse = await postInboundEmail(request, {
        from: "reopen@example.com",
        subject: "Cannot access account",
        body: "Locked out.",
        messageId: originalMessageId,
      });
      const created = await createResponse.json();

      // No API exists yet for an agent to resolve a ticket, so update the row
      // directly to simulate a ticket that was already resolved before the
      // customer replied.
      await db.query('UPDATE "Ticket" SET status = $1 WHERE id = $2', [
        "resolved",
        created.ticketId,
      ]);
      expect((await getTicketById(created.ticketId))?.status).toBe("resolved");

      const replyMessageId = uniqueMessageId("reopen-reply");
      const replyResponse = await postInboundEmail(request, {
        from: "reopen@example.com",
        subject: "Re: Cannot access account",
        body: "Still locked out, please help.",
        messageId: replyMessageId,
        inReplyTo: originalMessageId,
      });

      expect(replyResponse.status()).toBe(200);
      const replyPayload = await replyResponse.json();
      expect(replyPayload.status).toBe("appended");
      expect(replyPayload.ticketId).toBe(created.ticketId);

      const ticket = await getTicketById(created.ticketId);
      expect(ticket?.status).toBe("open");
    });

    test("a reply to a closed ticket does NOT thread via inReplyTo lookup alone if messageId is stale — matched purely by messageId regardless of status, and reopens", async ({
      request,
    }) => {
      // The endpoint's inReplyTo lookup is a direct messageId match with no
      // status filter, so even a closed ticket is found and reopened. This
      // pins down that behavior explicitly since it's easy to assume closed
      // tickets are excluded (they are only excluded from the *subject*
      // fallback match, not the inReplyTo match).
      const originalMessageId = uniqueMessageId("closed-original");
      const createResponse = await postInboundEmail(request, {
        from: "closedthread@example.com",
        subject: "Old issue",
        body: "Original problem.",
        messageId: originalMessageId,
      });
      const created = await createResponse.json();

      await db.query('UPDATE "Ticket" SET status = $1 WHERE id = $2', [
        "closed",
        created.ticketId,
      ]);

      const replyMessageId = uniqueMessageId("closed-reply");
      const replyResponse = await postInboundEmail(request, {
        from: "closedthread@example.com",
        subject: "Re: Old issue",
        body: "Reopening this.",
        messageId: replyMessageId,
        inReplyTo: originalMessageId,
      });

      expect(replyResponse.status()).toBe(200);
      const replyPayload = await replyResponse.json();
      expect(replyPayload.status).toBe("appended");
      expect(replyPayload.ticketId).toBe(created.ticketId);

      const ticket = await getTicketById(created.ticketId);
      expect(ticket?.status).toBe("open");
    });
  });

  // ---------------------------------------------------------------------------
  // Subject-based fallback matching
  // ---------------------------------------------------------------------------
  test.describe("Subject-based fallback matching", () => {
    test("no inReplyTo but a Re: subject + matching requester email appends to the existing open ticket", async ({
      request,
    }) => {
      const originalMessageId = uniqueMessageId("subject-original");
      const createResponse = await postInboundEmail(request, {
        from: "subjectmatch@example.com",
        subject: "Question about billing",
        body: "How much do I owe?",
        messageId: originalMessageId,
      });
      const created = await createResponse.json();

      const followUpMessageId = uniqueMessageId("subject-followup");
      const followUpResponse = await postInboundEmail(request, {
        from: "subjectmatch@example.com",
        subject: "Re: Question about billing",
        body: "Following up on this.",
        messageId: followUpMessageId,
        // No inReplyTo — simulates a client that didn't set threading headers.
      });

      expect(followUpResponse.status()).toBe(200);
      const followUpPayload = await followUpResponse.json();
      expect(followUpPayload.status).toBe("appended");
      expect(followUpPayload.ticketId).toBe(created.ticketId);

      const ticket = await getTicketById(created.ticketId);
      expect(ticket?.body).toContain("How much do I owe?");
      expect(ticket?.body).toContain("Following up on this.");
      expect(ticket?.messageId).toBe(followUpMessageId);
    });

    test("Fwd: prefix also matches after normalization", async ({ request }) => {
      const originalMessageId = uniqueMessageId("fwd-original");
      const createResponse = await postInboundEmail(request, {
        from: "fwdmatch@example.com",
        subject: "Password reset",
        body: "I need a password reset.",
        messageId: originalMessageId,
      });
      const created = await createResponse.json();

      const followUpMessageId = uniqueMessageId("fwd-followup");
      const followUpResponse = await postInboundEmail(request, {
        from: "fwdmatch@example.com",
        subject: "Fwd: Password reset",
        body: "Forwarding my earlier request.",
        messageId: followUpMessageId,
      });

      expect(followUpResponse.status()).toBe(200);
      const followUpPayload = await followUpResponse.json();
      expect(followUpPayload.status).toBe("appended");
      expect(followUpPayload.ticketId).toBe(created.ticketId);
    });

    test("a matching subject from a different requester email does NOT match — a new ticket is created instead", async ({
      request,
    }) => {
      const originalMessageId = uniqueMessageId("subject-diffemail-original");
      await postInboundEmail(request, {
        from: "personA@example.com",
        subject: "Shared subject line",
        body: "Person A's message.",
        messageId: originalMessageId,
      });

      const otherMessageId = uniqueMessageId("subject-diffemail-other");
      const response = await postInboundEmail(request, {
        from: "personB@example.com",
        subject: "Re: Shared subject line",
        body: "Person B's unrelated message.",
        messageId: otherMessageId,
      });

      expect(response.status()).toBe(201);
      const payload = await response.json();
      expect(payload.status).toBe("created");
    });
  });

  // ---------------------------------------------------------------------------
  // Duplicate / idempotent delivery
  // ---------------------------------------------------------------------------
  test.describe("Duplicate delivery", () => {
    test("resending the exact same messageId is idempotent and does not modify the ticket", async ({
      request,
    }) => {
      const messageId = uniqueMessageId("duplicate");
      const payload = {
        from: "duplicate@example.com",
        subject: "Duplicate test",
        body: "Original body.",
        messageId,
      };

      const firstResponse = await postInboundEmail(request, payload);
      expect(firstResponse.status()).toBe(201);
      const first = await firstResponse.json();
      expect(first.status).toBe("created");

      const secondResponse = await postInboundEmail(request, payload);
      expect(secondResponse.status()).toBe(200);
      const second = await secondResponse.json();
      expect(second.status).toBe("duplicate");
      expect(second.ticketId).toBe(first.ticketId);

      const ticket = await getTicketById(first.ticketId);
      expect(ticket?.body).toBe("Original body.");
    });
  });

  // ---------------------------------------------------------------------------
  // Shared-secret authentication
  // ---------------------------------------------------------------------------
  test.describe("Webhook authentication", () => {
    test("missing X-Webhook-Secret header returns 401", async ({ request }) => {
      const response = await postInboundEmail(
        request,
        {
          from: "noauth@example.com",
          subject: "No auth",
          body: "Should be rejected.",
          messageId: uniqueMessageId("noauth"),
        },
        undefined
      );

      expect(response.status()).toBe(401);
      const payload = await response.json();
      expect(payload.error).toBe("Unauthorized");
    });

    test("wrong X-Webhook-Secret header returns 401", async ({ request }) => {
      const response = await postInboundEmail(
        request,
        {
          from: "wrongsecret@example.com",
          subject: "Wrong secret",
          body: "Should be rejected.",
          messageId: uniqueMessageId("wrongsecret"),
        },
        "not-the-real-secret"
      );

      expect(response.status()).toBe(401);
      const payload = await response.json();
      expect(payload.error).toBe("Unauthorized");
    });
  });

  // ---------------------------------------------------------------------------
  // Payload validation
  // ---------------------------------------------------------------------------
  test.describe("Payload validation", () => {
    test("empty subject returns 400 with a validation error", async ({ request }) => {
      const response = await postInboundEmail(request, {
        from: "invalid@example.com",
        subject: "",
        body: "No subject provided.",
        messageId: uniqueMessageId("empty-subject"),
      });

      expect(response.status()).toBe(400);
      const payload = await response.json();
      expect(payload.error).toBe("Subject is required");
    });

    test("malformed from email returns 400 with a validation error", async ({
      request,
    }) => {
      const response = await postInboundEmail(request, {
        from: "not-an-email",
        subject: "Bad sender",
        body: "This should be rejected.",
        messageId: uniqueMessageId("bad-email"),
      });

      expect(response.status()).toBe(400);
      const payload = await response.json();
      expect(payload.error).toBe("Invalid sender email address");
    });

    test("empty messageId returns 400 with a validation error", async ({
      request,
    }) => {
      // An empty string (rather than an omitted field) exercises the custom
      // zod .min(1, "messageId is required") message. A fully-omitted field
      // instead fails zod's base type check first, with a generic
      // "expected string, received undefined" message.
      const response = await postInboundEmail(request, {
        from: "invalid@example.com",
        subject: "No message id",
        body: "This should be rejected.",
        messageId: "",
      });

      expect(response.status()).toBe(400);
      const payload = await response.json();
      expect(payload.error).toBe("messageId is required");
    });
  });
});
