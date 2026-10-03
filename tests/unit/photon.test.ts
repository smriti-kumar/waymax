import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let failFor: string | null = null;
let hang = false;

vi.mock("spectrum-ts", () => ({
  Spectrum: vi.fn(async (opts: { projectId: string; projectSecret: string; providers: unknown[] }) => {
    calls.push(`Spectrum(${opts.projectId},${opts.projectSecret},${opts.providers.length})`);
    return { stop: async () => void calls.push("stop") };
  }),
}));
vi.mock("spectrum-ts/providers/imessage", () => {
  const imessage = Object.assign(
    () => ({
      user: async (phone: string) => {
        calls.push(`user(${phone})`);
        return { id: phone };
      },
      space: {
        create: async (u: { id: string }) => {
          calls.push(`space.create(${u.id})`);
          return {
            send: async (text: string) => {
              if (hang) await new Promise(() => {});
              if (u.id === failFor) throw new Error("not on iMessage");
              calls.push(`send(${u.id},${text})`);
            },
          };
        },
      },
    }),
    { config: () => ({ name: "imessage" }) },
  );
  return { imessage };
});

import { PhotonMessageSender } from "@/server/notify";

describe("PhotonMessageSender", () => {
  beforeEach(() => {
    calls.length = 0;
    failFor = null;
    hang = false;
  });

  it("creates the app, resolves each user, opens a space, sends, then stops", async () => {
    const r = await new PhotonMessageSender("proj", "secret").sendMany(["+1555", "+1666"], "hi");
    expect(r).toEqual([
      { phoneE164: "+1555", ok: true },
      { phoneE164: "+1666", ok: true },
    ]);
    expect(calls).toEqual([
      "Spectrum(proj,secret,1)",
      "user(+1555)",
      "space.create(+1555)",
      "send(+1555,hi)",
      "user(+1666)",
      "space.create(+1666)",
      "send(+1666,hi)",
      "stop",
    ]);
  });

  it("reports per-recipient failures and still stops the app", async () => {
    failFor = "+1666";
    const r = await new PhotonMessageSender("p", "s").sendMany(["+1555", "+1666"], "hi");
    expect(r[1]).toMatchObject({ ok: false, error: "not on iMessage" });
    expect(calls.at(-1)).toBe("stop");
  });

  it("times out a hung send", async () => {
    hang = true;
    const r = await new PhotonMessageSender("p", "s", 50).sendMany(["+1555"], "hi");
    expect(r[0]).toMatchObject({ ok: false, error: expect.stringMatching(/timed out/) });
  });
});
