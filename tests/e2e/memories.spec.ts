import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, createPerson, pairDisplay, pairingCode, spoken } from "./helpers";

test("memories slideshow advances, narrates and pauses", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const priya = await createPerson(ctx, pid, "Priya", "daughter", 0);
  for (const [title, occurredOn] of [["Beach day", "2019-07-04"], ["Graduation", "2021-05-20"], ["Garden party", "2023-06-10"]]) {
    await ctx.request.post(`/api/people/${priya}/memories`, { data: { kind: "story", title, occurredOn } });
  }
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  await page.getByRole("link", { name: "Memories" }).click();
  await page.getByRole("link", { name: /Priya/ }).click();
  await page.waitForURL(`**/patient/memories/${priya}`);
  await page.goto(`/patient/memories/${priya}?slideMs=1500`);

  await expect(page.getByTestId("slide-caption")).toHaveText("Garden party");
  await expect.poll(() => spoken(page)).toContain("Here are some memories with Priya, your daughter. Garden party");
  await expect(page.getByTestId("slide-caption")).toHaveText("Graduation", { timeout: 15_000 });

  await page.getByTestId("slideshow-pause").click();
  await expect(page.getByText("Paused")).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("slide-caption")).toHaveText("Graduation");
  await page.getByTestId("slideshow-pause").click();
  await expect(page.getByTestId("slide-caption")).toHaveText("Beach day", { timeout: 15_000 });
});
