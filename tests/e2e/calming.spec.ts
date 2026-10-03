import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, pairDisplay, pairingCode, spoken } from "./helpers";

test("I feel confused → place/time → plan → choice → soothing music (mouse + keyboard)", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");

  await page.getByTestId("confused-button").click();
  await expect(page.getByTestId("calming-step-1")).toContainText("You are at Home.");
  await expect(page.getByTestId("calming-step-1")).toContainText("You're safe.");
  await expect.poll(async () => (await spoken(page)).join(" ")).toMatch(/You are at Home\. It's \w+ \w+, \d{1,2}:\d{2}\. You're safe\./);

  // Keyboard: focus and press Enter.
  await page.getByTestId("calming-next").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("calming-step-2")).toContainText("The rest of today");

  await page.getByTestId("calming-next").click();
  await expect(page.getByTestId("calming-step-3")).toBeVisible();
  await page.getByTestId("play-music").click();
  await expect(page.getByTestId("calming-step-music")).toContainText("Soothing music is playing.");
  await page.getByTestId("music-stop").click();
  await expect(page.getByTestId("calming-step-3")).toBeVisible();

  // Pressing "I feel confused" again restarts at step 1.
  await page.getByTestId("confused-button").click();
  await expect(page.getByTestId("calming-step-1")).toBeVisible();
});

test("calming flow works with touch", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const code = await pairingCode(ctx, pid, "patient_display");
  const touch = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
  const page = await touch.newPage();
  await page.goto("/pair");
  await page.getByLabel("Type the 6-digit code").fill(code);
  await page.getByRole("button", { name: "Connect" }).tap();
  await page.waitForURL("**/patient");
  await page.goto("/patient?faceEngine=mock&mockPerson=none");
  await page.getByTestId("start-button").tap();
  await page.getByTestId("confused-button").tap();
  await expect(page.getByTestId("calming-step-1")).toBeVisible();
  await page.getByTestId("calming-next").tap();
  await page.getByTestId("calming-next").tap();
  await page.getByTestId("play-music").tap();
  await expect(page.getByTestId("calming-step-music")).toBeVisible();
});
