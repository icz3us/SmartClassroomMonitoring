import { expect, test } from "@playwright/test";

test("every dashboard route requires authentication and has no preview bypass", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of [
    "/",
    "/analytics",
    "/motion",
    "/alerts",
    "/device",
    "/settings",
    "/login",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByRole("main").getByRole("button")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/demonstration|simulated|scenario/i),
    ).toHaveCount(0);
    await expect(page.locator(".metric-value")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("sign-in form remains accessible on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute(
      "type",
      "password",
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.getByLabel("Email address").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel("Password")).toHaveAttribute("required", "");
});
