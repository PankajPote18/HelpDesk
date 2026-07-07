import type { TicketStatus, TicketCategory } from "@helpdesk/core";

export const statusLabels: Record<TicketStatus, string> = {
  new: "New",
  processing: "Processing",
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const statusStyles: Record<TicketStatus, string> = {
  new: "bg-[#b14a2e]/10 text-[#b14a2e]",
  processing: "bg-[#b8862e]/10 text-[#b8862e]",
  open: "bg-primary/10 text-primary",
  resolved: "bg-[#2e9b6b]/10 text-[#2e9b6b]",
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
