import { expect, test } from "@playwright/test";
import { caregiverContext, createPatient, pairDisplay, pairingCode, spoken } from "./helpers";

test("a question button shows and speaks the exact stored answer, every time", async ({ browser }) => {
  const { ctx } = await caregiverContext(browser);
  const pid = await createPatient(ctx);
  const answer = "Raj is at work. He'll visit you on Sunday after lunch.";
  await ctx.request.post(`/api/patients/${pid}/questions`, { data: { question: "Where is Raj?", answer } });
  const { page } = await pairDisplay(browser, await pairingCode(ctx, pid, "patient_display"), "?faceEngine=mock&mockPerson=none");
  await page.getByRole("link", { name: "Questions" }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Where is Raj?" }).click();
    await expect(page.getByTestId("question-answer")).toHaveText(answer);
    await page.getByRole("button", { name: "Back to questions" }).click();
  }
  await expect.poll(async () => (await spoken(page)).filter((t) => t === answer).length).toBe(2);
});
