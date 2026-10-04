import { beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { db } from "@/server/db/client";
import { caregivers, patientCaregivers } from "@/server/db/schema";
import { DEMO_EMAIL, seedDemo } from "@/server/seed/demo";
import { prewarmPhrases } from "@/server/seed/phrases";
import { buildToday } from "@/server/services/schedule";
import { confusionStats } from "@/server/services/dashboard";
import { login } from "@/server/services/caregivers";

describeDb("demo seed", () => {
  beforeEach(truncateAll);

  it("creates a full demo that logs in, has a Today card, a chart, and a small TTS phrase set", async () => {
    await seedDemo();
    expect(await seedDemo()).toMatch(/already present/);
    const cg = await login(DEMO_EMAIL, "waymax-demo");
    const [link] = await db().select().from(patientCaregivers).where(eq(patientCaregivers.caregiverId, cg.id));
    const today = await buildToday(link.patientId);
    expect(today.preferredName).toBe("Maggie");
    expect(today.items.length).toBeGreaterThanOrEqual(5);
    expect(today.visitorsToday.map((v) => v.name)).toContain("Jiya");
    const chart = await confusionStats(link.patientId, 14);
    expect(chart.daily.filter((d) => d.n > 0).length).toBeGreaterThanOrEqual(12);
    const phrases = await prewarmPhrases(link.patientId);
    const chars = phrases.reduce((n, p) => n + p.length, 0);
    expect(phrases.length).toBeGreaterThanOrEqual(25);
    expect(phrases.length).toBeLessThanOrEqual(50);
    expect(chars).toBeLessThan(3500);
    // --force rebuilds only the demo account
    await seedDemo({ force: true });
    expect(await db().select().from(caregivers).where(eq(caregivers.email, DEMO_EMAIL))).toHaveLength(1);
  });
});
