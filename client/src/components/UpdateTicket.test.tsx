import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { TicketStatus, ManualTicketStatus, TicketCategory } from "@helpdesk/core";
import { UpdateTicket } from "./UpdateTicket";
import { renderWithQuery } from "@/test/utils";
import type { Agent } from "@/types/ticket";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  { id: "agent-1", name: "Alice Agent" },
  { id: "agent-2", name: "Bob Agent" },
];

function baseProps(): {
  status: { value: TicketStatus; onChange: (v: ManualTicketStatus) => void; isPending?: boolean; errorMessage?: string | null };
  category: { value: TicketCategory | null; onChange: (v: TicketCategory | null) => void; isPending?: boolean; errorMessage?: string | null };
  assignedTo: { value: string | null; onChange: (v: string | null) => void; isPending?: boolean; errorMessage?: string | null; agents: typeof AGENTS };
} {
  return {
    status: { value: "open", onChange: vi.fn() },
    category: { value: "refund_request", onChange: vi.fn() },
    assignedTo: { value: null, onChange: vi.fn(), agents: AGENTS },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UpdateTicket", () => {
  // ── Rendering ────────────────────────────────────────────────────────────

  it("renders title-cased status options with the current value selected", () => {
    renderWithQuery(<UpdateTicket {...baseProps()} />);

    const select = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(select.value).toBe("open");
    expect(screen.getByRole("option", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Resolved" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Closed" })).toBeInTheDocument();
  });

  it("renders title-cased category options with the current value selected", () => {
    renderWithQuery(<UpdateTicket {...baseProps()} />);

    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.value).toBe("refund_request");
    expect(screen.getByRole("option", { name: "Refund Request" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "General Question" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Technical Question" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Uncategorized" })).toBeInTheDocument();
  });

  it("selects Uncategorized when category value is null", () => {
    const props = baseProps();
    renderWithQuery(<UpdateTicket {...props} category={{ ...props.category, value: null }} />);

    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("renders agents plus an Unassigned option, with Unassigned selected by default", () => {
    renderWithQuery(<UpdateTicket {...baseProps()} />);

    const select = screen.getByLabelText("Assigned to") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "Unassigned" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alice Agent" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob Agent" })).toBeInTheDocument();
  });

  it("selects the current assignee when assignedTo.value is set", () => {
    const props = baseProps();
    renderWithQuery(<UpdateTicket {...props} assignedTo={{ ...props.assignedTo, value: "agent-2" }} />);

    const select = screen.getByLabelText("Assigned to") as HTMLSelectElement;
    expect(select.value).toBe("agent-2");
  });

  it("gives all three dropdowns the same width", () => {
    renderWithQuery(<UpdateTicket {...baseProps()} />);

    for (const label of ["Status", "Category", "Assigned to"]) {
      expect(screen.getByLabelText(label).className).toContain("w-full");
    }
  });

  // ── Change handling ──────────────────────────────────────────────────────

  it("calls status.onChange with the selected status", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    renderWithQuery(<UpdateTicket {...props} />);

    await user.selectOptions(screen.getByLabelText("Status"), "resolved");

    expect(props.status.onChange).toHaveBeenCalledWith("resolved");
  });

  it("calls category.onChange with the selected category", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    renderWithQuery(<UpdateTicket {...props} />);

    await user.selectOptions(screen.getByLabelText("Category"), "technical_question");

    expect(props.category.onChange).toHaveBeenCalledWith("technical_question");
  });

  it("calls category.onChange with null when Uncategorized is selected", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    renderWithQuery(<UpdateTicket {...props} />);

    await user.selectOptions(screen.getByLabelText("Category"), "");

    expect(props.category.onChange).toHaveBeenCalledWith(null);
  });

  it("calls assignedTo.onChange with the selected agent id", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    renderWithQuery(<UpdateTicket {...props} />);

    await user.selectOptions(screen.getByLabelText("Assigned to"), "agent-1");

    expect(props.assignedTo.onChange).toHaveBeenCalledWith("agent-1");
  });

  it("calls assignedTo.onChange with null when Unassigned is selected", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    renderWithQuery(<UpdateTicket {...props} assignedTo={{ ...props.assignedTo, value: "agent-1" }} />);

    await user.selectOptions(screen.getByLabelText("Assigned to"), "");

    expect(props.assignedTo.onChange).toHaveBeenCalledWith(null);
  });

  // ── Pending / error states, per field ────────────────────────────────────

  it("disables only the status dropdown when status is pending", () => {
    const props = baseProps();
    renderWithQuery(<UpdateTicket {...props} status={{ ...props.status, isPending: true }} />);

    expect(screen.getByLabelText("Status")).toBeDisabled();
    expect(screen.getByLabelText("Category")).toBeEnabled();
    expect(screen.getByLabelText("Assigned to")).toBeEnabled();
  });

  it("disables only the category dropdown when category is pending", () => {
    const props = baseProps();
    renderWithQuery(<UpdateTicket {...props} category={{ ...props.category, isPending: true }} />);

    expect(screen.getByLabelText("Category")).toBeDisabled();
    expect(screen.getByLabelText("Status")).toBeEnabled();
    expect(screen.getByLabelText("Assigned to")).toBeEnabled();
  });

  it("disables only the assignee dropdown when assignment is pending", () => {
    const props = baseProps();
    renderWithQuery(<UpdateTicket {...props} assignedTo={{ ...props.assignedTo, isPending: true }} />);

    expect(screen.getByLabelText("Assigned to")).toBeDisabled();
    expect(screen.getByLabelText("Status")).toBeEnabled();
    expect(screen.getByLabelText("Category")).toBeEnabled();
  });

  it("shows an error message under the relevant field only", () => {
    const props = baseProps();
    renderWithQuery(
      <UpdateTicket {...props} status={{ ...props.status, errorMessage: "Failed to update status" }} />
    );

    expect(screen.getByText("Failed to update status")).toBeInTheDocument();
    expect(screen.queryByText("Failed to update category")).not.toBeInTheDocument();
  });

  it("shows no error messages by default", () => {
    renderWithQuery(<UpdateTicket {...baseProps()} />);
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });
});
