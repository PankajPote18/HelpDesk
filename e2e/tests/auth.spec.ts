import { type Page, test, expect } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

// Needed for the API-level auth-boundary tests below, which hit the Express
// server directly (bypassing the Vite proxy) the same way
// e2e/tests/inbound-email-webhook.spec.ts does.
dotenv.config({ path: path.resolve(__dirname, "../../server/.env.test") });
const SERVER_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * Logs in via the UI as the given user and waits for the post-login redirect to '/'.
 * Each Playwright test runs in an isolated browser context (no shared cookies),
 * so callers do not need to log out before calling this helper.
 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}

test.describe("Authentication", () => {
  // ---------------------------------------------------------------------------
  // Login flow
  // ---------------------------------------------------------------------------
  test.describe("Login flow", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("admin can log in and is redirected to the homepage", async ({
      page,
    }) => {
      await page.getByLabel("Email address").fill("admin@test.com");
      await page.getByLabel("Password").fill("TestAdmin1!");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("heading", { name: "Tickets" })
      ).toBeVisible();
    });

    test("agent can log in and is redirected to the homepage", async ({
      page,
    }) => {
      await page.getByLabel("Email address").fill("agent@test.com");
      await page.getByLabel("Password").fill("TestAgent1!");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("heading", { name: "Tickets" })
      ).toBeVisible();
    });

    test("wrong password shows an error message", async ({ page }) => {
      await page.getByLabel("Email address").fill("admin@test.com");
      await page.getByLabel("Password").fill("WrongPassword1!");
      await page.getByRole("button", { name: "Sign in" }).click();

      // Better Auth returns INVALID_EMAIL_OR_PASSWORD for all credential failures.
      // The LoginPage surfaces ctx.error.message directly in the error div.
      await expect(page.getByText("Invalid email or password")).toBeVisible();
      await expect(page).toHaveURL("/login");
    });

    test("unknown email shows an error message", async ({ page }) => {
      await page.getByLabel("Email address").fill("nobody@example.com");
      await page.getByLabel("Password").fill("SomePassword1!");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("Invalid email or password")).toBeVisible();
      await expect(page).toHaveURL("/login");
    });

    test("submitting empty fields shows client-side validation errors", async ({
      page,
    }) => {
      // react-hook-form + zod intercepts submission and shows inline errors
      // without ever reaching the server.
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("Enter a valid email address")).toBeVisible();
      await expect(page.getByText("Password is required")).toBeVisible();
      await expect(page).toHaveURL("/login");
    });

    test("valid email format but unregistered address shows an error message", async ({
      page,
    }) => {
      // Email is syntactically valid so it passes zod; the server rejects it.
      await page.getByLabel("Email address").fill("valid-but-not-seeded@example.com");
      await page.getByLabel("Password").fill("AnyPassword1!");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("Invalid email or password")).toBeVisible();
      await expect(page).toHaveURL("/login");
    });
  });

  // ---------------------------------------------------------------------------
  // Session persistence
  // ---------------------------------------------------------------------------
  test.describe("Session persistence", () => {
    test("after login, refreshing the page keeps the user logged in", async ({
      page,
    }) => {
      await loginAs(page, "agent@test.com", "TestAgent1!");

      await page.reload();

      // Session cookie is scoped to localhost:3000; Better Auth's useSession()
      // refetches and restores the session after reload.
      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("heading", { name: "Tickets" })
      ).toBeVisible();
    });

    test("visiting a protected route while unauthenticated redirects to /login", async ({
      page,
    }) => {
      await page.goto("/");

      // ProtectedRoute renders "Loading..." while isPending, then redirects to
      // /login once the null session resolves.
      await expect(page).toHaveURL("/login");
    });
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  test.describe("Logout", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, "agent@test.com", "TestAgent1!");
    });

    test("signing out clears the session and redirects to /login", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Sign out" }).click();

      await expect(page).toHaveURL("/login");
    });

    test("after logout, accessing a protected route redirects to /login", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL("/login");

      // Attempt to access the protected home route; must be blocked.
      await page.goto("/");
      await expect(page).toHaveURL("/login");
    });
  });

  // ---------------------------------------------------------------------------
  // Role-based access
  // ---------------------------------------------------------------------------
  test.describe("Role-based access", () => {
    test("admin can navigate to /users and see the Users page", async ({
      page,
    }) => {
      await loginAs(page, "admin@test.com", "TestAdmin1!");
      await page.goto("/users");

      await expect(page).toHaveURL("/users");
      await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    });

    test("admin navbar shows the Users management link", async ({ page }) => {
      await loginAs(page, "admin@test.com", "TestAdmin1!");

      await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
    });

    test("agent navbar does not show the Users management link", async ({
      page,
    }) => {
      await loginAs(page, "agent@test.com", "TestAgent1!");

      // The Navbar only renders the Users link when role === "admin".
      await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
    });

    test("agent accessing /users is redirected to the homepage", async ({
      page,
    }) => {
      await loginAs(page, "agent@test.com", "TestAgent1!");
      await page.goto("/users");

      // AdminRoute redirects non-admins to '/', not '/login'.
      // The ProtectedRoute at '/' then renders normally (session exists).
      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("heading", { name: "Tickets" })
      ).toBeVisible();
    });

    test("unauthenticated user accessing /users is redirected to /login", async ({
      page,
    }) => {
      await page.goto("/users");

      // Chain: AdminRoute → '/' → ProtectedRoute → '/login'
      await expect(page).toHaveURL("/login");
    });

    // /api/users (requireAuth + requireAdmin) and /api/tickets (requireAuth)
    // now exist, so these two API-level boundary tests are active. The
    // standalone `request` fixture keeps its own cookie jar across calls made
    // through it within a single test, so signing in via a raw POST to
    // /api/auth/sign-in/email and then reusing `request` for the follow-up
    // call sends the session cookie automatically — no manual header wiring
    // needed. See Better Auth docs: POST /sign-in/email returns a Set-Cookie
    // session cookie and { redirect, token, user } on success.

    test("agent hitting an admin-only API route directly returns 403", async ({
      request,
    }) => {
      const signInResponse = await request.post(
        `${SERVER_URL}/api/auth/sign-in/email`,
        { data: { email: "agent@test.com", password: "TestAgent1!" } }
      );
      expect(signInResponse.ok()).toBeTruthy();

      const response = await request.get(`${SERVER_URL}/api/users`);
      expect(response.status()).toBe(403);
      const payload = await response.json();
      expect(payload.error).toBe("Forbidden");
    });

    test("unauthenticated request to a protected API route returns 401", async ({
      request,
    }) => {
      const response = await request.get(`${SERVER_URL}/api/tickets`);
      expect(response.status()).toBe(401);
      const payload = await response.json();
      expect(payload.error).toBe("Unauthorized");
    });
  });

  // ---------------------------------------------------------------------------
  // Sign-up disabled
  // ---------------------------------------------------------------------------
  test.describe("Sign-up disabled", () => {
    test("the login page has no sign-up link or registration button", async ({
      page,
    }) => {
      await page.goto("/login");

      // Agents are created by admins only; there is no self-serve registration.
      await expect(
        page.getByRole("link", { name: /sign.?up|register|create account/i })
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /sign.?up|register|create account/i })
      ).toHaveCount(0);
    });

    test("there is no /register route — no sign-up form is rendered", async ({
      page,
    }) => {
      // React Router renders a default error page for unmatched paths.
      // In all cases, no registration form should be present.
      await page.goto("/register");

      await expect(page.getByLabel("Email address")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /sign.?up|register/i })
      ).toHaveCount(0);
    });
  });
});
