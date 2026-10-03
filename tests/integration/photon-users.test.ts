import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupFetchServer } from "../support/msw";
import { resetEnvCache } from "@/server/env";
import { registerPhotonUser } from "@/server/notify/photon-users";
import { RegisteringSender, type MessageSender } from "@/server/notify";

const server = setupFetchServer();
beforeAll(() => {
  server.listen();
  process.env.SPECTRUM_PROJECT_ID = "proj-1";
  process.env.PHOTON_DASHBOARD_TOKEN = "dash-token";
  resetEnvCache();
});
afterAll(() => {
  server.close();
  delete process.env.SPECTRUM_PROJECT_ID;
  delete process.env.PHOTON_DASHBOARD_TOKEN;
  resetEnvCache();
});
afterEach(() => server.resetHandlers());

const URL_ = "https://app.photon.codes/api/projects/proj-1/spectrum/users";

describe("Photon auto-registration", () => {
  it("registers a new number with the dashboard token", async () => {
    let posted: any = null;
    let auth: string | null = null;
    server.use(
      http.get(URL_, () => HttpResponse.json({ users: [{ phoneNumber: "+15551110000" }] })),
      http.post(URL_, async ({ request }) => {
        auth = request.headers.get("authorization");
        posted = await request.json();
        return HttpResponse.json({ success: true, user: { id: "u1" } });
      }),
    );
    expect(await registerPhotonUser("+16075550101", "Raj Lee")).toBe("registered");
    expect(auth).toBe("Bearer dash-token");
    expect(posted).toMatchObject({ firstName: "Raj", lastName: "Lee", phoneNumber: "+16075550101", sendInvite: false });
  });

  it("skips numbers that are already registered and never throws", async () => {
    server.use(http.get(URL_, () => HttpResponse.json({ users: [{ phoneNumber: "+1 (607) 555-0101" }] })));
    expect(await registerPhotonUser("+16075550101", "Raj")).toBe("already");
    server.use(http.get(URL_, () => HttpResponse.error()), http.post(URL_, () => HttpResponse.json({ error: "nope" }, { status: 401 })));
    expect(await registerPhotonUser("+16075550199", "X")).toBe("failed");
  });

  it("RegisteringSender registers 'not allowed' numbers and retries them once", async () => {
    const calls: string[][] = [];
    const allowed = new Set(["+1111"]);
    const inner: MessageSender = {
      name: "fake",
      sendMany: async (phones) => {
        calls.push(phones);
        return phones.map((p) => (allowed.has(p) ? { phoneE164: p, ok: true } : { phoneE164: p, ok: false, error: "[spectrum-imessage] Target not allowed for this project" }));
      },
    };
    const sender = new RegisteringSender(inner, async (p) => {
      allowed.add(p);
      return "registered";
    });
    const r = await sender.sendMany(["+1111", "+2222"], "hi");
    expect(r.every((x) => x.ok)).toBe(true);
    expect(calls).toEqual([["+1111", "+2222"], ["+2222"]]);
  });
});
