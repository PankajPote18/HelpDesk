import { Router } from "express";
import multer from "multer";
import Parse from "@sendgrid/inbound-mail-parser";
import { inboundEmailSchema } from "@helpdesk/core";
import { db } from "../lib/db";
import { enqueueClassifyTicket, enqueueAutoResolveTicket } from "../lib/queue";
import { getAiAgent } from "../lib/ai";
import { TicketStatus } from "../generated/prisma/enums";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function normalizeSubject(subject: string): string {
  let s = subject.trim();
  let prev: string;
  do {
    prev = s;
    s = s.replace(/^(re|fwd?|fw)\s*:\s*/i, "").trim();
  } while (s !== prev);
  return s.toLowerCase();
}

// SendGrid's `from` field looks like `"Jane Doe" <jane@example.com>` or a bare address.
function parseFromField(from: string): { email: string; name?: string } {
  const match = from.match(/^"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (!match) {
    return { email: from.trim() };
  }
  const name = match[1].trim();
  return { email: match[2].trim(), name: name.length > 0 ? name : undefined };
}

// SendGrid ships the MIME headers as one raw string field; pull the header we need out of it.
function extractHeader(headers: string, name: string): string | undefined {
  const match = headers.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim().replace(/^<(.+)>$/, "$1");
}

router.post("/", upload.any(), async (req, res) => {
  const parsed = new Parse(
    { keys: ["from", "subject", "text", "html", "headers"] },
    { body: req.body, files: Array.isArray(req.files) ? req.files : [] }
  ).keyValues();

  const fromField = typeof parsed.from === "string" ? parseFromField(parsed.from) : undefined;
  const headers = typeof parsed.headers === "string" ? parsed.headers : "";

  const result = inboundEmailSchema.safeParse({
    from: fromField?.email ?? "",
    fromName: fromField?.name,
    subject: parsed.subject ?? "",
    body: parsed.text ?? parsed.html ?? "",
    messageId: extractHeader(headers, "Message-ID"),
    inReplyTo: extractHeader(headers, "In-Reply-To"),
  });
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
