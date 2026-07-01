import { type Page, test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@test.com";
const ADMIN_PASSWORD = "TestAdmin1!";

/**
 * Name assigned to the seeded agent by seed-agent.ts.
 * Used to build the aria-label on the edit icon button: `Edit ${user.name}`.
 */
const SEEDED_AGENT_NAME = "Agent";
const SEEDED_AGENT_EMAIL = "agent@test.com";

/**
 * Signs in as the admin and waits for the post-login redirect to '/'.
 * Each Playwright test runs in an isolated browser context so no prior
 * sign-out is needed.
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}

test.describe("Admin user management", () => {
  // Navigate to /users as admin before every test in this suite.
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/users");
  });

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  test("admin can view the users table and the seeded agent appears", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    // The seeded agent row must be present once the async fetch resolves.
    await expect(page.getByText(SEEDED_AGENT_EMAIL)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  test("admin creates a new agent and the new user appears in the table", async ({
    page,
  }) => {
    // Timestamp-based email prevents collisions on re-runs within the same
    // test-database lifetime (global-setup resets the DB between full runs).
    const uniqueEmail = `newagent+${Date.now()}@example.com`;
    const newName = "New Test Agent";
    const newPassword = "SecurePass1!";

    // Open the create modal.
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("heading", { name: "Create agent" })).toBeVisible();

    // Scope to the modal card (direct parent of the h2) to avoid any selector
    // collision with same-name labels that might exist elsewhere on the page.
    const createCard = page
      .getByRole("heading", { name: "Create agent" })
      .locator("xpath=..");

    await createCard.getByLabel("Name").fill(newName);
    await createCard.getByLabel("Email").fill(uniqueEmail);
    await createCard.getByLabel("Password").fill(newPassword);

    // The "Create user" text appears both on the page-level button and the modal
    // submit button; scoping to createCard targets only the submit button.
    await createCard.getByRole("button", { name: "Create user" }).click();

    // Modal closes and the new row is visible in the table.
    await expect(
      page.getByRole("heading", { name: "Create agent" })
    ).not.toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();
    await expect(page.getByText(newName)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------

  test("admin edits the seeded agent's name and the table reflects the update", async ({
    page,
  }) => {
    // A timestamp suffix avoids a stale-name false-pass if the previous run
    // left the DB in a modified state (full suite resets it, but just in case).
    const updatedName = `Agent Renamed ${Date.now()}`;

    // The edit icon button carries aria-label="Edit {user.name}".
    await page
      .getByRole("button", { name: `Edit ${SEEDED_AGENT_NAME}` })
      .click();
    await expect(page.getByRole("heading", { name: "Edit user" })).toBeVisible();

    // Scope to the modal card and update the Name field.
    // fill() clears the existing value before typing the new one.
    const editCard = page
      .getByRole("heading", { name: "Edit user" })
      .locator("xpath=..");

    await editCard.getByLabel("Name").fill(updatedName);
    await editCard.getByRole("button", { name: "Save changes" }).click();

    // Modal closes and the updated name is visible in the table.
    await expect(
      page.getByRole("heading", { name: "Edit user" })
    ).not.toBeVisible();
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  test("admin deletes an agent via the confirmation modal and the row disappears", async ({
    page,
  }) => {
    // Create a throwaway user within this test so the seeded agent is left
    // intact for any other tests that depend on it.
    const throwawayEmail = `throwaway+${Date.now()}@example.com`;
    const throwawayName = "Throwaway Agent";
    const throwawayPassword = "SecurePass1!";

    // --- Step 1: Create the throwaway user via the UI ---
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(
      page.getByRole("heading", { name: "Create agent" })
    ).toBeVisible();

    const createCard = page
      .getByRole("heading", { name: "Create agent" })
      .locator("xpath=..");

    await createCard.getByLabel("Name").fill(throwawayName);
    await createCard.getByLabel("Email").fill(throwawayEmail);
    await createCard.getByLabel("Password").fill(throwawayPassword);
    await createCard.getByRole("button", { name: "Create user" }).click();

    // Wait for the new row to appear before proceeding.
    await expect(page.getByText(throwawayEmail)).toBeVisible();

    // --- Step 2: Open the delete confirmation modal ---
    // Scope the Delete click to the throwaway user's specific table row so
    // other agent rows' Delete buttons are not accidentally targeted.
    const throwawayRow = page
      .getByRole("row")
      .filter({ hasText: throwawayEmail });
    await throwawayRow.getByRole("button", { name: "Delete" }).click();

    // The confirmation modal appears with the user's name in the body text.
    await expect(
      page.getByRole("heading", { name: "Delete user" })
    ).toBeVisible();
    await expect(page.getByText(throwawayName)).toBeVisible();

    // --- Step 3: Confirm deletion via the modal's Delete button ---
    // Scope to the modal card (direct parent of the h2) to avoid targeting
    // the row-level Delete button that remains in the DOM behind the overlay.
    const deleteCard = page
      .getByRole("heading", { name: "Delete user" })
      .locator("xpath=..");
    await deleteCard.getByRole("button", { name: "Delete" }).click();

    // The row disappears from the table and the modal closes.
    await expect(page.getByText(throwawayEmail)).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Delete user" })
    ).not.toBeVisible();
  });
});
