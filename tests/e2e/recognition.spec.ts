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

test("the person card has a Close button and doesn't come straight back", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const raj = await createPerson(ctx, pid, "Raj", "son");
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), `?faceEngine=mock&mockPerson=${raj}`);
  await expect(page.getByTestId("person-card-name")).toHaveText("Raj");
  await page.getByTestId("person-card-close").click();
  await expect(page.getByTestId("person-card")).toHaveCount(0);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("person-card")).toHaveCount(0);
  await expect(page.getByTestId("today-card")).toBeVisible();
});

test("Today's plan can step to other days", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const tomorrow = (new Date().getDay() + 1) % 7;
  await ctx.request.post(`/api/patients/${pid}/schedule`, { data: { kind: "therapy", title: "Physio", daysOfWeek: [tomorrow], startTime: "15:00" } });
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  await expect(page.getByTestId("plan-title")).toHaveText("Today's plan");
  await page.getByTestId("plan-next").click();
  await expect(page.getByTestId("plan-title")).toHaveText("Tomorrow's plan");
  await expect(page.getByTestId("today-card")).toContainText("Physio");
  await page.getByTestId("plan-prev").click();
  await expect(page.getByTestId("plan-title")).toHaveText("Today's plan");
});
