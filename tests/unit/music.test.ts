import { describe, expect, it } from "vitest";
import { chooseMusicSource } from "@/client/audio/music";

describe("calming music source", () => {
  it("uses the generated ambient pad when no tracks are bundled", () => {
    expect(chooseMusicSource([])).toEqual({ kind: "ambient" });
    expect(chooseMusicSource(null)).toEqual({ kind: "ambient" });
  });
  it("uses bundled tracks when present", () => {
    expect(chooseMusicSource(["/audio/calm/calm-1.mp3"])).toEqual({ kind: "tracks", tracks: ["/audio/calm/calm-1.mp3"] });
  });
});
