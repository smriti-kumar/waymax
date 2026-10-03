import { beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient } from "../support/factories";
import { db } from "@/server/db/client";
import { patientEvents } from "@/server/db/schema";
import { GET as calming } from "@/app/api/patient/calming/route";
import { POST as events } from "@/app/api/patient/events/route";
import { buildCalming } from "@/server/services/calming";

describeDb("calming mode", () => {
  beforeEach(truncateAll);

  it("orients with place, time, plan and the bundled track list", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id, { homeLabel: "Home" });
    const d = await makeDevice(p.id, a.caregiver.id);
    const r = await call(calming, { cookie: d.cookie });
    expect(r.status).toBe(200);
    expect(r.body.locationText).toBe("You are at Home.");
    expect(r.body.timeText).toMatch(/^It's \w+day (morning|afternoon|evening), \d{1,2}:\d{2}\.$/);
    expect(Array.isArray(r.body.musicTracks)).toBe(true);
    const tuesday = await buildCalming(p.id, new Date("2026-10-06T19:10:00Z"));
    expect(tuesday.timeText).toBe("It's Tuesday afternoon, 3:10.");
    expect(tuesday.planText).toBe("The rest of today is quiet and restful.");
  });

  it("logs the press and each choice", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const d = await makeDevice(p.id, a.caregiver.id);
    for (const kind of ["confused_pressed", "calming_music", "calming_memories"]) {
      expect((await call(events, { cookie: d.cookie, body: { kind } })).status).toBe(204);
    }
    const rows = await db().select().from(patientEvents).where(eq(patientEvents.patientId, p.id));
    expect(rows.map((r) => r.kind).sort()).toEqual(["calming_memories", "calming_music", "confused_pressed"]);
  });
});
