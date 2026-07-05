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

export const assignTicketSchema = z.object({
  assignedToId: z.string().min(1, "assignedToId is required").nullable(),
});
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
});
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

export const updateTicketCategorySchema = z.object({
  category: ticketCategorySchema.nullable(),
});
export type UpdateTicketCategoryInput = z.infer<typeof updateTicketCategorySchema>;

export const createTicketReplySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty"),
});
export type CreateTicketReplyInput = z.infer<typeof createTicketReplySchema>;
