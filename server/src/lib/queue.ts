import { PgBoss } from "pg-boss";
import { classifyTicket, autoResolveTicket } from "./ai";
import { sendTicketReplyEmail } from "./mailer";

export const CLASSIFY_TICKET_QUEUE = "classify-ticket";
export const AUTO_RESOLVE_TICKET_QUEUE = "auto-resolve-ticket";
export const SEND_REPLY_EMAIL_QUEUE = "send-reply-email";

type ClassifyTicketJob = { ticketId: string; subject: string; body: string };
type AutoResolveTicketJob = { ticketId: string; subject: string; body: string };
type SendReplyEmailJob = { to: string; subject: string; body: string };

export const boss = new PgBoss(process.env.DATABASE_URL!);

boss.on("error", (err) => console.error("pg-boss error:", err));

export async function startQueue(): Promise<void> {
  await boss.start();

  await boss.createQueue(CLASSIFY_TICKET_QUEUE);
  await boss.work<ClassifyTicketJob>(CLASSIFY_TICKET_QUEUE, async ([job]) => {
    await classifyTicket(job.data.ticketId, job.data.subject, job.data.body);
  });

  await boss.createQueue(AUTO_RESOLVE_TICKET_QUEUE);
  await boss.work<AutoResolveTicketJob>(AUTO_RESOLVE_TICKET_QUEUE, async ([job]) => {
    await autoResolveTicket(job.data.ticketId, job.data.subject, job.data.body);
  });

  await boss.createQueue(SEND_REPLY_EMAIL_QUEUE);
  await boss.work<SendReplyEmailJob>(SEND_REPLY_EMAIL_QUEUE, async ([job]) => {
    await sendTicketReplyEmail(job.data.to, job.data.subject, job.data.body);
  });
}

export async function enqueueClassifyTicket(ticketId: string, subject: string, body: string): Promise<void> {
  await boss.send(CLASSIFY_TICKET_QUEUE, { ticketId, subject, body });
}

export async function enqueueAutoResolveTicket(ticketId: string, subject: string, body: string): Promise<void> {
  await boss.send(AUTO_RESOLVE_TICKET_QUEUE, { ticketId, subject, body });
}

export async function enqueueSendReplyEmail(to: string, subject: string, body: string): Promise<void> {
  await boss.send(SEND_REPLY_EMAIL_QUEUE, { to, subject, body });
}
