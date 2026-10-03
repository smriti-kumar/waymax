import { api } from "@/client/api";
import type { FinishResponse } from "@/lib/contracts/conversations";
import { MicAudioSource, type AudioSource } from "./source";
import { concatFloat32, downsample, encodeWav, TARGET_RATE } from "./wav";

export const CHUNK_SECONDS = 45;
export const AUTO_STOP_MS = 20 * 60 * 1000;

/**
 * One Listen session: mic → 16 kHz mono WAV every 45 s → POST /chunks?seq=N (in
 * order, one at a time) → on stop, flush the remainder and POST /finish.
 * Raw audio only ever exists in this tab's memory until its chunk is uploaded.
 */
export class ListenSession {
  private blocks: Float32Array[] = [];
  private samples = 0;
  private rate = 48_000;
  private seq = 0;
  private uploads: Promise<void> = Promise.resolve();
  private autoStop: ReturnType<typeof setTimeout> | null = null;
  private stopping: Promise<FinishResponse | null> | null = null;
  conversationId: string | null = null;

  constructor(
    private source: AudioSource = new MicAudioSource(),
    private onAutoStop?: () => void,
  ) {}

  async start(context: { visitId?: string | null; personId?: string | null }) {
    const r = await api<{ conversationId: string }>("/api/conversations", { method: "POST", json: context });
    this.conversationId = r.conversationId;
    await this.source.start((block, rate) => {
      this.rate = rate;
      this.blocks.push(block);
      this.samples += block.length;
      if (this.samples >= CHUNK_SECONDS * rate) this.cut();
    });
    this.autoStop = setTimeout(() => this.onAutoStop?.(), AUTO_STOP_MS);
  }

  private cut() {
    if (!this.samples) return;
    const raw = concatFloat32(this.blocks);
    this.blocks = [];
    this.samples = 0;
    const wav = encodeWav(downsample(raw, this.rate, TARGET_RATE));
    const seq = this.seq++;
    const cid = this.conversationId!;
    this.uploads = this.uploads.then(() =>
      fetch(`/api/conversations/${cid}/chunks?seq=${seq}`, {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: wav,
        credentials: "same-origin",
      }).then(
        () => undefined,
        () => undefined, // a lost chunk doesn't stop the conversation
      ),
    );
  }

  stop(): Promise<FinishResponse | null> {
    this.stopping ??= (async () => {
      if (this.autoStop) clearTimeout(this.autoStop);
      this.source.stop();
      // Keep at least half a second of trailing audio.
      if (this.samples >= this.rate / 2) this.cut();
      else {
        this.blocks = [];
        this.samples = 0;
      }
      await this.uploads;
      if (!this.conversationId) return null;
      return api<FinishResponse>(`/api/conversations/${this.conversationId}/finish`, { method: "POST" });
    })();
    return this.stopping;
  }
}
