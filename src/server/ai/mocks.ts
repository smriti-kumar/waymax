import "server-only";
import type { TextToSpeech } from "./interfaces";

/** Deterministic fake TTS: a tiny "mp3" whose bytes encode the text. Counts calls. */
export class MockTTS implements TextToSpeech {
  readonly provider = "mock";
  readonly model = "mock-tts";
  readonly voice = "mock-voice";
  calls = 0;
  async synthesize(text: string) {
    this.calls++;
    return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 0x04]), Buffer.from(text.padEnd(200, " "))]);
  }
}
