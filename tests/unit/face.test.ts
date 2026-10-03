import { describe, expect, it } from "vitest";
import { FaceMatcher } from "@/client/face/matcher";
import { StabilityTracker } from "@/client/face/stability";
import { checkEnrollmentFaces, enrollFromImage } from "@/client/face/enrollment";
import { MockFaceEngine, seededVector } from "@/client/face/mock-engine";
import { humanFind, humanSimilarity } from "@/client/face/human-match";

const near = (v: number[], eps: number, seed = 1) => {
  const n = seededVector(`noise${seed}`, v.length);
  return v.map((x, i) => x + n[i]! * eps);
};

describe("humanFind port", () => {
  it("returns similarity 1 for identical vectors and lower for distant ones", () => {
    const a = seededVector("a");
    expect(humanSimilarity(a, a)).toBe(1);
    expect(humanSimilarity(a, seededVector("b"))).toBeLessThan(0.55);
    expect(humanFind(a, [seededVector("b"), a]).index).toBe(1);
  });
  it("refuses short descriptors", () => {
    expect(humanFind([1, 2, 3], [[1, 2, 3]]).index).toBe(-1);
  });
});

describe("FaceMatcher", () => {
  const priya = seededVector("priya");
  const raj = seededVector("raj");
  const gallery = [
    { personId: "p1", name: "Priya", relationship: "daughter", photoUrl: null, embeddings: [priya] },
    { personId: "p2", name: "Raj", relationship: "son", photoUrl: null, embeddings: [raj, near(raj, 0.02)] },
  ];

  it("picks the highest similarity above threshold", () => {
    const m = new FaceMatcher(gallery, 0.68);
    expect(m.size).toBe(3);
    const r = m.match(near(raj, 0.03, 7));
    expect(r?.personId).toBe("p2");
    expect(r!.similarity).toBeGreaterThanOrEqual(0.55);
    expect(m.match(near(priya, 0.03, 3))?.personId).toBe("p1");
  });

  it("returns null below the threshold", () => {
    const m = new FaceMatcher(gallery, 0.55);
    expect(m.match(seededVector("stranger"))).toBeNull();
    expect(new FaceMatcher([], 0.55).match(priya)).toBeNull();
  });

  it("uses an injected find function (Human's in the browser)", () => {
    const fake = (_d: number[], ds: number[][]) => ({ index: 0, distance: 0, similarity: ds.length === 1 ? 0.9 : 0.6 });
    const m = new FaceMatcher(gallery, 0.5, fake);
    expect(m.match(raj)).toEqual({ personId: "p1", similarity: 0.9 });
  });

  it("treats an ambiguous face (two people nearly tied) as unknown", () => {
    const tie = (_d: number[], ds: number[][]) => ({ index: 0, distance: 0, similarity: ds.length === 1 ? 0.74 : 0.72 });
    expect(new FaceMatcher(gallery, 0.6, tie).match(raj)).toBeNull();
    const clear = (_d: number[], ds: number[][]) => ({ index: 0, distance: 0, similarity: ds.length === 1 ? 0.8 : 0.6 });
    expect(new FaceMatcher(gallery, 0.6, clear).match(raj)).toEqual({ personId: "p1", similarity: 0.8 });
  });

  it("a stranger below the threshold is unknown even if one person is closest", () => {
    const near = (_d: number[], ds: number[][]) => ({ index: 0, distance: 0, similarity: ds.length === 1 ? 0.62 : 0.3 });
    expect(new FaceMatcher(gallery, 0.68, near).match(raj)).toBeNull();
    const m = new FaceMatcher(gallery, 0.68, near);
    m.setThreshold(0.6);
    expect(m.match(raj)?.personId).toBe("p1");
  });
});

describe("StabilityTracker", () => {
  it("recognizes after 3 of the last 5 checks agree", () => {
    const t = new StabilityTracker();
    expect(t.push({ personId: "p1", similarity: 0.8, faces: 1, t: 0 }).kind).toBe("none");
    expect(t.push({ personId: null, faces: 1, t: 500 }).kind).toBe("none");
    expect(t.push({ personId: "p1", similarity: 0.7, faces: 1, t: 1000 }).kind).toBe("none");
    const s = t.push({ personId: "p1", similarity: 0.9, faces: 1, t: 1500 });
    expect(s).toMatchObject({ kind: "recognized", personId: "p1" });
    expect(s.kind === "recognized" && s.confidence).toBeCloseTo(0.8);
  });

  it("forgets old checks beyond the 5-check window", () => {
    const t = new StabilityTracker();
    t.push({ personId: "p1", faces: 1, t: 0 });
    t.push({ personId: "p1", faces: 1, t: 1 });
    for (let i = 0; i < 4; i++) t.push({ personId: null, faces: 0, t: 2 + i });
    expect(t.push({ personId: "p1", faces: 1, t: 10 }).kind).toBe("none");
  });

  it("declares unknown after 3 s of unmatched faces, resetting on no face", () => {
    const t = new StabilityTracker();
    expect(t.push({ personId: null, faces: 1, t: 0 }).kind).toBe("none");
    expect(t.push({ personId: null, faces: 1, t: 2500 }).kind).toBe("none");
    t.push({ personId: null, faces: 0, t: 2600 });
    expect(t.push({ personId: null, faces: 1, t: 3100 }).kind).toBe("none");
    expect(t.push({ personId: null, faces: 1, t: 6100 })).toEqual({ kind: "unknown", since: 3100 });
  });
});

describe("enrollment rules (mock engine)", () => {
  const img = { width: 640, height: 480 } as unknown as ImageBitmap;

  it("rejects photos with no face", async () => {
    const r = await enrollFromImage(new MockFaceEngine("photo", { faces: 0 }), img);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/No face/) });
  });

  it("rejects photos with two faces", async () => {
    const r = await enrollFromImage(new MockFaceEngine("photo", { faces: 2 }), img);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/More than one/) });
  });

  it("rejects faces smaller than 80 px", async () => {
    const r = await enrollFromImage(new MockFaceEngine("photo", { faces: 1, boxPx: 60 }), img);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/too small/) });
  });

  it("accepts exactly one big face and returns its embedding", async () => {
    const r = await enrollFromImage(new MockFaceEngine("photo", { faces: 1 }), img);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.face.embedding).toHaveLength(1024);
  });

  it("checkEnrollmentFaces rejects faces with no embedding", () => {
    const r = checkEnrollmentFaces([{ embedding: [], box: { x: 0, y: 0, width: 200, height: 200 }, score: 1 }]);
    expect(r.ok).toBe(false);
  });
});
