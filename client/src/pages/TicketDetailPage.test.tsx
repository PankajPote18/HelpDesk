import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TicketDetailPage } from "./TicketDetailPage";
import { renderWithQuery } from "@/test/utils";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: { user: { name: "Agent Smith", role: "agent" } },
      isPending: false,
    })),
    signOut: vi.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type Reply = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

type Ticket = {
  id: string;
  subject: string;
  body: string;
  status: "open" | "resolved" | "closed";
  category: "general_question" | "technical_question" | "refund_request" | null;
  requesterEmail: string;
  requesterName: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  replies: Reply[];
};

const TICKET_ID = "ticket-1";

const AGENTS = [
  { id: "agent-1", name: "Alice Agent" },
  { id: "agent-2", name: "Bob Agent" },
];

const BASE_TICKET: Ticket = {
  id: TICKET_ID,
  subject: "Refund request for order #123",
  body: "Hi, I would like a refund for order #123.",
  status: "open",
  category: "refund_request",
  requesterEmail: "jane@example.com",
  requesterName: "Jane Doe",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  assignedTo: null,
  replies: [],
};

const ASSIGNED_TICKET: Ticket = {
  ...BASE_TICKET,
  assignedTo: { id: AGENTS[0].id, name: AGENTS[0].name },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return renderWithQuery(<TicketDetailPage />, {
    route: `/tickets/${TICKET_ID}`,
    path: "/tickets/:id",
  });
}

function mockGetFor(ticket: Ticket) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/tickets/agents") {
      return Promise.resolve({ data: AGENTS });
    }
    return Promise.resolve({ data: ticket });
  });
}

