// speak(text): ElevenLabs via /api/tts, falling back to the browser voice.
// One global queue, so two utterances never overlap.

export const TTS_CLIENT_TIMEOUT_MS = 8000;
export const BROWSER_RATE = 0.85;

type Job = { text: string; resolve: () => void };
const queue: Job[] = [];
let busy = false;
let current: HTMLAudioElement | null = null;
const clipCache = new Map<string, string>(); // text → object URL

declare global {
  interface Window {
    /** Demo/E2E hook: every text spoken in this tab, in order. */
    __waymaxSpoken?: string[];
  }
}

function record(text: string) {
  if (typeof window === "undefined") return;
  (window.__waymaxSpoken ??= []).push(text);
}

/** Speak with the browser's built-in voice. Resolves when finished (or after a safety timeout). */
export function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = BROWSER_RATE;
    u.lang = "en-US";
    const voices = synth.getVoices();
    const calm = voices.find((v) => /Samantha|Karen|Moira|Google US English/i.test(v.name) && v.lang.startsWith("en"));
    if (calm) u.voice = calm;
    const done = () => {
      clearTimeout(guard);
      resolve();
    };
    // Some browsers never fire onend; never block the queue forever.
    const guard = setTimeout(done, Math.max(4000, text.length * 120));
    u.onend = done;
    u.onerror = done;
    synth.cancel();
    synth.speak(u);
  });
}

async function fetchClip(text: string): Promise<string | null> {
  const cached = clipCache.get(text);
  if (cached) return cached;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TTS_CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ac.signal,
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("audio/mpeg")) return null; // {fallback: true}
    const url = URL.createObjectURL(await res.blob());
    clipCache.set(text, url);
    return url;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function playClip(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    current = a;
    const finish = (ok: boolean) => {
      current = null;
      resolve(ok);
    };
    a.onended = () => finish(true);
    a.onerror = () => finish(false);
    a.play().catch(() => finish(false));
  });
}

async function run(text: string) {
  record(text);
  const url = await fetchClip(text);
  if (url && (await playClip(url))) return;
  await speakWithBrowser(text);
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      await run(job.text);
    } finally {
      job.resolve();
    }
  }
  busy = false;
}

/** Queue `text` to be spoken. Resolves when it has finished playing. */
export function speak(text: string): Promise<void> {
  const t = text.trim();
  if (!t) return Promise.resolve();
  return new Promise((resolve) => {
    queue.push({ text: t, resolve });
    void pump();
  });
}

/** Stop the current utterance and drop anything queued. */
export function stopSpeaking() {
  while (queue.length) queue.shift()!.resolve();
  if (current) {
    current.pause();
    current.dispatchEvent(new Event("ended"));
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** Warm the clip cache without playing (e.g. the person card's sayText). */
export function prefetchSpeech(text: string) {
  void fetchClip(text.trim());
}
