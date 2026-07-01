import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UsersPage } from "./UsersPage";
import { renderWithQuery } from "@/test/utils";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: { user: { name: "Admin User", role: "admin" } },
      isPending: false,
    })),
    signOut: vi.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN: User = {
  id: "1",
  name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  createdAt: "2024-01-01T00:00:00Z",
};

const AGENT: User = {
  id: "2",
  name: "Agent Smith",
  email: "agent@example.com",
  role: "agent",
  createdAt: "2024-01-02T00:00:00Z",
};

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return renderWithQuery(<UsersPage />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UsersPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("shows skeleton rows while loading", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Agent Smith")).not.toBeInTheDocument();
  });

  // ── Success state ────────────────────────────────────────────────────────

  it("renders all users in the table", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [ADMIN, AGENT] });
    renderPage();

    // Wait for the table row data — emails are unique to the table, not the navbar
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("agent@example.com")).toBeInTheDocument();
    expect(screen.getByText("Agent Smith")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
  });

  it("shows empty state when there are no users", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it("shows error message when fetch fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    renderPage();
    expect(await screen.findByText(/failed to load users/i)).toBeInTheDocument();
  });

  it("shows the server error message when the API returns one", async () => {
    const err = { isAxiosError: true, response: { data: { error: "Forbidden" } } };
    vi.mocked(axios.get).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    renderPage();
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });

  // ── Admin / agent role distinction ───────────────────────────────────────

  it("does not render a delete button for admin users", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [ADMIN, AGENT] });
    renderPage();

    // Wait for agent row — only then is the table fully rendered
    await screen.findByText("agent@example.com");
    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    expect(deleteButtons).toHaveLength(1);
  });

  // ── Create modal ─────────────────────────────────────────────────────────

  it("opens the create modal when clicking the Create user button", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/no users found/i);
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(screen.getByRole("heading", { name: /create agent/i })).toBeInTheDocument();
  });

  it("closes the modal when clicking Cancel", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/no users found/i);
    await user.click(screen.getByRole("button", { name: "Create user" }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("heading", { name: /create agent/i })).not.toBeInTheDocument();
  });

  it("closes the modal when clicking the backdrop", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/no users found/i);
    await user.click(screen.getByRole("button", { name: "Create user" }));

    const backdrop = document.querySelector(".fixed.inset-0") as HTMLElement;
    await user.click(backdrop);

    expect(screen.queryByRole("heading", { name: /create agent/i })).not.toBeInTheDocument();
  });

  // ── Create user submission ───────────────────────────────────────────────

  it("adds the new user to the table on successful creation", async () => {
    const newAgent: User = {
      id: "3",
      name: "New Agent",
      email: "new@example.com",
      role: "agent",
      createdAt: "2024-03-01T00:00:00Z",
    };
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    vi.mocked(axios.post).mockResolvedValue({ data: newAgent });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Agent Smith");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    const modal = screen.getByRole("heading", { name: /create agent/i }).closest("div")!;
    await user.type(within(modal).getByLabelText(/^name$/i), "New Agent");
    await user.type(within(modal).getByLabelText(/^email$/i), "new@example.com");
    await user.type(within(modal).getByLabelText(/^password$/i), "password123");
    await user.click(within(modal).getByRole("button", { name: "Create user" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /create agent/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText("New Agent")).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
  });

  it("shows a server error inside the modal when creation fails", async () => {
    const err = {
      isAxiosError: true,
      response: { data: { error: "A user with that email already exists" } },
    };
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    vi.mocked(axios.post).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/no users found/i);
    await user.click(screen.getByRole("button", { name: "Create user" }));

    const modal = screen.getByRole("heading", { name: /create agent/i }).closest("div")!;
    await user.type(within(modal).getByLabelText(/^name$/i), "Duplicate");
    await user.type(within(modal).getByLabelText(/^email$/i), "admin@example.com");
    await user.type(within(modal).getByLabelText(/^password$/i), "password123");
    await user.click(within(modal).getByRole("button", { name: "Create user" }));

    expect(
      await within(modal).findByText(/a user with that email already exists/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /create agent/i })).toBeInTheDocument();
  });

  // ── Delete user ──────────────────────────────────────────────────────────

  it("opens the delete confirmation modal when clicking Delete", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByRole("heading", { name: /delete user/i })).toBeInTheDocument();
    expect(screen.getByText(AGENT.name, { selector: "span" })).toBeInTheDocument();
  });

  it("closes the delete modal when clicking Cancel", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    const modal = screen.getByRole("heading", { name: /delete user/i }).closest("div")!;
    await user.click(within(modal).getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("heading", { name: /delete user/i })).not.toBeInTheDocument();
    expect(vi.mocked(axios.delete)).not.toHaveBeenCalled();
  });

  it("closes the delete modal when clicking the backdrop", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    const backdrops = document.querySelectorAll(".fixed.inset-0");
    await user.click(backdrops[backdrops.length - 1] as HTMLElement);

    expect(screen.queryByRole("heading", { name: /delete user/i })).not.toBeInTheDocument();
    expect(vi.mocked(axios.delete)).not.toHaveBeenCalled();
  });

  it("removes the user from the table after confirming deletion", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    vi.mocked(axios.delete).mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    const modal = screen.getByRole("heading", { name: /delete user/i }).closest("div")!;
    await user.click(within(modal).getByRole("button", { name: /^delete$/i }));

    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(
      `/api/users/${AGENT.id}`,
      expect.objectContaining({ withCredentials: true })
    );
    await waitFor(() => {
      expect(screen.queryByText("Agent Smith")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /delete user/i })).not.toBeInTheDocument();
  });

  it("shows a server error inside the delete modal when deletion fails", async () => {
    const err = {
      isAxiosError: true,
      response: { data: { error: "Cannot delete your own account" } },
    };
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    vi.mocked(axios.delete).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    const modal = screen.getByRole("heading", { name: /delete user/i }).closest("div")!;
    await user.click(within(modal).getByRole("button", { name: /^delete$/i }));

    expect(
      await within(modal).findByText(/cannot delete your own account/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /delete user/i })).toBeInTheDocument();
  });

  // ── Edit user ────────────────────────────────────────────────────────────

  it("opens the edit modal pre-populated with user data", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: `Edit ${AGENT.name}` }));

    const modal = screen.getByRole("heading", { name: /edit user/i }).closest("div")!;
    expect(within(modal).getByLabelText(/^name$/i)).toHaveValue(AGENT.name);
    expect(within(modal).getByLabelText(/^email$/i)).toHaveValue(AGENT.email);
    expect(within(modal).getByLabelText(/new password/i)).toHaveValue("");
  });

  it("closes the edit modal when clicking Cancel", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: `Edit ${AGENT.name}` }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("heading", { name: /edit user/i })).not.toBeInTheDocument();
  });

  it("closes the edit modal when clicking the backdrop", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: `Edit ${AGENT.name}` }));

    const backdrop = document.querySelector(".fixed.inset-0") as HTMLElement;
    await user.click(backdrop);

    expect(screen.queryByRole("heading", { name: /edit user/i })).not.toBeInTheDocument();
  });

  it("shows a validation error when the new password is too short", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: `Edit ${AGENT.name}` }));

    const modal = screen.getByRole("heading", { name: /edit user/i }).closest("div")!;
    await user.type(within(modal).getByLabelText(/new password/i), "short");
    await user.click(within(modal).getByRole("button", { name: /save changes/i }));

    expect(
      await within(modal).findByText(/password must be at least 8 characters/i)
    ).toBeInTheDocument();
    expect(vi.mocked(axios.patch)).not.toHaveBeenCalled();
  });

  it("updates name and email and closes the modal on success", async () => {
    const updated = { ...AGENT, name: "Updated Name", email: "updated@example.com" };
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    vi.mocked(axios.patch).mockResolvedValue({ data: updated });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: `Edit ${AGENT.name}` }));

    const modal = screen.getByRole("heading", { name: /edit user/i }).closest("div")!;
    await user.clear(within(modal).getByLabelText(/^name$/i));
    await user.type(within(modal).getByLabelText(/^name$/i), "Updated Name");
    await user.clear(within(modal).getByLabelText(/^email$/i));
    await user.type(within(modal).getByLabelText(/^email$/i), "updated@example.com");
    await user.click(within(modal).getByRole("button", { name: /save changes/i }));

    expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
      `/api/users/${AGENT.id}`,
      expect.objectContaining({ name: "Updated Name", email: "updated@example.com", password: "" }),
      expect.objectContaining({ withCredentials: true })
    );
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /edit user/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Updated Name")).toBeInTheDocument();
    expect(screen.getByText("updated@example.com")).toBeInTheDocument();
  });

  it("includes the new password in the request when provided", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    vi.mocked(axios.patch).mockResolvedValue({ data: AGENT });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: `Edit ${AGENT.name}` }));

    const modal = screen.getByRole("heading", { name: /edit user/i }).closest("div")!;
    await user.type(within(modal).getByLabelText(/new password/i), "newpassword123");
    await user.click(within(modal).getByRole("button", { name: /save changes/i }));

    expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
      `/api/users/${AGENT.id}`,
      expect.objectContaining({ password: "newpassword123" }),
      expect.objectContaining({ withCredentials: true })
    );
  });

  it("shows a server error inside the modal when the edit fails", async () => {
    const err = {
      isAxiosError: true,
      response: { data: { error: "A user with that email already exists" } },
    };
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    vi.mocked(axios.patch).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("agent@example.com");
    await user.click(screen.getByRole("button", { name: `Edit ${AGENT.name}` }));

    const modal = screen.getByRole("heading", { name: /edit user/i }).closest("div")!;
    await user.click(within(modal).getByRole("button", { name: /save changes/i }));

    expect(
      await within(modal).findByText(/a user with that email already exists/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /edit user/i })).toBeInTheDocument();
  });
});
