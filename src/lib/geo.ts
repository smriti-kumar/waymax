// Pure geometry + fence selection, shared by server and client.
export type LatLng = { lat: number; lng: number };

const R = 6_371_000; // mean Earth radius, metres

export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface FenceLike {
  kind: "home" | "temporary";
  centerLat: number;
  centerLng: number;
  radiusM: number;
  activeFrom: Date | string | null;
  activeUntil: Date | string | null;
  isActive: boolean;
}

const t = (d: Date | string | null) => (d == null ? NaN : new Date(d).getTime());

/** A temporary fence whose window contains `now` wins; otherwise home. */
export function pickActiveFence<F extends FenceLike>(fences: F[], now: Date = new Date()): F | null {
  const n = now.getTime();
  const temp = fences
    .filter((f) => f.kind === "temporary" && f.isActive && t(f.activeFrom) <= n && n < t(f.activeUntil))
    .sort((a, b) => t(b.activeFrom) - t(a.activeFrom))[0];
  if (temp) return temp;
  return fences.find((f) => f.kind === "home" && f.isActive) ?? null;
}

/** Outside means distance > radius + min(accuracy, 100) (PLAN §6). */
export function isOutside(fence: FenceLike, p: LatLng & { accuracyM?: number | null }) {
  const pad = Math.min(Math.max(p.accuracyM ?? 0, 0), 100);
  return haversineM({ lat: fence.centerLat, lng: fence.centerLng }, p) > fence.radiusM + pad;
}

/** Point `distanceM` metres from `origin` along `bearingDeg` (0 = north). */
export function offsetPoint(origin: LatLng, distanceM: number, bearingDeg: number): LatLng {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const d = distanceM / R;
  const br = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export const osmLink = (p: LatLng) =>
  `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&mlon=${p.lng.toFixed(5)}#map=17/${p.lat.toFixed(5)}/${p.lng.toFixed(5)}`;
