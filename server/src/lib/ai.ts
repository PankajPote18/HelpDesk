import { readFileSync } from "node:fs";
import path from "node:path";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { ticketCategorySchema, type TicketCategory } from "@helpdesk/core";
import { TicketStatus } from "../generated/prisma/enums";
import { db } from "./db";
import { sendTicketReplyEmail } from "./mailer";

export const polishModel = google("gemini-2.5-flash-lite");
const classifyModel = google("gemini-2.5-flash-lite");
const resolveModel = google("gemini-2.5-flash-lite");

const knowledgeBase = readFileSync(path.join(process.cwd(), "knowledge-base.md"), "utf-8");

export const AI_AGENT_EMAIL = "ai@helpdesk.local";

export async function classifyTicket(ticketId: string, subject: string, body: string): Promise<void> {
  const { object: category } = await generateObject({
    model: classifyModel,
    output: "enum",
    enum: ticketCategorySchema.options,
    system: "Classify a helpdesk ticket into exactly one category based on its subject and body.",
    prompt: `Subject: ${subject}\n\nBody:\n${body}`,
  });

  await db.ticket.update({
    where: { id: ticketId },
    data: { category: category as TicketCategory },
  });
}

const resolutionSchema = z.object({
  canResolve: z.boolean(),
  answer: z.string(),
});

async function resolveTicketFromKnowledgeBase(
  subject: string,
  body: string
): Promise<{ canResolve: boolean; answer: string }> {
  const { object } = await generateObject({
    model: resolveModel,
    schema: resolutionSchema,
    system:
      "You are a support ticket auto-resolution assistant for an online course platform. You are given " +
      "a knowledge base and a customer's ticket. Decide whether the knowledge base fully and unambiguously " +
      "answers the customer's question, and follow the escalation rules in the knowledge base exactly — " +
      "if any escalation condition applies, you must not resolve the ticket. If you can confidently and " +
      "fully resolve it without escalation, set canResolve to true and write a complete, friendly reply to " +
      "the customer as `answer`, using only information from the knowledge base. Otherwise set canResolve " +
      "to false and leave answer empty.\n\n" +
      `Knowledge base:\n${knowledgeBase}`,
    prompt: `Ticket subject: ${subject}\n\nTicket body:\n${body}`,
  });

  return object;
}

export function getAiAgent() {
  return db.user.findUniqueOrThrow({ where: { email: AI_AGENT_EMAIL } });
}

export async function autoResolveTicket(ticketId: string, subject: string, body: string): Promise<void> {
  const ticket = await db.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.processing } });

  let canResolve = false;
  let answer = "";
  try {
    ({ canResolve, answer } = await resolveTicketFromKnowledgeBase(subject, body));
  } catch (err) {
    console.error(`Auto-resolution failed for ticket ${ticketId}, falling back to open:`, err);
  }

  if (canResolve) {
    const aiAgent = await getAiAgent();
    await db.$transaction([
      db.ticketReply.create({ data: { ticketId, authorId: aiAgent.id, body: answer } }),
      db.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.resolved, resolvedAt: new Date() },
      }),
    ]);
    await sendTicketReplyEmail(ticket.requesterEmail, subject, answer);
  } else {
    await db.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.open, assignedToId: null },
    });
  }
}
