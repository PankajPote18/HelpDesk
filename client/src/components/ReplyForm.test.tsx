import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReplyForm } from "./ReplyForm";
import { renderWithQuery } from "@/test/utils";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReplyForm", () => {
  it("renders a textarea and a disabled submit button when empty", () => {
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} />);

    expect(screen.getByLabelText("Add a reply")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });

  it("enables the submit button once text is entered", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} />);

    await user.type(screen.getByLabelText("Add a reply"), "Thanks for reaching out.");

    expect(screen.getByRole("button", { name: "Send reply" })).toBeEnabled();
  });

  it("keeps the submit button disabled for whitespace-only input", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} />);

    await user.type(screen.getByLabelText("Add a reply"), "   ");

    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });

  it("calls onSubmit with the trimmed reply body", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={onSubmit} onPolish={vi.fn()} />);

    await user.type(screen.getByLabelText("Add a reply"), "  Thanks, taking a look now.  ");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    expect(onSubmit).toHaveBeenCalledWith("Thanks, taking a look now.");
  });

  it("clears the textarea after a successful submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={onSubmit} onPolish={vi.fn()} />);

    const textarea = screen.getByLabelText("Add a reply") as HTMLTextAreaElement;
    await user.type(textarea, "Issue resolved.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(textarea.value).toBe(""));
  });

  it("keeps the draft text when submission fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={onSubmit} onPolish={vi.fn()} />);

    const textarea = screen.getByLabelText("Add a reply") as HTMLTextAreaElement;
    await user.type(textarea, "Still working on this.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(textarea.value).toBe("Still working on this.");
  });

  it("shows the error message when provided", () => {
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} errorMessage="Failed to send reply" />);
    expect(screen.getByText("Failed to send reply")).toBeInTheDocument();
  });

  it("does not show an error message by default", () => {
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} />);
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });

  it("disables the textarea and submit button while submitting", () => {
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} isSubmitting />);

    expect(screen.getByLabelText("Add a reply")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
  });

  it("re-enables the form once submission is no longer in flight", () => {
    const { rerender } = renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} isSubmitting />);
    expect(screen.getByLabelText("Add a reply")).toBeDisabled();

    rerender(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} isSubmitting={false} />);
    expect(screen.getByLabelText("Add a reply")).toBeEnabled();
  });

  // ── Polish ────────────────────────────────────────────────────────────────

  it("renders a disabled Polish button when empty", () => {
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Polish" })).toBeDisabled();
  });

  it("enables the Polish button once text is entered", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} />);

    await user.type(screen.getByLabelText("Add a reply"), "thx for the msg");

    expect(screen.getByRole("button", { name: "Polish" })).toBeEnabled();
  });

  it("calls onPolish with the trimmed reply body and replaces it with the result", async () => {
    const onPolish = vi.fn().mockResolvedValue({ text: "Thank you for reaching out." });
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={onPolish} />);

    const textarea = screen.getByLabelText("Add a reply") as HTMLTextAreaElement;
    await user.type(textarea, "  thx for the msg  ");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    expect(onPolish).toHaveBeenCalledWith("thx for the msg");
    await waitFor(() => expect(textarea.value).toBe("Thank you for reaching out."));
  });

  it("keeps the draft text when polishing fails", async () => {
    const onPolish = vi.fn().mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={onPolish} />);

    const textarea = screen.getByLabelText("Add a reply") as HTMLTextAreaElement;
    await user.type(textarea, "thx for the msg");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => expect(onPolish).toHaveBeenCalled());
    expect(textarea.value).toBe("thx for the msg");
  });

  it("shows the polish error message when provided", () => {
    renderWithQuery(
      <ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} polishErrorMessage="Failed to polish reply" />
    );
    expect(screen.getByText("Failed to polish reply")).toBeInTheDocument();
  });

  it("disables the textarea and both buttons while polishing", () => {
    renderWithQuery(<ReplyForm onSubmit={vi.fn()} onPolish={vi.fn()} isPolishing />);

    expect(screen.getByLabelText("Add a reply")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Polishing..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });
});
