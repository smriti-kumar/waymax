import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makePatient } from "../support/factories";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { requirePatientAccess } from "@/server/auth/guards";

const creds = { email: "Sam@Example.com", password: "correct horse", name: "Sam" };

describeDb("caregiver auth", () => {
  beforeEach(truncateAll);

  it("signup → me → logout → me is 401", async () => {
    const s = await call(signup, { body: creds });
    expect(s.status).toBe(201);
    expect(s.body.caregiver.email).toBe("sam@example.com");
    expect(s.body.caregiver.passwordHash).toBeUndefined();
    const cookie = `wm_session=${s.cookies.wm_session}`;
    expect(s.res.headers.getSetCookie()[0]).toMatch(/HttpOnly/i);

    const m = await call(me, { cookie });
    expect(m.status).toBe(200);
    expect(m.body.caregiver.name).toBe("Sam");
    expect(m.body.patients).toEqual([]);

    const out = await call(logout, { method: "POST", cookie });
    expect(out.status).toBe(204);
    expect((await call(me, { cookie })).status).toBe(401);
  });

  it("rejects a duplicate email with 409", async () => {
    await call(signup, { body: creds });
    const again = await call(signup, { body: { ...creds, email: "sam@example.com" } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("CONFLICT");
  });

  it("validates the signup body", async () => {
    const r = await call(signup, { body: { email: "nope", password: "short", name: "" } });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION");
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await call(signup, { body: creds });
    const wrong = await call(login, { body: { email: creds.email, password: "nope nope" } });
    const unknown = await call(login, { body: { email: "who@example.com", password: "nope nope" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    const ok = await call(login, { body: { email: "SAM@example.com", password: creds.password } });
    expect(ok.status).toBe(200);
    expect(ok.cookies.wm_session).toBeTruthy();
  });

  it("forbids access to another caregiver's patient", async () => {
    const a = await makeCaregiver("A");
    const b = await makeCaregiver("B");
    const pa = await makePatient(a.caregiver.id);
    await expect(requirePatientAccess(a.caregiver.id, pa.id)).resolves.toEqual({ role: "owner" });
    await expect(requirePatientAccess(b.caregiver.id, pa.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      requirePatientAccess(b.caregiver.id, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
