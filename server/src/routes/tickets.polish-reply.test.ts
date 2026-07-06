import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import express from "express";

const findUniqueMock = mock(
  async (): Promise<{ subject: string; requesterName: string } | null> => ({
    subject: "Refund status",
    requesterName: "Jane Doe",
  })
);
const generateTextMock = mock(async (_args: { prompt: string }) => ({ text: "polished reply" }));

mock.module("../lib/db", () => ({ db: { ticket: { findUnique: findUniqueMock } } }));
mock.module("../lib/ai", () => ({
  polishModel: "mock-model",
  getAiAgent: mock(async () => ({ id: "ai-agent-1", name: "AI" })),
}));
mock.module("ai", () => ({ generateText: generateTextMock }));

const { default: ticketsRouter } = await import("./tickets");

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.locals.session = { user: { id: "agent-1", name: "Alex Agent" } };
  next();
});
app.use("/api/tickets", ticketsRouter);
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
  generateTextMock.mockClear();
  findUniqueMock.mockImplementation(async () => ({ subject: "Refund status", requesterName: "Jane Doe" }));
  generateTextMock.mockImplementation(async () => ({ text: "polished reply" }));
});

describe("POST /api/tickets/:id/polish-reply", () => {
  test("sends the customer's and agent's name to the model and returns the polished text", async () => {
    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/polish-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "we will refund you" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "polished reply" });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const [{ prompt }] = generateTextMock.mock.calls[0] as [{ prompt: string }];
    expect(prompt).toContain("Customer name: Jane Doe");
    expect(prompt).toContain("Agent name: Alex Agent");
  });

  test("returns 404 without calling the model when the ticket does not exist", async () => {
    findUniqueMock.mockImplementation(async () => null);

    const response = await fetch(`${baseUrl}/api/tickets/missing/polish-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "draft" }),
    });

    expect(response.status).toBe(404);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  test("returns 400 without hitting the database when the draft is empty", async () => {
    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/polish-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "" }),
    });

    expect(response.status).toBe(400);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
