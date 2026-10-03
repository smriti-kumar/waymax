export type Observation = { personId: string | null; similarity?: number; faces: number; t: number };

export type StableState =
  | { kind: "none" }
  | { kind: "recognized"; personId: string; confidence: number }
  | { kind: "unknown"; since: number };

/**
 * A person counts as recognized when the same id wins 3 of the last 5 checks.
 * An unknown face is declared after `unknownMs` of faces present with no match.
 */
export class StabilityTracker {
  private window: Observation[] = [];
  private unknownSince: number | null = null;

  constructor(
    private size = 5,
    private need = 3,
    private unknownMs = 3000,
  ) {}

  reset() {
    this.window = [];
    this.unknownSince = null;
  }

  push(o: Observation): StableState {
    this.window.push(o);
    if (this.window.length > this.size) this.window.shift();

    if (o.faces > 0 && !o.personId) this.unknownSince ??= o.t;
    else this.unknownSince = null;

    const tally = new Map<string, { n: number; sim: number }>();
    for (const w of this.window) {
      if (!w.personId) continue;
      const cur = tally.get(w.personId) ?? { n: 0, sim: 0 };
      cur.n++;
      cur.sim += w.similarity ?? 0;
      tally.set(w.personId, cur);
    }
    let best: [string, { n: number; sim: number }] | null = null;
    for (const entry of tally) if (!best || entry[1].n > best[1].n) best = entry;
    if (best && best[1].n >= this.need) {
      return { kind: "recognized", personId: best[0], confidence: Math.min(1, best[1].sim / best[1].n) };
    }
    if (this.unknownSince !== null && o.t - this.unknownSince >= this.unknownMs) {
      return { kind: "unknown", since: this.unknownSince };
    }
    return { kind: "none" };
  }
}
