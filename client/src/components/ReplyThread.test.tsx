import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReplyThread } from "./ReplyThread";
import { renderWithQuery } from "@/test/utils";
import type { Reply } from "@/types/ticket";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REPLIES: Reply[] = [
  {
    id: "reply-1",
    body: "Thanks for reaching out, looking into this.",
    createdAt: "2026-01-02T00:00:00Z",
    author: { id: "agent-1", name: "Alice Agent" },
  },
  {
    id: "reply-2",
    body: "We've issued the refund.",
    createdAt: "2026-01-03T00:00:00Z",
    author: { id: "agent-2", name: "Bob Agent" },
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReplyThread", () => {
  it("shows a placeholder when there are no replies", () => {
    renderWithQuery(<ReplyThread replies={[]} onSubmit={vi.fn()} />);
    expect(screen.getByText("No replies yet.")).toBeInTheDocument();
  });

  it("does not show a reply count when there are no replies", () => {
    renderWithQuery(<ReplyThread replies={[]} onSubmit={vi.fn()} />);
    expect(screen.getByText("Replies")).toBeInTheDocument();
  });

  it("renders each reply's author, body, and formatted date", () => {
    renderWithQuery(<ReplyThread replies={REPLIES} onSubmit={vi.fn()} />);

    expect(screen.getByText("Alice Agent")).toBeInTheDocument();
    expect(screen.getByText("Thanks for reaching out, looking into this.")).toBeInTheDocument();
    expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    expect(screen.getByText("We've issued the refund.")).toBeInTheDocument();
    expect(screen.getByText(new Date(REPLIES[0].createdAt).toLocaleString())).toBeInTheDocument();
  });

  it("renders replies in the order given (oldest first, as passed in)", () => {
    renderWithQuery(<ReplyThread replies={REPLIES} onSubmit={vi.fn()} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Alice Agent");
    expect(items[1]).toHaveTextContent("Bob Agent");
  });

  it("shows the reply count in the heading when there are replies", () => {
    renderWithQuery(<ReplyThread replies={REPLIES} onSubmit={vi.fn()} />);
    expect(screen.getByText("Replies (2)")).toBeInTheDocument();
  });

  it("does not show the placeholder once there are replies", () => {
    renderWithQuery(<ReplyThread replies={REPLIES} onSubmit={vi.fn()} />);
    expect(screen.queryByText("No replies yet.")).not.toBeInTheDocument();
  });

  it("renders the reply form below the thread", () => {
    renderWithQuery(<ReplyThread replies={REPLIES} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Add a reply")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeInTheDocument();
  });

  it("forwards submission to the onSubmit prop", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQuery(<ReplyThread replies={[]} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Add a reply"), "Following up.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    expect(onSubmit).toHaveBeenCalledWith("Following up.");
  });

  it("forwards isSubmitting to the reply form", () => {
    renderWithQuery(<ReplyThread replies={[]} onSubmit={vi.fn()} isSubmitting />);
    expect(screen.getByLabelText("Add a reply")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeInTheDocument();
  });

  it("forwards errorMessage to the reply form", () => {
    renderWithQuery(<ReplyThread replies={[]} onSubmit={vi.fn()} errorMessage="Failed to send reply" />);
    expect(screen.getByText("Failed to send reply")).toBeInTheDocument();
  });
});
