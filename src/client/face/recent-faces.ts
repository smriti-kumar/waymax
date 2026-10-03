/**
 * Faces the patient was just asked about ("Add this person" or "Not now"), so
 * the same face isn't prompted again for a while — without muting every other
 * new face that walks up in the meantime.
 */
export class RecentFaces {
  private items: { embedding: number[]; until: number }[] = [];

  constructor(
    private isSame: (a: number[], b: number[]) => boolean,
    private max = 50,
  ) {}

  add(embedding: number[], forMs: number, now = Date.now()) {
    this.items.push({ embedding, until: now + forMs });
    if (this.items.length > this.max) this.items.shift();
  }

  /** True when this face matches one we're staying quiet about. A match also
   * keeps the new view of the face, so the same person turning their head
   * still counts as seen. */
  has(embedding: number[], now = Date.now()) {
    this.items = this.items.filter((i) => i.until > now);
    const hit = this.items.find((i) => this.isSame(embedding, i.embedding));
    if (hit) this.add(embedding, hit.until - now, now);
    return !!hit;
  }

  clear() {
    this.items = [];
  }
}
