import type { TicketStatus, TicketCategory } from "@helpdesk/core";

export const statusLabels: Record<TicketStatus, string> = {
  new: "New",
  processing: "Processing",
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const statusStyles: Record<TicketStatus, string> = {
  new: "bg-sky-500/10 text-sky-600",
  processing: "bg-amber-500/10 text-amber-600",
  open: "bg-primary/10 text-primary",
  resolved: "bg-emerald-500/10 text-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

export const categoryLabels: Record<TicketCategory, string> = {
  general_question: "General Question",
  technical_question: "Technical Question",
  refund_request: "Refund Request",
};

export function formatCategory(category: TicketCategory | null): string {
  return category ? categoryLabels[category] : "Uncategorized";
}
