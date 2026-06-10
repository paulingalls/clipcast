import { test, expect } from "@playwright/test";

// Happy-path acceptance for the marketing landing page. The page is client-rendered
// React (bundled by Bun), so the assertions wait for hydration before checking content.
test("landing page renders the Clipcast hero, how-it-works, and API status link", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Clipcast/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Clipcast");
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Check API Status" })).toHaveAttribute(
    "href",
    "/api/health",
  );
});
