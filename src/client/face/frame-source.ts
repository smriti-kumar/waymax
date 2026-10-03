/** Where frames come from. Today: a webcam; later: a USB camera picked by deviceId. */
export interface FrameSource {
  start(): Promise<HTMLVideoElement>;
  stop(): void;
  readonly video: HTMLVideoElement | null;
}

export class WebcamFrameSource implements FrameSource {
  video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;

  constructor(private deviceId?: string) {}

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: this.deviceId
        ? { deviceId: { exact: this.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = this.stream;
    await v.play();
    this.video = v;
    return v;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
  }
}
