import { humanFind } from "./human-match";
import type { FindFn, GalleryPerson } from "./types";

export const DEFAULT_THRESHOLD = 0.55;

export type Match = { personId: string; similarity: number };

/** Matches one embedding against every approved person's embeddings. */
export class FaceMatcher {
  private descriptors: number[][] = [];
  private owners: string[] = [];

  constructor(
    gallery: GalleryPerson[] = [],
    private threshold = DEFAULT_THRESHOLD,
    private find: FindFn = humanFind,
  ) {
    this.setGallery(gallery);
  }

  setGallery(gallery: GalleryPerson[]) {
    this.descriptors = [];
    this.owners = [];
    for (const p of gallery) {
      for (const e of p.embeddings) {
        this.descriptors.push(e);
        this.owners.push(p.personId);
      }
    }
  }

  get size() {
    return this.descriptors.length;
  }

  /** Highest-similarity person at or above the threshold, else null. */
  match(embedding: number[]): Match | null {
    if (!this.descriptors.length) return null;
    const r = this.find(embedding, this.descriptors);
    if (r.index < 0 || r.similarity < this.threshold) return null;
    return { personId: this.owners[r.index]!, similarity: r.similarity };
  }
}
