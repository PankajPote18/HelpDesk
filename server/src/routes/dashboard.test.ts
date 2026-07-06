import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import express from "express";

const countMock = mock(async (_args?: unknown) => 0);
const findManyMock = mock(async (_args?: unknown): Promise<unknown[]> => []);
const getAiAgentMock = mock(async () => ({ id: "ai-agent-1", name: "AI" }));

mock.module("../lib/db", () => ({
  db: { ticket: { count: countMock, findMany: findManyMock } },
}));
mock.module("../lib/ai", () => ({ getAiAgent: getAiAgentMock, polishModel: "mock-model" }));

const { default: dashboardRouter } = await import("./dashboard");

const app = express();
app.use("/api/dashboard", dashboardRouter);
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
  countMock.mockClear();
  findManyMock.mockClear();
  getAiAgentMock.mockClear();
});

describe("GET /api/dashboard", () => {
  test("computes totals, AI resolution rate, average resolution time, and tickets-per-day", async () => {
    const countResults = [10, 3, 4]; // total, open, aiResolved
    let countCallIndex = 0;
    countMock.mockImplementation(async () => countResults[countCallIndex++]);

    const now = new Date();
    findManyMock.mockImplementationOnce(async () => [
      { createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), resolvedAt: now },
    ]);
    findManyMock.mockImplementationOnce(async () => [{ createdAt: now }]);

    const response = await fetch(`${baseUrl}/api/dashboard`);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.totalTickets).toBe(10);
    expect(json.openTickets).toBe(3);
    expect(json.aiResolvedTickets).toBe(4);
    expect(json.aiResolvedRate).toBe(40);
    expect(json.averageResolutionTimeMs).toBe(2 * 60 * 60 * 1000);
    expect(json.ticketsPerDay).toHaveLength(30);
    expect(json.ticketsPerDay[29].count).toBe(1);
  });

  test("returns a 0% AI resolution rate and a null average resolution time when there are no tickets", async () => {
    countMock.mockImplementation(async () => 0);
    findManyMock.mockImplementation(async () => []);

    const response = await fetch(`${baseUrl}/api/dashboard`);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.totalTickets).toBe(0);
    expect(json.aiResolvedRate).toBe(0);
    expect(json.averageResolutionTimeMs).toBeNull();
    expect(json.ticketsPerDay).toHaveLength(30);
    expect(json.ticketsPerDay.every((d: { count: number }) => d.count === 0)).toBe(true);
  });
});
