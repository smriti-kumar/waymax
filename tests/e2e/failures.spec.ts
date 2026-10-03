import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, createPerson, pairDisplay, pairingCode } from "./helpers";

test("face model fails to load → caregiver sees a gentle flag, the patient screen still works", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  await createPerson(ctx, pid, "Raj", "son", 0);
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=fail");

  // Nothing alarming on the patient side.
  await expect(page.getByText(/fail|error/i)).toHaveCount(0);
  await page.getByRole("link", { name: "Questions" }).click();
  await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();

  const cg = await ctx.newPage();
  await cg.goto(`/caregiver/${pid}`);
  await expect(cg.getByTestId("flags")).toContainText("face recognition couldn't load");
});

test("offline: the patient screen keeps the last Today card and the device clock", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  await ctx.request.post(`/api/patients/${pid}/schedule`, { data: { kind: "meal", title: "Dinner", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: "23:59", durationMin: 5 } });
  const { ctx: laptop, page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  await expect(page.getByTestId("today-next")).toContainText("Dinner");
  await laptop.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("today-next")).toContainText("Dinner");
  await expect(page.getByTestId("today-time")).toHaveText(/\d{1,2}:\d{2}/);
  await laptop.setOffline(false);
});

test("a revoked laptop is signed out", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  const devices = (await (await ctx.request.get(`/api/patients/${pid}/devices`)).json()).devices;
  await ctx.request.delete(`/api/patients/${pid}/devices/${devices[0].id}`);
  await page.goto("/patient");
  await page.waitForURL("**/pair");
});

test("a revoked laptop that stays open returns to pairing on its next refresh", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  const devices = (await (await ctx.request.get(`/api/patients/${pid}/devices`)).json()).devices;
  await ctx.request.delete(`/api/patients/${pid}/devices/${devices[0].id}`);
  // SWR revalidates on focus (throttled to once per 5 s); trigger it instead of waiting a minute.
  await page.waitForTimeout(5500);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForURL("**/pair", { timeout: 15_000 });
});
