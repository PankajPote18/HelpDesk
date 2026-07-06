import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import express from "express";

const findUniqueMock = mock(async (_args: { where: { messageId: string } }): Promise<any> => null);
const findManyMock = mock(async (): Promise<any[]> => []);
const createMock = mock(async (args: { data: Record<string, unknown> }) => ({ id: "ticket-new", ...args.data }));
const updateMock = mock(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
  id: args.where.id,
  ...args.data,
}));

mock.module("../lib/db", () => ({
  db: {
    ticket: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
      create: createMock,
      update: updateMock,
    },
  },
}));
mock.module("../lib/ai", () => ({
  getAiAgent: mock(async () => ({ id: "ai-agent-1", name: "AI" })),
  classifyTicket: mock(async () => {}),
  autoResolveTicket: mock(async () => {}),
}));
mock.module("../lib/queue", () => ({
  enqueueClassifyTicket: mock(async () => {}),
  enqueueAutoResolveTicket: mock(async () => {}),
  enqueueSendReplyEmail: mock(async () => {}),
}));

const { default: inboundEmailRouter } = await import("./inbound-email");

const app = express();
app.use("/api/webhooks/inbound-email", inboundEmailRouter);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message });
});

const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const baseUrl = `http://localhost:${port}`;

afterAll(() => {
  server.close();
});

beforeEach(() => {
  findUniqueMock.mockClear();
  findManyMock.mockClear();
  createMock.mockClear();
  updateMock.mockClear();
  findUniqueMock.mockImplementation(async () => null);
  findManyMock.mockImplementation(async () => []);
});

function buildSendGridForm(
  overrides: Partial<{ from: string; subject: string; text: string; headers: string }> = {}
): FormData {
  const form = new FormData();
  form.append("from", overrides.from ?? '"Jane Doe" <jane@example.com>');
  form.append("to", "support@helpdesk.local");
  form.append("subject", overrides.subject ?? "Refund status");
  form.append("text", overrides.text ?? "Can I get a refund?");
  form.append(
    "headers",
    overrides.headers ??
      'From: "Jane Doe" <jane@example.com>\nTo: support@helpdesk.local\nMessage-ID: <msg-1@example.com>\nSubject: Refund status'
  );
  return form;
}

describe("POST /api/webhooks/inbound-email", () => {
  test("creates a ticket from a parsed SendGrid inbound payload", async () => {
    const response = await fetch(`${baseUrl}/api/webhooks/inbound-email`, {
      method: "POST",
      body: buildSendGridForm(),
    });

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.status).toBe("created");

    expect(createMock).toHaveBeenCalledTimes(1);
    const [{ data }] = createMock.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.requesterEmail).toBe("jane@example.com");
    expect(data.requesterName).toBe("Jane Doe");
    expect(data.subject).toBe("Refund status");
    expect(data.body).toBe("Can I get a refund?");
    expect(data.messageId).toBe("msg-1@example.com");
  });

  test("appends to the matching ticket when In-Reply-To resolves to an existing ticket", async () => {
    findUniqueMock.mockImplementation(async (args: { where: { messageId: string } }) =>
      args.where.messageId === "orig-msg@example.com"
        ? { id: "ticket-1", body: "original body", subject: "Refund status" }
        : null
    );

    const response = await fetch(`${baseUrl}/api/webhooks/inbound-email`, {
      method: "POST",
      body: buildSendGridForm({
        headers:
          'From: "Jane Doe" <jane@example.com>\nMessage-ID: <msg-2@example.com>\nIn-Reply-To: <orig-msg@example.com>\nSubject: Re: Refund status',
        text: "Following up on this.",
      }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ ticketId: "ticket-1", status: "appended" });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  test("returns 400 when the sender address cannot be parsed as a valid email", async () => {
    const response = await fetch(`${baseUrl}/api/webhooks/inbound-email`, {
      method: "POST",
      body: buildSendGridForm({ from: "not-an-email" }),
    });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
