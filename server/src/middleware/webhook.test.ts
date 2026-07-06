import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import express from "express";
import { requireWebhookSecret } from "./webhook";

const ORIGINAL_SECRET = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;

beforeEach(() => {
  process.env.INBOUND_EMAIL_WEBHOOK_SECRET = "test-secret";

  const app = express();
  app.get("/protected", requireWebhookSecret, (_req, res) => res.json({ ok: true }));

  server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  baseUrl = `http://localhost:${port}`;
});

afterEach(() => {
  server.close();
  process.env.INBOUND_EMAIL_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

describe("requireWebhookSecret", () => {
  test("allows a request with a matching X-Webhook-Secret header", async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { "X-Webhook-Secret": "test-secret" },
    });
    expect(response.status).toBe(200);
  });

  test("allows a request with a matching ?secret= query param (for SendGrid, which can't set headers)", async () => {
    const response = await fetch(`${baseUrl}/protected?secret=test-secret`);
    expect(response.status).toBe(200);
  });

  test("rejects a request with no secret", async () => {
    const response = await fetch(`${baseUrl}/protected`);
    expect(response.status).toBe(401);
  });

  test("rejects a request with a wrong secret", async () => {
    const response = await fetch(`${baseUrl}/protected?secret=wrong`);
    expect(response.status).toBe(401);
  });

  test("returns 500 when the secret is not configured", async () => {
    delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    const response = await fetch(`${baseUrl}/protected?secret=anything`);
    expect(response.status).toBe(500);
  });
});
