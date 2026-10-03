import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, createPerson, pairDisplay, pairingCode } from "./helpers";

test("Listen → fake mic → Stop → mocked summary on the caregiver conversations page", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const priya = await createPerson(ctx, pid, "Priya", "daughter");
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), `?faceEngine=mock&mockPerson=${priya}`);
  await expect(page.getByTestId("person-card")).toBeVisible();

  // Nothing is recorded until Listen is tapped.
  await expect(page.getByTestId("recording")).toHaveCount(0);
  await page.getByTestId("listen").click();
  await expect(page.getByTestId("recording")).toContainText("Recording");
  await page.waitForTimeout(2500);
  await page.getByTestId("listen-stop").click();
  await expect(page.getByTestId("listen-saved")).toContainText("Saved");

  const cg = await ctx.newPage();
  await cg.goto(`/caregiver/${pid}/conversations`);
  await expect(cg.getByTestId("conversations")).toContainText("You had a nice chat with Priya.");
  await cg.getByRole("button", { name: /Priya/ }).click();
  await expect(cg.getByText(/We talked for about \d+ seconds/)).toBeVisible();
});
