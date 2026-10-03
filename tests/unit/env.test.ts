import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  SESSION_SECRET: "0123456789abcdef0123",
};

describe("parseEnv", () => {
  it("switches providers to mock/in_app when optional keys are missing", () => {
    const e = parseEnv({ ...base, NOTIFY_MODE: "photon", AI_MOCK: "false" });
    expect(e.geminiMode).toBe("mock");
    expect(e.ttsMode).toBe("mock");
    expect(e.notifyMode).toBe("in_app");
    expect(e.warnings.length).toBe(3);
  });

  it("treats blank strings as missing", () => {
    const e = parseEnv({ ...base, GEMINI_API_KEY: "  ", ELEVENLABS_API_KEY: "" });
    expect(e.GEMINI_API_KEY).toBeUndefined();
    expect(e.geminiMode).toBe("mock");
  });

  it("goes live when keys are present and AI_MOCK is false", () => {
    const e = parseEnv({
      ...base,
      GEMINI_API_KEY: "k",
      ELEVENLABS_API_KEY: "k",
      ELEVENLABS_VOICE_ID: "v",
      SPECTRUM_PROJECT_ID: "p",
      SPECTRUM_PROJECT_SECRET: "s",
      NOTIFY_MODE: "photon",
    });
    expect(e.geminiMode).toBe("live");
    expect(e.ttsMode).toBe("live");
    expect(e.notifyMode).toBe("photon");
    expect(e.warnings).toEqual([]);
  });

  it("AI_MOCK=true forces mocks even with keys", () => {
    const e = parseEnv({ ...base, GEMINI_API_KEY: "k", AI_MOCK: "true" });
    expect(e.geminiMode).toBe("mock");
  });

  it("applies defaults", () => {
    const e = parseEnv(base);
    expect(e.GEMINI_MODEL).toBe("gemini-3-flash-preview");
    expect(e.GEMINI_FALLBACK_MODEL).toBe("gemini-3.1-flash-lite");
    expect(e.TTS_MONTHLY_CHAR_BUDGET).toBe(18000);
    expect(e.NEXT_PUBLIC_FACE_MATCH_THRESHOLD).toBe(0.55);
  });

  it("throws a clear message when DATABASE_URL is missing", () => {
    expect(() => parseEnv({ SESSION_SECRET: base.SESSION_SECRET })).toThrow(/DATABASE_URL/);
  });

  it("throws when SESSION_SECRET is missing", () => {
    expect(() => parseEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/SESSION_SECRET/);
  });
});
