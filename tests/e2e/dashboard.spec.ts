import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, pairDisplay, pairingCode } from "./helpers";

test("three 'I feel confused' presses show as 3 today within 10 s", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const cg = await ctx.newPage();
  await cg.goto(`/caregiver/${pid}`);
  await expect(cg.getByTestId("confusion-today")).toHaveText("0");

  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("confused-button").click();
    await expect(page.getByTestId("calming-step-1")).toBeVisible();
    await page.getByRole("link", { name: "Back to today" }).click();
    await expect(page.getByTestId("today-card")).toBeVisible();
  }
  await expect(cg.getByTestId("confusion-today")).toHaveText("3", { timeout: 10_000 });
});

test("a caregiver with two patients can switch between them", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const maggie = await createPatient(ctx, "Maggie");
  const bob = await createPatient(ctx, "Bob");
  const cg = await ctx.newPage();
  await cg.goto(`/caregiver/${maggie}/schedule`);
  await expect(cg.getByRole("heading", { level: 1, name: "Maggie" })).toBeVisible();
  await cg.getByTestId("patient-switcher").selectOption(bob);
  await cg.waitForURL(`**/caregiver/${bob}/schedule`);
  await expect(cg.getByRole("heading", { level: 1, name: "Bob" })).toBeVisible();
});
