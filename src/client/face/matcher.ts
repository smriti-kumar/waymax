import { humanFind } from "./human-match";
import type { FindFn, GalleryPerson } from "./types";

export const DEFAULT_THRESHOLD = 0.68;
/** The best person must beat the runner-up by this much, or the face counts as unknown. */
export const DEFAULT_MARGIN = 0.05;

export type Match = { personId: string; similarity: number };

/**
 * Matches one embedding against each approved person's samples. A face is a
 * match only when the best person scores ≥ threshold AND clearly beats the
 * next-best person; otherwise it's unknown (so strangers aren't forced onto the
 * closest family member).
 */
export class FaceMatcher {
  private people: { personId: string; embeddings: number[][] }[] = [];

  constructor(
    gallery: GalleryPerson[] = [],
    private threshold = DEFAULT_THRESHOLD,
    private find: FindFn = humanFind,
    private margin = DEFAULT_MARGIN,
  ) {
    this.setGallery(gallery);
  }

  setGallery(gallery: GalleryPerson[]) {
    this.people = gallery.filter((p) => p.embeddings.length > 0).map((p) => ({ personId: p.personId, embeddings: p.embeddings }));
  }

  /** Swap in the engine's native matcher once it has loaded. */
  setFind(find: FindFn) {
    this.find = find;
  }

  setThreshold(threshold: number) {
    if (Number.isFinite(threshold) && threshold > 0 && threshold < 1) this.threshold = threshold;
  }

  get size() {
    return this.people.reduce((n, p) => n + p.embeddings.length, 0);
  }

  /** Per-person best similarity, highest first. */
  rank(embedding: number[]): Match[] {
    return this.people
      .map((p) => {
        const r = this.find(embedding, p.embeddings);
        return { personId: p.personId, similarity: r.index < 0 ? 0 : r.similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);
  }

  match(embedding: number[]): Match | null {
    const [best, second] = this.rank(embedding);
    if (!best || best.similarity < this.threshold) return null;
    if (second && best.similarity - second.similarity < this.margin) return null;
    return best;
  }
}
