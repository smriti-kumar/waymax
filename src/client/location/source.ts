// Where location comes from. Today: the browser on the patient's phone. Later:
// iOS Shortcuts or Find My (server-side) post to the same /api/location.
export type Fix = { lat: number; lng: number; accuracyM: number | null; at: number };
export type LocationError = "denied" | "unavailable" | "timeout" | "unsupported";

export interface LocationSource {
  start(onFix: (f: Fix) => void, onError: (e: LocationError) => void): void;
  stop(): void;
}

export class BrowserGeolocation implements LocationSource {
  private id: number | null = null;
  private wakeLock: { release(): Promise<void> } | null = null;
  private onVisible = () => {
    if (document.visibilityState === "visible") void this.lockScreen();
  };

  start(onFix: (f: Fix) => void, onError: (e: LocationError) => void) {
    if (!("geolocation" in navigator)) return onError("unsupported");
    this.id = navigator.geolocation.watchPosition(
      (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy ?? null, at: p.timestamp || Date.now() }),
      (e) => onError(e.code === e.PERMISSION_DENIED ? "denied" : e.code === e.TIMEOUT ? "timeout" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 },
    );
    void this.lockScreen();
    document.addEventListener("visibilitychange", this.onVisible);
  }

  stop() {
    if (this.id !== null) navigator.geolocation.clearWatch(this.id);
    this.id = null;
    document.removeEventListener("visibilitychange", this.onVisible);
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  /** Keep the screen on so the page keeps sharing (iOS stops JS when the screen locks). */
  private async lockScreen() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
      if (wl) this.wakeLock = await wl.request("screen");
    } catch {
      /* not supported or not allowed; the hint tells the user to keep the page open */
    }
  }
}

/** Post at most every `minMs`, or sooner when moved more than `minMoveM`. */
export class PingThrottle {
  private last: Fix | null = null;
  constructor(
    private minMs = 15_000,
    private minMoveM = 25,
    private distance: (a: Fix, b: Fix) => number,
  ) {}
  shouldSend(f: Fix) {
    if (!this.last) return true;
    return f.at - this.last.at >= this.minMs || this.distance(this.last, f) >= this.minMoveM;
  }
  sent(f: Fix) {
    this.last = f;
  }
}
