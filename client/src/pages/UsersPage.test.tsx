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

  it("removes the user from the table after confirming deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    vi.mocked(axios.delete).mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Agent Smith");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(
      `/api/users/${AGENT.id}`,
      expect.objectContaining({ withCredentials: true })
    );
    await waitFor(() => {
      expect(screen.queryByText("Agent Smith")).not.toBeInTheDocument();
    });
  });

  it("does not delete the user when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(axios.get).mockResolvedValue({ data: [AGENT] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Agent Smith");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(vi.mocked(axios.delete)).not.toHaveBeenCalled();
    expect(screen.getByText("Agent Smith")).toBeInTheDocument();
  });
});
