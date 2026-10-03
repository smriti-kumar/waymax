import { describe, expect, it } from "vitest";
import { extractSelfIntroductions } from "@/lib/intros";
import { scribeToSegments } from "@/server/ai/elevenlabs";

describe("self-introduction extractor", () => {
  it("finds names people introduce themselves with, ignoring non-names", () => {
    expect(extractSelfIntroductions("Hi Mom, it's Priya. It's Saturday!").map((x) => x.name)).toEqual(["Priya"]);
    expect(extractSelfIntroductions("Hello Margaret, I'm Sam from next door").map((x) => x.name)).toEqual(["Sam"]);
    expect(extractSelfIntroductions("this is Raj, my name is nora").map((x) => x.name).sort()).toEqual(["Nora", "Raj"]);
    expect(extractSelfIntroductions("I'm okay, it's fine")).toEqual([]);
  });
});

describe("Scribe word list → speaker turns", () => {
  it("labels speakers A, B in order and joins words", () => {
    const w = (text: string, speaker_id: string, type: "word" | "spacing" = "word") => ({ text, type, speaker_id });
    const segs = scribeToSegments([
      w("Hi", "speaker_1"), w(" ", "speaker_1", "spacing"), w("Mom,", "speaker_1"), w(" ", "speaker_1", "spacing"), w("it's", "speaker_1"), w(" ", "speaker_1", "spacing"), w("Priya.", "speaker_1"),
      w(" ", "speaker_0", "spacing"), w("Hello", "speaker_0"), w(" ", "speaker_0", "spacing"), w("dear.", "speaker_0"),
    ]);
    expect(segs).toEqual([
      { speaker: "A", text: "Hi Mom, it's Priya." },
      { speaker: "B", text: "Hello dear." },
    ]);
  });
});
