import { Router } from "express";
import { TicketStatus } from "../generated/prisma/enums";
import { db } from "../lib/db";
import { getAiAgent } from "../lib/ai";

const router = Router();

const TICKETS_PER_DAY_WINDOW = 30;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.get("/", async (_req, res) => {
  const aiAgent = await getAiAgent();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (TICKETS_PER_DAY_WINDOW - 1));

  const [totalTickets, openTickets, aiResolvedTickets, resolvedTickets, recentTickets] = await Promise.all([
    db.ticket.count(),
    db.ticket.count({ where: { status: TicketStatus.open } }),
    db.ticket.count({ where: { status: TicketStatus.resolved, assignedToId: aiAgent.id } }),
    db.ticket.findMany({
      where: { status: TicketStatus.resolved, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
    db.ticket.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
  ]);

  const aiResolvedRate = totalTickets > 0 ? (aiResolvedTickets / totalTickets) * 100 : 0;

  let totalResolutionMs = 0;
  for (const ticket of resolvedTickets) {
    totalResolutionMs += ticket.resolvedAt!.getTime() - ticket.createdAt.getTime();
  }
  const averageResolutionTimeMs = resolvedTickets.length > 0 ? totalResolutionMs / resolvedTickets.length : null;

  const counts = new Map<string, number>();
  for (let i = 0; i < TICKETS_PER_DAY_WINDOW; i++) {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    counts.set(dayKey(d), 0);
  }
  for (const ticket of recentTickets) {
    const key = dayKey(ticket.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ticketsPerDay = Array.from(counts.entries()).map(([date, count]) => ({ date, count }));

  res.json({
    totalTickets,
    openTickets,
    aiResolvedTickets,
    aiResolvedRate,
    averageResolutionTimeMs,
    ticketsPerDay,
  });
});

export default router;
