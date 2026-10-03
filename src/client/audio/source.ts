// Microphone → raw Float32 blocks via an AudioWorklet. Only runs while Listen is on.

/** Where audio comes from. Today: the laptop mic; later: a Bluetooth or room mic by deviceId. */
export interface AudioSource {
  start(onBlock: (block: Float32Array, sampleRate: number) => void): Promise<void>;
  stop(): void;
}

const WORKLET = `
class WmPcm extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("wm-pcm", WmPcm);
`;

export class MicAudioSource implements AudioSource {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;

  constructor(private deviceId?: string) {}

  async start(onBlock: (block: Float32Array, sampleRate: number) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(this.deviceId ? { deviceId: { exact: this.deviceId } } : {}),
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const ctx = new AudioContext();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const src = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, "wm-pcm", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
    node.port.onmessage = (e: MessageEvent<Float32Array>) => onBlock(e.data, ctx.sampleRate);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node).connect(mute).connect(ctx.destination);
    this.node = node;
  }

  stop() {
    this.node?.port.close();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.node = null;
    this.stream = null;
    this.ctx = null;
  }
}
