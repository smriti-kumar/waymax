import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { db } from "@/server/db/client";
import { caregivers } from "@/server/db/schema";
import { resetEnvCache } from "@/server/env";
import { setFirebaseVerifier } from "@/server/auth/firebase";
import { POST as exchange } from "@/app/api/auth/firebase/route";
import { POST as legacyLogin } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { hashPassword } from "@/server/auth/passwords";

const FB = { FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e@p.iam.gserviceaccount.com", FIREBASE_PRIVATE_KEY: "k", NEXT_PUBLIC_FIREBASE_API_KEY: "a", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p" };

beforeAll(() => {
  Object.assign(process.env, FB);
  resetEnvCache();
  setFirebaseVerifier(async (t) => {
    if (t === "bad-token-xxxxxxxxxxxxxx") throw new Error("expired");
    const [uid, email] = t.split("|");
    return { uid: uid!, email, name: "From Firebase", email_verified: true };
  });
});
afterAll(() => {
  for (const k of Object.keys(FB)) delete process.env[k];
  resetEnvCache();
  setFirebaseVerifier(null);
});

describeDb("Firebase sign-in", () => {
  beforeEach(truncateAll);

  it("creates a caregiver on first sign-in, then reuses it by uid", async () => {
    const first = await call(exchange, { body: { idToken: "uid-123456789|new@example.com", name: "Nia" } });
    expect(first.status).toBe(201);
    expect(first.body.caregiver).toMatchObject({ email: "new@example.com", name: "Nia" });
    expect((await call(me, { cookie: `wm_session=${first.cookies.wm_session}` })).status).toBe(200);
    const again = await call(exchange, { body: { idToken: "uid-123456789|new@example.com" } });
    expect(again.status).toBe(200);
    expect(again.body.caregiver.id).toBe(first.body.caregiver.id);
  });

  it("links an existing password account by email (e.g. the demo account)", async () => {
    const [cg] = await db().insert(caregivers).values({ email: "demo@waymax.app", name: "Alex", passwordHash: await hashPassword("waymax-demo") }).returning();
    const r = await call(exchange, { body: { idToken: "uid-demo-0000000|demo@waymax.app" } });
    expect(r.body.caregiver.id).toBe(cg.id);
    const [row] = await db().select().from(caregivers).where(eq(caregivers.id, cg.id));
    expect(row.firebaseUid).toBe("uid-demo-0000000");
  });

  it("rejects an invalid token, and the legacy password login is off", async () => {
    expect((await call(exchange, { body: { idToken: "bad-token-xxxxxxxxxxxxxx" } })).status).toBe(401);
    expect((await call(legacyLogin, { body: { email: "a@b.c", password: "x" } })).status).toBe(409);
  });
});
