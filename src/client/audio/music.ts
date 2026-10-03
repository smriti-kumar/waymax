import { sharedAudioContext } from "@/client/audio-unlock";

export type MusicSource = { kind: "tracks"; tracks: string[] } | { kind: "ambient" };

/** Bundled tracks when there are any, otherwise the generated ambient pad. */
export function chooseMusicSource(tracks: string[] | null | undefined): MusicSource {
  return tracks && tracks.length ? { kind: "tracks", tracks } : { kind: "ambient" };
}

export interface MusicPlayer {
  start(): Promise<void>;
  stop(): void;
}

/** Plays the tracks in order, looping the playlist. */
export class TrackPlayer implements MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private i = 0;
  constructor(private tracks: string[]) {}
  async start() {
    const a = new Audio();
    a.volume = 0.7;
    a.onended = () => {
      this.i = (this.i + 1) % this.tracks.length;
      a.src = this.tracks[this.i]!;
      void a.play().catch(() => {});
    };
    a.src = this.tracks[0]!;
    this.audio = a;
    await a.play();
  }
  stop() {
    this.audio?.pause();
    this.audio = null;
  }
}

/** A soft, slowly breathing major-seventh pad made with the Web Audio API. */
export class AmbientPad implements MusicPlayer {
  private nodes: { stop(): void }[] = [];
  private master: GainNode | null = null;

  async start() {
    const ctx = sharedAudioContext();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 3);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(master).connect(ctx.destination);
    // C3, E3, G3, B3, E4 — gentle Cmaj7
    for (const [i, f] of [130.81, 164.81, 196.0, 246.94, 329.63].entries()) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = i % 2 ? "sine" : "triangle";
        osc.frequency.value = f;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.08;
        // Each voice swells at its own slow rate.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.013;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain).connect(g.gain);
        osc.connect(g).connect(filter);
        osc.start();
        lfo.start();
        this.nodes.push(osc, lfo);
      }
    }
    this.master = master;
  }

  stop() {
    const ctx = sharedAudioContext();
    if (this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    }
    const nodes = this.nodes;
    this.nodes = [];
    setTimeout(() => nodes.forEach((n) => n.stop()), 1100);
  }
}

export function makePlayer(source: MusicSource): MusicPlayer {
  return source.kind === "tracks" ? new TrackPlayer(source.tracks) : new AmbientPad();
}