async function renderAndWaitForTicket(ticket: Ticket) {
  mockGetFor(ticket);
  renderPage();
  await screen.findByText(ticket.subject);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TicketDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── Loading / rendering ──────────────────────────────────────────────────

  it("shows skeletons while loading", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders ticket details with title-cased status and category", async () => {
    await renderAndWaitForTicket(BASE_TICKET);

    expect(screen.getByText("Jane Doe <jane@example.com>")).toBeInTheDocument();
    expect(screen.getByText("Hi, I would like a refund for order #123.")).toBeInTheDocument();

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(statusSelect.value).toBe("open");
    expect(screen.getByRole("option", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Resolved" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Closed" })).toBeInTheDocument();

    const categorySelect = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(categorySelect.value).toBe("refund_request");
    expect(screen.getByRole("option", { name: "Refund Request" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "General Question" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Technical Question" })).toBeInTheDocument();
  });

  it("shows Uncategorized when the ticket has no category", async () => {
    await renderAndWaitForTicket({ ...BASE_TICKET, category: null });
    const categorySelect = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(categorySelect.value).toBe("");
    expect(screen.getByRole("option", { name: "Uncategorized" })).toBeInTheDocument();
  });

  it("puts the Status, Category, and Assigned to dropdowns at the same width", async () => {
    await renderAndWaitForTicket(BASE_TICKET);

    const statusSelect = screen.getByLabelText("Status");
    const categorySelect = screen.getByLabelText("Category");
    const assigneeSelect = screen.getByLabelText("Assigned to");

    for (const select of [statusSelect, categorySelect, assigneeSelect]) {
      expect(select.className).toContain("w-full");
    }
  });

  // ── Status updates ───────────────────────────────────────────────────────

  it("updates the ticket status", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    vi.mocked(axios.patch).mockResolvedValue({ data: { ...BASE_TICKET, status: "resolved" } });
    const user = userEvent.setup();

    const select = screen.getByLabelText("Status");
    await user.selectOptions(select, "resolved");

    expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
      `/api/tickets/${TICKET_ID}/status`,
      { status: "resolved" },
      expect.objectContaining({ withCredentials: true })
    );
    await waitFor(() => {
      expect((select as HTMLSelectElement).value).toBe("resolved");
    });
  });

  it("shows an inline error when the status update fails", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    const err = { isAxiosError: true, response: { data: { error: "Failed to update status" } } };
    vi.mocked(axios.patch).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Status"), "closed");

    expect(await screen.findByText("Failed to update status")).toBeInTheDocument();
  });

  // ── Category updates ─────────────────────────────────────────────────────

  it("updates the ticket category", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...BASE_TICKET, category: "technical_question" },
    });
    const user = userEvent.setup();

    const select = screen.getByLabelText("Category");
    await user.selectOptions(select, "technical_question");

    expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
      `/api/tickets/${TICKET_ID}/category`,
      { category: "technical_question" },
      expect.objectContaining({ withCredentials: true })
    );
    await waitFor(() => {
      expect((select as HTMLSelectElement).value).toBe("technical_question");
    });
  });

  it("clears the category to Uncategorized", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    vi.mocked(axios.patch).mockResolvedValue({ data: { ...BASE_TICKET, category: null } });
    const user = userEvent.setup();

    const select = screen.getByLabelText("Category");
    await user.selectOptions(select, "");

    expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
      `/api/tickets/${TICKET_ID}/category`,
      { category: null },
      expect.objectContaining({ withCredentials: true })
    );
  });

  it("shows an inline error when the category update fails", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    const err = { isAxiosError: true, response: { data: { error: "Failed to update category" } } };
    vi.mocked(axios.patch).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Category"), "general_question");

    expect(await screen.findByText("Failed to update category")).toBeInTheDocument();
  });

  // ── Assignment: dropdown population ──────────────────────────────────────

  it("populates the assignee dropdown with fetched agents", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    const select = screen.getByLabelText("Assigned to") as HTMLSelectElement;

    expect(screen.getByRole("option", { name: "Alice Agent" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob Agent" })).toBeInTheDocument();
    expect(select.value).toBe("");
  });

  it("shows the currently assigned agent as selected", async () => {
    await renderAndWaitForTicket(ASSIGNED_TICKET);
    const select = screen.getByLabelText("Assigned to") as HTMLSelectElement;
    expect(select.value).toBe(AGENTS[0].id);
  });

  // ── Assignment: mutation behavior ────────────────────────────────────────

  it("assigns the ticket to the selected agent", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...BASE_TICKET, assignedTo: { id: AGENTS[1].id, name: AGENTS[1].name } },
    });
    const user = userEvent.setup();

    const select = screen.getByLabelText("Assigned to");
    await user.selectOptions(select, AGENTS[1].id);

    expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
      `/api/tickets/${TICKET_ID}/assign`,
      { assignedToId: AGENTS[1].id },
      expect.objectContaining({ withCredentials: true })
    );

    await waitFor(() => {
      expect((select as HTMLSelectElement).value).toBe(AGENTS[1].id);
    });
  });

  it("unassigns the ticket when Unassigned is selected", async () => {
    await renderAndWaitForTicket(ASSIGNED_TICKET);
    vi.mocked(axios.patch).mockResolvedValue({ data: BASE_TICKET });
    const user = userEvent.setup();

    const select = screen.getByLabelText("Assigned to");
    await user.selectOptions(select, "");

    expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
      `/api/tickets/${TICKET_ID}/assign`,
      { assignedToId: null },
      expect.objectContaining({ withCredentials: true })
    );

    await waitFor(() => {
      expect((select as HTMLSelectElement).value).toBe("");
    });
  });

  it("shows an inline error when assignment fails", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    const err = {
      isAxiosError: true,
      response: { data: { error: "Assignee must be an active agent" } },
    };
    vi.mocked(axios.patch).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Assigned to"), AGENTS[0].id);

    expect(await screen.findByText("Assignee must be an active agent")).toBeInTheDocument();
  });

  it("disables the dropdown while the assignment is in flight", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    let resolvePatch!: (value: { data: Ticket }) => void;
    vi.mocked(axios.patch).mockReturnValue(
      new Promise((resolve) => {
        resolvePatch = resolve;
      })
    );
    const user = userEvent.setup();

    const select = screen.getByLabelText("Assigned to") as HTMLSelectElement;
    await user.selectOptions(select, AGENTS[0].id);

    expect(select).toBeDisabled();

    resolvePatch({ data: { ...BASE_TICKET, assignedTo: { id: AGENTS[0].id, name: AGENTS[0].name } } });
    await waitFor(() => expect(select).not.toBeDisabled());
  });

  // ── Reply thread ─────────────────────────────────────────────────────────

  it("shows a placeholder when there are no replies yet", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    expect(screen.getByText("No replies yet.")).toBeInTheDocument();
  });

  it("renders existing replies with author and body", async () => {
    const ticketWithReplies: Ticket = {
      ...BASE_TICKET,
      replies: [
        { id: "reply-1", body: "Thanks for reaching out, looking into this.", createdAt: "2026-01-02T00:00:00Z", author: AGENTS[0] },
      ],
    };
    await renderAndWaitForTicket(ticketWithReplies);

    // "Alice Agent" also appears as an <option> in the Assigned to select, so scope to the reply's <span>.
    expect(screen.getByText("Alice Agent", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Thanks for reaching out, looking into this.")).toBeInTheDocument();
    expect(screen.queryByText("No replies yet.")).not.toBeInTheDocument();
  });

  it("submits a new reply and appends it to the thread", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    const newReply = {
      id: "reply-2",
      body: "We've issued the refund.",
      createdAt: "2026-01-03T00:00:00Z",
      author: { id: "agent-1", name: "Alice Agent" },
    };
    vi.mocked(axios.post).mockResolvedValue({ data: newReply });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Add a reply"), "We've issued the refund.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
      `/api/tickets/${TICKET_ID}/replies`,
      { body: "We've issued the refund." },
      expect.objectContaining({ withCredentials: true })
    );
    expect(await screen.findByText("We've issued the refund.")).toBeInTheDocument();
    expect(screen.queryByText("No replies yet.")).not.toBeInTheDocument();
  });

  it("clears the textarea after a successful reply", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    vi.mocked(axios.post).mockResolvedValue({
      data: { id: "reply-2", body: "Done.", createdAt: "2026-01-03T00:00:00Z", author: AGENTS[0] },
    });
    const user = userEvent.setup();

    const textarea = screen.getByLabelText("Add a reply") as HTMLTextAreaElement;
    await user.type(textarea, "Done.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(textarea.value).toBe(""));
  });

  it("disables the submit button when the reply is empty", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });

  it("shows an inline error when submitting a reply fails", async () => {
    await renderAndWaitForTicket(BASE_TICKET);
    const err = { isAxiosError: true, response: { data: { error: "Reply cannot be empty" } } };
    vi.mocked(axios.post).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Add a reply"), "Following up on this.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    expect(await screen.findByText("Reply cannot be empty")).toBeInTheDocument();
  });
});
