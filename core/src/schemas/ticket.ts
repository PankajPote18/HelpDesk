import { z } from "zod";

export const ticketStatusSchema = z.enum(["open", "resolved", "closed"]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketCategorySchema = z.enum([
  "general_question",
  "technical_question",
  "refund_request",
]);
export type TicketCategory = z.infer<typeof ticketCategorySchema>;
