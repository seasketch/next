import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { signIn, visibleButton } from "../src/project";

test.describe("demo-samoa forums", () => {
  test("an anonymous visitor can read the public topic and is asked to sign in", async ({
    page,
  }) => {
    await page.goto("/demo-samoa/app");
    await visibleButton(page, "Discussion Forums").click();
    await page.getByRole("heading", { name: "Public Forum", level: 3 }).click();
    await page.getByRole("link", { name: /Welcome to the project/ }).click();

    await expect(
      page.getByText("This forum is open for anyone who has joined the project.")
    ).toBeVisible();
    await expect(page.getByText("participate in the forum")).toBeVisible();
    await expect(page.getByRole("button", { name: "Post Reply" })).toHaveCount(0);
  });

  test("a member joins the project, then posts a reply", async ({ page, request }) => {
    test.setTimeout(90_000);
    await signIn(page, request, personas.member);
    await page.goto("/demo-samoa/app");
    await visibleButton(page, "Discussion Forums").click();
    await page.getByRole("heading", { name: "Public Forum", level: 3 }).click();
    await page.getByRole("link", { name: /Welcome to the project/ }).click();

    await expect(page.getByRole("button", { name: "Post Reply" })).toHaveCount(0);
    await expect(
      page.getByText(
        "Consider sharing a user profile and joining this project so you can gain access to the discussion forums."
      )
    ).toBeVisible();
    await page.getByRole("link", { name: "Join Project" }).click();

    await expect(page).toHaveURL(/\/demo-samoa\/join/);
    await expect(page.getByRole("heading", { name: "Join this Project" })).toBeVisible();
    await expect(page.getByText("How will my profile be used?")).toBeVisible();
    await expect(page.getByText("Full Name")).toBeVisible();
    const fullName = page.locator('input[name="fullname"]');
    await expect(fullName).toBeVisible();
    await expect(fullName).toHaveValue("");

    await page.getByRole("button", { name: "Join Project", exact: true }).click();
    await expect(page).toHaveURL(/\/join/);
    await expect(page.getByText("Required")).toBeVisible();
    await expect(fullName).toHaveAttribute("aria-invalid", "true");

    await fullName.fill("E2E Member");
    await page.getByRole("button", { name: "Join Project", exact: true }).click();

    await expect(page).toHaveURL(/\/demo-samoa\/app\/forums\/\d+\/\d+/);
    await expect(page.getByRole("button", { name: "Post Reply" })).toBeVisible();

    const reply = "Glad to be here.";
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(reply);
    await page.getByRole("button", { name: "Post Reply" }).click();
    await expect(page.getByText(reply)).toBeVisible();
  });
});
