import { expect, test } from "@playwright/test";
import { HOME, caregiverContext, createPatient, pairPhone, pairingCode, setHome } from "./helpers";

// ~0.0036° latitude ≈ 400 m north
const away = (dLat: number) => ({ latitude: HOME.latitude + dLat, longitude: HOME.longitude });

test("phone at home, then outside twice → Outside + alert; back home → return alert", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  await setHome(ctx, pid);
  const phone = await pairPhone(browser, await pairingCode(ctx, pid, "patient_phone"));
  await expect(phone.page.getByTestId("phone-status")).toHaveText(/Sharing location with Casey/);

  const cg = await ctx.newPage();
  await cg.goto(`/caregiver/${pid}/safety`);
  await expect(cg.getByTestId("fence-status")).toContainText("Inside Home", { timeout: 15_000 });

  await phone.ctx.setGeolocation({ ...away(0.0036), accuracy: 10 });
  await phone.page.waitForTimeout(500);
  await phone.ctx.setGeolocation({ ...away(0.0040), accuracy: 10 });
  await expect(cg.getByTestId("fence-status")).toContainText("Outside Home", { timeout: 15_000 });
  await expect(cg.getByTestId("alerts-feed")).toContainText("Maggie has left Home");

  await phone.ctx.setGeolocation({ ...HOME, accuracy: 10 });
  await expect(cg.getByTestId("fence-status")).toContainText("Inside Home", { timeout: 15_000 });
  await expect(cg.getByTestId("alerts-feed")).toContainText("Maggie is back at Home");
});

test("simulate walk out / walk home from the safety page", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  await setHome(ctx, pid);
  const cg = await ctx.newPage();
  await cg.goto(`/caregiver/${pid}/safety`);
  await cg.getByRole("button", { name: "Simulate walk out" }).click();
  await expect(cg.getByTestId("fence-status")).toContainText("Outside Home");
  await expect(cg.getByTestId("alerts-feed")).toContainText("Maggie has left Home");
  await cg.getByRole("button", { name: "Simulate walk home" }).click();
  await expect(cg.getByTestId("fence-status")).toContainText("Inside Home");
  await expect(cg.getByTestId("alerts-feed")).toContainText("Maggie is back at Home");
});
