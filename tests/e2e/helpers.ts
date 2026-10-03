import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { seededVector } from "../../src/client/face/mock-engine";

let n = 0;
const uniq = () => `${Date.now()}-${++n}`;

export async function caregiverContext(browser: Browser) {
  const ctx = await browser.newContext();
  const email = `e2e-${uniq()}@example.com`;
  const r = await ctx.request.post("/api/auth/signup", { data: { email, password: "password123", name: "Casey Carer" } });
  expect(r.status()).toBe(201);
  return { ctx, email };
}

export async function createPatient(ctx: BrowserContext, preferredName = "Maggie") {
  const r = await ctx.request.post("/api/patients", { data: { name: "Margaret Lee", preferredName, timezone: "America/New_York" } });
  return (await r.json()).patient.id as string;
}

export async function createPerson(ctx: BrowserContext, pid: string, name: string, relationship: string, samples = 3) {
  const person = (await (await ctx.request.post(`/api/patients/${pid}/people`, { data: { name, relationship } })).json()).person;
  if (samples) {
    const items = Array.from({ length: samples }, (_, i) => ({ vector: seededVector(`${name}-${i}`), dim: 1024, model: "human-faceres" }));
    const r = await ctx.request.post(`/api/people/${person.id}/embeddings`, { data: { items } });
    expect(r.status()).toBe(201);
  }
  return person.id as string;
}

export async function pairingCode(ctx: BrowserContext, pid: string, kind: "patient_display" | "patient_phone") {
  const r = await ctx.request.post(`/api/patients/${pid}/pairing-codes`, { data: { deviceKind: kind } });
  return (await r.json()).code as string;
}

/** Pairs a fresh context through the /pair page and taps Start. */
export async function pairDisplay(browser: Browser, code: string, query = "") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone"] });
  const page = await ctx.newPage();
  await page.goto("/pair");
  await page.getByLabel("Type the 6-digit code").fill(code);
  await page.getByRole("button", { name: "Connect" }).click();
  await page.waitForURL("**/patient");
  if (query) await page.goto(`/patient${query}`);
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("today-card")).toBeVisible();
  return { ctx, page };
}

export const spoken = (page: Page) => page.evaluate(() => window.__waymaxSpoken ?? []);
