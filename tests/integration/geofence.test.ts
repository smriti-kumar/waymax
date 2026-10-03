import { beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient } from "../support/factories";
import { db } from "@/server/db/client";
import { locationPings, notifications, patients } from "@/server/db/schema";
import { offsetPoint } from "@/lib/geo";
import { PUT as putHome } from "@/app/api/patients/[pid]/geofences/home/route";
import { GET as listFences, POST as addFence } from "@/app/api/patients/[pid]/geofences/route";
import { DELETE as delFence } from "@/app/api/patients/[pid]/geofences/[fid]/route";
import { POST as ping } from "@/app/api/location/route";
import { POST as simulate } from "@/app/api/patients/[pid]/location/simulate/route";
import { GET as trail } from "@/app/api/patients/[pid]/location/route";
import { GET as notes } from "@/app/api/patients/[pid]/notifications/route";
import { POST as readNote } from "@/app/api/notifications/[nid]/read/route";

const HOME = { lat: 42.444, lng: -76.5019 };

async function world() {
  const a = await makeCaregiver();
  const p = await makePatient(a.caregiver.id);
  const r = await call(putHome, { method: "PUT", cookie: a.cookie, params: { pid: p.id }, body: { ...HOME, radiusM: 150, label: "Home" } });
  expect(r.status).toBe(200);
  return { a, p };
}

const kinds = async (pid: string) =>
  (await db().select().from(notifications).where(eq(notifications.patientId, pid))).map((n) => n.kind).sort();

describeDb("geofence and location", () => {
  beforeEach(truncateAll);

  it("PUT home sets patient home fields; home can't be deleted (409); temp fences validate windows (422)", async () => {
    const { a, p } = await world();
    const [row] = await db().select().from(patients).where(eq(patients.id, p.id));
    expect(row).toMatchObject({ homeLat: HOME.lat, homeLng: HOME.lng, homeLabel: "Home" });
    const again = await call(putHome, { method: "PUT", cookie: a.cookie, params: { pid: p.id }, body: { ...HOME, radiusM: 300, label: "Cottage" } });
    expect(again.body.fence.radiusM).toBe(300);
    const fences = (await call(listFences, { cookie: a.cookie, params: { pid: p.id } })).body.fences;
    expect(fences).toHaveLength(1);
    expect((await call(delFence, { method: "DELETE", cookie: a.cookie, params: { pid: p.id, fid: fences[0].id } })).status).toBe(409);
    const bad = await call(addFence, {
      cookie: a.cookie,
      params: { pid: p.id },
      body: { label: "Party", ...HOME, radiusM: 200, activeFrom: "2030-01-01T20:00:00Z", activeUntil: "2030-01-01T18:00:00Z" },
    });
    expect(bad.status).toBe(422);
    const ok = await call(addFence, {
      cookie: a.cookie,
      params: { pid: p.id },
      body: { label: "Party", ...HOME, radiusM: 200, activeFrom: "2030-01-01T18:00:00Z", activeUntil: "2030-01-01T22:00:00Z" },
    });
    expect(ok.status).toBe(201);
    expect((await call(delFence, { method: "DELETE", cookie: a.cookie, params: { pid: p.id, fid: ok.body.fence.id } })).status).toBe(204);
  });

  it("simulate walk_out creates exactly one geofence_exit; walk_home exactly one return", async () => {
    const { a, p } = await world();
    const out = await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    expect(out.status).toBe(200);
    expect(out.body.state).toBe("outside");
    expect(await kinds(p.id)).toEqual(["geofence_exit"]);
    const home = await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_home" } });
    expect(home.body.state).toBe("inside");
    expect(await kinds(p.id)).toEqual(["geofence_exit", "geofence_return"]);
    const n = (await db().select().from(notifications).where(eq(notifications.kind, "geofence_exit")))[0];
    expect(n.body).toMatch(/^Waymax: Maggie has left Home\. Last seen .+, \d+(\.\d)? (m|km) away: https:\/\/www\.openstreetmap\.org\//);
    expect(n.photonStatus).toBe("skipped");
    const pings = await db().select().from(locationPings).where(eq(locationPings.patientId, p.id));
    expect(pings.every((x) => x.source === "simulated")).toBe(true);
  });

  it("phone pings: two outside pings exit, low-accuracy ignored, trail returned", async () => {
    const { a, p } = await world();
    const phone = await makeDevice(p.id, a.caregiver.id, "patient_phone");
    const far = offsetPoint(HOME, 400, 0);
    const send = (pt: { lat: number; lng: number }, accuracyM = 15) => call(ping, { cookie: phone.cookie, body: { ...pt, accuracyM } });
    expect((await send(HOME)).body.state).toBe("inside");
    expect((await send(far)).body).toMatchObject({ state: "inside", transition: null });
    expect((await send(HOME, 900)).body.state).toBe("inside"); // ignored, streak kept
    expect((await send(far)).body).toMatchObject({ state: "outside", transition: "exit" });
    const t = await call(trail, { cookie: a.cookie, params: { pid: p.id }, path: "/x?limit=10" });
    expect(t.body.trail).toHaveLength(4);
    expect(t.body.state).toBe("outside");
    expect(t.body.fence.label).toBe("Home");
    expect(await kinds(p.id)).toEqual(["geofence_exit"]);
  });

  it("accepts Shortcuts-style Authorization: Device header", async () => {
    const { a, p } = await world();
    const phone = await makeDevice(p.id, a.caregiver.id, "patient_phone");
    const r = await call(ping, { headers: phone.auth, body: { ...HOME, source: "shortcut" } });
    expect(r.status).toBe(200);
    expect((await call(ping, { body: HOME })).status).toBe(401);
  });

  it("lists alerts and marks them read", async () => {
    const { a, p } = await world();
    await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    const l = await call(notes, { cookie: a.cookie, params: { pid: p.id } });
    expect(l.body.notifications).toHaveLength(1);
    expect(l.body.notifications[0].readAt).toBeNull();
    expect((await call(readNote, { method: "POST", cookie: a.cookie, params: { nid: l.body.notifications[0].id } })).status).toBe(204);
    expect((await call(notes, { cookie: a.cookie, params: { pid: p.id } })).body.notifications[0].readAt).not.toBeNull();
    const b = await makeCaregiver();
    expect((await call(readNote, { method: "POST", cookie: b.cookie, params: { nid: l.body.notifications[0].id } })).status).toBe(403);
  });
});
