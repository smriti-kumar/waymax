import { describe, expect, it } from "vitest";
import { buildRecap, buildSayText, levenshtein, namesMatch, visitorNameClaims } from "@/lib/text";

describe("levenshtein / namesMatch", () => {
  it("computes edit distance", () => {
    expect(levenshtein("priya", "priya")).toBe(0);
    expect(levenshtein("priya", "pria")).toBe(1);
    expect(levenshtein("sam", "priya")).toBe(5);
  });
  it("matches case-insensitively within distance 2, on full or first name", () => {
    expect(namesMatch("PRIYA", ["Priya"])).toBe(true);
    expect(namesMatch("Pria", ["Priya"])).toBe(true);
    expect(namesMatch("Preeya", [null, "Priya"])).toBe(true);
    expect(namesMatch("Priya", ["Priya Shah"])).toBe(true);
    expect(namesMatch("Sam", ["Priya", "PREE-yah"])).toBe(false);
    expect(namesMatch("", ["Priya"])).toBe(false);
  });
});

describe("buildRecap", () => {
  it("joins name, relationship, last visit and a fact", () => {
    expect(
      buildRecap({ name: "Priya", relationship: "daughter", lastVisit: { at: new Date(), isToday: false, weekday: "Sunday" }, lastFact: "Got a puppy named Max" }),
    ).toBe("Priya, your daughter. Last visit: Sunday. Got a puppy named Max.");
  });
  it("skips missing parts", () => {
    expect(buildRecap({ name: "Raj", relationship: "son", lastVisit: null, lastFact: null })).toBe("Raj, your son.");
    expect(buildRecap({ name: "Raj", relationship: null, lastVisit: { at: new Date(), isToday: true, weekday: "Monday" }, lastFact: "You talked about the garden." })).toBe(
      "Raj. Last visit: earlier today. You talked about the garden.",
    );
  });
  it("builds the spoken line with the pronunciation hint", () => {
    expect(buildSayText("Priya", "PREE-yah", "daughter")).toBe("This is PREE-yah, your daughter.");
    expect(buildSayText("Raj", null, null)).toBe("This is Raj.");
  });
});

describe("visitorNameClaims", () => {
  it("drops what visitors call the patient (live Gemini returned 'mom' as a name)", () => {
    expect(visitorNameClaims(["Priya", "mom"], ["Margaret Lee", "Maggie"])).toEqual(["Priya"]);
    expect(visitorNameClaims(["Grandma", "Maggie", "Margaret", "Sam"], ["Margaret Lee", "Maggie"])).toEqual(["Sam"]);
    expect(visitorNameClaims(["  "], ["Maggie"])).toEqual([]);
  });
});
