import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, createPerson, pairDisplay, pairingCode, spoken } from "./helpers";

test("known person (mock engine) shows the card and 'Who is this?' speaks", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const priya = await createPerson(ctx, pid, "Priya", "daughter");
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), `?faceEngine=mock&mockPerson=${priya}`);

  await expect(page.getByTestId("person-card")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("person-card-name")).toHaveText("Priya");
  await expect(page.getByText("Your daughter")).toBeVisible();

  await page.getByTestId("who-is-this").click();
  await expect.poll(() => spoken(page)).toContain("This is Priya, your daughter.");
});

test("manual 'Who's here?' picker opens the card", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  await createPerson(ctx, pid, "Raj", "son", 0);
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  await page.getByTestId("whos-here").click();
  await page.getByRole("button", { name: /Raj/ }).click();
  await expect(page.getByTestId("person-card-name")).toHaveText("Raj");
});
