import type { TicketStatus, TicketCategory } from "@helpdesk/core";

export interface Agent {
  id: string;
  name: string;
}

export interface Reply {
  id: string;
  body: string;
  createdAt: string;
  author: Agent;
}

export interface Ticket {
  id: string;
  subject: string;
  body?: string;
  status: TicketStatus;
  category: TicketCategory | null;
  requesterEmail: string;
  requesterName: string | null;
  createdAt: string;
  updatedAt?: string;
  assignedTo: Agent | null;
  replies?: Reply[];
}
