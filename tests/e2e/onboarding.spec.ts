import { expect, test } from "@playwright/test";

test("sign up → create patient → wizard → pair display → Today card", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("link", { name: "I'm a caregiver" }).click();
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Casey Carer");
  await page.getByLabel("Email").fill(`onboard-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/caregiver");
  await expect(page.getByText("No patients yet")).toBeVisible();

  await page.getByLabel("Full name").fill("Margaret Lee");
  await page.getByLabel("What they like to be called").fill("Maggie");
  await page.getByRole("button", { name: "Add patient" }).click();
  await page.waitForURL(/\/caregiver\/[0-9a-f-]+\/setup$/);

  // 1. About
  await expect(page.getByTestId("setup-step-about")).toBeVisible();
  await page.getByLabel("What they call home").fill("Home");
  await page.getByRole("button", { name: "Save and continue" }).click();
  // 2. Home on the map
  await expect(page.getByTestId("setup-step-home")).toBeVisible();
  await page.locator(".leaflet-container").click({ position: { x: 300, y: 200 } });
  await page.getByRole("button", { name: "Set home here" }).click();
  await expect(page.getByText("Home area saved")).toBeVisible();
  await page.getByTestId("setup-next").click();
  // 3. Alert phones (skip)
  await expect(page.getByTestId("setup-step-contacts")).toBeVisible();
  await page.getByTestId("setup-next").click();
  // 4. Pair the laptop
  await expect(page.getByTestId("setup-step-devices")).toBeVisible();
  await page.getByRole("button", { name: "Pair patient laptop" }).click();
  const code = (await page.getByTestId("pair-code-patient_display").innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);

  const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone"] });
  const lp = await laptop.newPage();
  await lp.goto("/pair");
  await lp.getByLabel("Type the 6-digit code").fill(code);
  await lp.getByRole("button", { name: "Connect" }).click();
  await lp.waitForURL("**/patient");
  await lp.goto("/patient?faceEngine=mock&mockPerson=none");
  await lp.getByTestId("start-button").click();
  await expect(lp.getByTestId("today-card")).toContainText("Maggie");
  await expect(lp.getByTestId("today-card")).toContainText("You're at Home");

  // The wizard sees the device and marks the step done.
  await expect(page.getByText(/online/)).toBeVisible({ timeout: 10_000 });
});
