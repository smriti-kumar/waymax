import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, pairDisplay, pairingCode } from "./helpers";

test("unknown face → Add this person → caregiver approves → recognized next time", async ({ browser }) => {
  test.setTimeout(90_000);
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=unknown");

  await expect(page.getByTestId("someone-here")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("add-this-person").click();
  await expect(page.getByText("Thank you. Your family will add their name.")).toBeVisible();

  const cg = await ctx.newPage();
  await cg.goto(`/caregiver/${pid}/approvals`);
  await expect(cg.getByTestId("pending-badge")).toHaveText("1");
  const card = cg.getByTestId("approval-card");
  await card.getByLabel("Name").fill("Sam");
  await card.getByLabel("Relationship").fill("neighbor");
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(cg.getByText("Nothing waiting")).toBeVisible();

  // The patient screen refreshes its gallery quickly after an add; the same face now matches.
  await expect(page.getByTestId("person-card-name")).toHaveText("Sam", { timeout: 30_000 });
});
