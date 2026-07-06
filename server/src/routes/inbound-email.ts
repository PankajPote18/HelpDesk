import { Router } from "express";
import { inboundEmailSchema } from "@helpdesk/core";
import { db } from "../lib/db";
import { enqueueClassifyTicket, enqueueAutoResolveTicket } from "../lib/queue";
import { getAiAgent } from "../lib/ai";
import { TicketStatus } from "../generated/prisma/enums";

const router = Router();

function normalizeSubject(subject: string): string {
  let s = subject.trim();
  let prev: string;
  do {
    prev = s;
    s = s.replace(/^(re|fwd?|fw)\s*:\s*/i, "").trim();
  } while (s !== prev);
  return s.toLowerCase();
}

router.post("/", async (req, res) => {
  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { from, fromName, subject, body, messageId, inReplyTo } = result.data;

  const alreadyProcessed = await db.ticket.findUnique({ where: { messageId } });
  if (alreadyProcessed) {
    return res.status(200).json({ ticketId: alreadyProcessed.id, status: "duplicate" });
  }

  let matched = inReplyTo
    ? await db.ticket.findUnique({ where: { messageId: inReplyTo } })
    : null;

  if (!matched) {
    const normalizedIncoming = normalizeSubject(subject);
    const candidates = await db.ticket.findMany({
      where: { requesterEmail: from, status: { not: TicketStatus.closed } },
      orderBy: { createdAt: "desc" },
    });
    matched = candidates.find((t) => normalizeSubject(t.subject) === normalizedIncoming) ?? null;
  }

  if (matched) {
    const updated = await db.ticket.update({
      where: { id: matched.id },
      data: {
        body: `${matched.body}\n\n--- Reply from ${fromName ?? from} <${from}> ---\n\n${body}`,
        messageId,
        status: TicketStatus.open,
      },
    });
    return res.status(200).json({ ticketId: updated.id, status: "appended" });
  }

  const aiAgent = await getAiAgent();
  const created = await db.ticket.create({
    data: {
      subject,
      body,
      requesterEmail: from,
      requesterName: fromName ?? null,
      messageId,
      assignedToId: aiAgent.id,
    },
  });
  await enqueueClassifyTicket(created.id, subject, body);
  await enqueueAutoResolveTicket(created.id, subject, body);
  res.status(201).json({ ticketId: created.id, status: "created" });
});

export default router;
