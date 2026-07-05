import { z } from "zod";

export const ticketStatusSchema = z.enum(["open", "resolved", "closed"]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketCategorySchema = z.enum([
  "general_question",
  "technical_question",
  "refund_request",
]);
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

export const ticketSortFieldSchema = z.enum([
  "subject",
  "requesterEmail",
  "status",
  "category",
  "assignedTo",
  "createdAt",
]);
export type TicketSortField = z.infer<typeof ticketSortFieldSchema>;

export const ticketSortOrderSchema = z.enum(["asc", "desc"]);
export type TicketSortOrder = z.infer<typeof ticketSortOrderSchema>;

export const ticketListQuerySchema = z.object({
  sortBy: ticketSortFieldSchema.optional().default("createdAt"),
  sortOrder: ticketSortOrderSchema.optional().default("desc"),
  status: ticketStatusSchema.optional(),
  category: ticketCategorySchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
