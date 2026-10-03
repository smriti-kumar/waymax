import { describe, expect, it } from "vitest";
import { haversineM, isOutside, offsetPoint, pickActiveFence, type FenceLike } from "@/lib/geo";
import { evaluatePing } from "@/lib/geofence";

const center = { lat: 42.4440, lng: -76.5019 }; // Ithaca
const home: FenceLike = { kind: "home", centerLat: center.lat, centerLng: center.lng, radiusM: 150, activeFrom: null, activeUntil: null, isActive: true };
const at = (m: number, bearing = 90) => offsetPoint(center, m, bearing);

describe("haversine", () => {
  it("matches known distances", () => {
    // NYC → LA ≈ 3936 km
    expect(haversineM({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 }) / 1000).toBeCloseTo(3936, -1);
    expect(haversineM(center, center)).toBe(0);
    expect(haversineM(center, at(250))).toBeCloseTo(250, 0);
  });
});

describe("accuracy padding", () => {
  it("pads the radius by min(accuracy, 100)", () => {
    expect(isOutside(home, { ...at(200), accuracyM: 10 })).toBe(true);
    expect(isOutside(home, { ...at(200), accuracyM: 60 })).toBe(false); // 150 + 60 = 210
    expect(isOutside(home, { ...at(240), accuracyM: 400 })).toBe(false); // padding capped at 100 → 250
    expect(isOutside(home, { ...at(260), accuracyM: 400 })).toBe(true);
  });
});

describe("geofence state machine", () => {
  it("needs two consecutive outside pings to exit", () => {
    let s = evaluatePing({ state: "inside", streak: 0 }, [home], at(300));
    expect(s).toMatchObject({ state: "inside", streak: 1, transition: null });
    s = evaluatePing(s, [home], at(310));
    expect(s).toMatchObject({ state: "outside", streak: 2, transition: "exit" });
    s = evaluatePing(s, [home], at(320));
    expect(s.transition).toBeNull();
  });

  it("an inside ping between outside pings resets the streak", () => {
    let s = evaluatePing({ state: "inside", streak: 0 }, [home], at(300));
    s = evaluatePing(s, [home], at(50));
    s = evaluatePing(s, [home], at(300));
    expect(s).toMatchObject({ state: "inside", streak: 1, transition: null });
  });

  it("returns on a single inside ping", () => {
    const s = evaluatePing({ state: "outside", streak: 3 }, [home], at(20));
    expect(s).toMatchObject({ state: "inside", streak: 0, transition: "return" });
  });

  it("unknown → inside is quiet; unknown → outside exits after two pings", () => {
    expect(evaluatePing({ state: "unknown", streak: 0 }, [home], at(10))).toMatchObject({ state: "inside", transition: null });
    const s1 = evaluatePing({ state: "unknown", streak: 0 }, [home], at(400));
    expect(evaluatePing(s1, [home], at(400)).transition).toBe("exit");
  });

  it("ignores pings with accuracy over 500 m", () => {
    const s = evaluatePing({ state: "outside", streak: 2 }, [home], { ...at(10), accuracyM: 800 });
    expect(s).toMatchObject({ state: "outside", streak: 2, transition: null, ignored: "low_accuracy" });
  });

  it("does nothing without a fence", () => {
    expect(evaluatePing({ state: "unknown", streak: 0 }, [], at(10))).toMatchObject({ ignored: "no_fence", transition: null });
  });
});

describe("temporary fences", () => {
  const party: FenceLike = {
    kind: "temporary",
    centerLat: at(3000).lat,
    centerLng: at(3000).lng,
    radiusM: 200,
    activeFrom: "2026-10-10T18:00:00Z",
    activeUntil: "2026-10-10T22:00:00Z",
    isActive: true,
  };

  it("overrides home only inside its window", () => {
    expect(pickActiveFence([home, party], new Date("2026-10-10T19:00:00Z"))).toBe(party);
    expect(pickActiveFence([home, party], new Date("2026-10-10T17:59:00Z"))).toBe(home);
    expect(pickActiveFence([home, party], new Date("2026-10-10T22:00:00Z"))).toBe(home);
  });

  it("at the party, being near the party is inside and being home is outside", () => {
    const during = new Date("2026-10-10T19:00:00Z");
    expect(evaluatePing({ state: "inside", streak: 0 }, [home, party], at(3050), during)).toMatchObject({ state: "inside", streak: 0 });
    const s = evaluatePing({ state: "inside", streak: 0 }, [home, party], at(10), during);
    expect(s.streak).toBe(1);
  });
});
