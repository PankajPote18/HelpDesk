import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TicketDetail } from "./TicketDetail";
import { renderWithQuery } from "@/test/utils";
import type { Ticket } from "@/types/ticket";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CREATED_AT = "2026-01-01T12:00:00Z";

const BASE_TICKET: Ticket = {
  id: "ticket-1",
  subject: "Refund request for order #123",
  body: "Hi, I would like a refund for order #123.",
  status: "open",
  category: "refund_request",
  requesterEmail: "jane@example.com",
  requesterName: "Jane Doe",
  createdAt: CREATED_AT,
  assignedTo: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TicketDetail", () => {
  it("renders the subject as a heading", () => {
    renderWithQuery(<TicketDetail ticket={BASE_TICKET} />);
    expect(screen.getByRole("heading", { name: "Refund request for order #123" })).toBeInTheDocument();
  });

  it("renders the message body", () => {
    renderWithQuery(<TicketDetail ticket={BASE_TICKET} />);
    expect(screen.getByText("Hi, I would like a refund for order #123.")).toBeInTheDocument();
  });

  it("renders requester name and email together when a name is set", () => {
    renderWithQuery(<TicketDetail ticket={BASE_TICKET} />);
    expect(screen.getByText("Jane Doe <jane@example.com>")).toBeInTheDocument();
  });

  it("renders just the email when there is no requester name", () => {
    renderWithQuery(<TicketDetail ticket={{ ...BASE_TICKET, requesterName: null }} />);
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
  });

  it("renders the created date formatted the same way the component computes it", () => {
    renderWithQuery(<TicketDetail ticket={BASE_TICKET} />);
    const expected = new Date(CREATED_AT).toLocaleString();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("does not render a reply thread or reply form", () => {
    renderWithQuery(<TicketDetail ticket={BASE_TICKET} />);
    expect(screen.queryByText(/repl/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send reply/i })).not.toBeInTheDocument();
  });
});
