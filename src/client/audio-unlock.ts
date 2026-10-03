// Browsers block audio until a user gesture. The patient's one "Start" tap calls this.

/** Resolves with `fallback` if `p` takes longer than `ms` — browser prompts can hang forever. */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}
let ctx: AudioContext | null = null;

export function sharedAudioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

export async function unlockAudio() {
  try {
    const c = sharedAudioContext();
    if (c.state === "suspended") await within(c.resume(), 1500, undefined);
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* audio stays locked; speech falls back gracefully */
  }
  try {
    window.speechSynthesis?.getVoices();
  } catch {
    /* ignore */
  }
}

/** Ask for camera + mic once so later uses don't prompt mid-conversation. */
export function requestMediaPermissions(): Promise<{ camera: boolean; mic: boolean }> {
  return within(askMedia(), 20_000, { camera: false, mic: false });
}

async function askMedia(): Promise<{ camera: boolean; mic: boolean }> {
  const result = { camera: false, mic: false };
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    result.camera = s.getVideoTracks().length > 0;
    result.mic = s.getAudioTracks().length > 0;
    s.getTracks().forEach((t) => t.stop());
    return result;
  } catch {
    /* try separately below */
  }
  try {
    const v = await navigator.mediaDevices.getUserMedia({ video: true });
    result.camera = true;
    v.getTracks().forEach((t) => t.stop());
  } catch {}
  try {
    const a = await navigator.mediaDevices.getUserMedia({ audio: true });
    result.mic = true;
    a.getTracks().forEach((t) => t.stop());
  } catch {}
  return result;
}
