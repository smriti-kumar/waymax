// Pure port of @vladmandic/human src/face/match.ts (MIT) with Human's defaults,
// so matching can be unit-tested without TensorFlow. The browser engine uses
// human.match.find itself; both produce identical similarity values.
const DEFAULTS = { order: 2, multiplier: 25, min: 0.2, max: 0.8 };

export function humanDistance(a: number[], b: number[], multiplier = DEFAULTS.multiplier) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.round(100 * multiplier * sum) / 100;
}

function normalize(dist: number) {
  if (dist === 0) return 1;
  const norm = (1 - Math.sqrt(dist) / 100 - DEFAULTS.min) / (DEFAULTS.max - DEFAULTS.min);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

export function humanSimilarity(a: number[], b: number[]) {
  return normalize(humanDistance(a, b));
}

export function humanFind(descriptor: number[], descriptors: number[][]) {
  if (!Array.isArray(descriptor) || descriptor.length < 64 || descriptors.length === 0) {
    return { index: -1, distance: Number.POSITIVE_INFINITY, similarity: 0 };
  }
  let lowest = Number.MAX_SAFE_INTEGER;
  let index = -1;
  for (let i = 0; i < descriptors.length; i++) {
    const d = descriptors[i]!.length === descriptor.length ? humanDistance(descriptor, descriptors[i]!) : Number.MAX_SAFE_INTEGER;
    if (d < lowest) {
      lowest = d;
      index = i;
    }
  }
  return { index, distance: lowest, similarity: normalize(lowest) };
}
