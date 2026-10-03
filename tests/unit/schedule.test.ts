import { describe, expect, it } from "vitest";
import { EMPTY_DAY_TEXT, expandDay, nextLine, partOfDay, type ScheduleItemLike } from "@/lib/schedule";

const TZ = "America/New_York";
const weekly = (id: string, title: string, days: number[], time: string, dur = 60, personId: string | null = null): ScheduleItemLike => ({
  id, kind: "activity", title, personId, startsAt: null, daysOfWeek: days, startTime: time, durationMin: dur,
});

describe("expandDay", () => {
  it("expands weekly items at the same local time across the DST boundary", () => {
    const items = [weekly("w", "Church", [0], "09:00:00")];
    // US DST ends Sunday 2026-11-01. 9:00 EDT = 13:00Z; 9:00 EST = 14:00Z.
    const before = expandDay(items, "2026-10-25", TZ, new Date("2026-10-25T00:00:00Z"));
    const after = expandDay(items, "2026-11-01", TZ, new Date("2026-11-01T00:00:00Z"));
    expect(before[0]!.startsAt.toISOString()).toBe("2026-10-25T13:00:00.000Z");
    expect(after[0]!.startsAt.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  it("skips weekly items on other days and includes one-off items only on their local day", () => {
    const items: ScheduleItemLike[] = [
      weekly("w", "Walk", [1, 3], "10:00"),
      { id: "o", kind: "visit", title: "Doctor", personId: null, startsAt: "2026-10-05T03:30:00Z", daysOfWeek: null, startTime: null, durationMin: 30 },
    ];
    // 2026-10-05T03:30Z is still Oct 4 (23:30) in New York.
    expect(expandDay(items, "2026-10-04", TZ, new Date("2026-10-04T12:00:00Z")).map((i) => i.id)).toEqual(["o"]);
    expect(expandDay(items, "2026-10-05", TZ, new Date("2026-10-05T12:00:00Z")).map((i) => i.id)).toEqual(["w"]);
  });

  it("orders items and labels done / now / next / later", () => {
    const items = [
      weekly("c", "Lunch with Priya", [2], "12:30", 60, "p1"),
      weekly("a", "Breakfast", [2], "08:00", 30),
      weekly("b", "Walk", [2], "10:00", 60),
      weekly("d", "Nap", [2], "15:00", 60),
    ];
    // Tuesday 2026-10-06, 10:15 local = 14:15Z
    const day = expandDay(items, "2026-10-06", TZ, new Date("2026-10-06T14:15:00Z"));
    expect(day.map((i) => [i.title, i.status])).toEqual([
      ["Breakfast", "done"],
      ["Walk", "now"],
      ["Lunch with Priya", "next"],
      ["Nap", "later"],
    ]);
    expect(nextLine(day.map((d) => ({ ...d, personName: "Priya" })), TZ)).toBe("Next: Lunch with Priya, 12:30");
  });

  it("returns nothing for an empty day, which the UI shows as a quiet day", () => {
    expect(expandDay([], "2026-10-06", TZ, new Date())).toEqual([]);
    expect(EMPTY_DAY_TEXT).toBe("A quiet day at home");
    expect(nextLine([], TZ)).toBeNull();
  });

  it("adds 'with {person}' to the next line when the title doesn't name them", () => {
    const day = expandDay([weekly("v", "Lunch", [2], "12:30", 60, "p1")], "2026-10-06", TZ, new Date("2026-10-06T14:00:00Z"));
    expect(nextLine(day.map((d) => ({ ...d, personName: "Priya" })), TZ)).toBe("Next: Lunch with Priya, 12:30");
  });
});

describe("partOfDay", () => {
  it("buckets local hours", () => {
    expect(partOfDay(new Date("2026-10-06T13:00:00Z"), TZ)).toBe("morning");
    expect(partOfDay(new Date("2026-10-06T19:10:00Z"), TZ)).toBe("afternoon");
    expect(partOfDay(new Date("2026-10-06T22:00:00Z"), TZ)).toBe("evening");
    expect(partOfDay(new Date("2026-10-07T03:00:00Z"), TZ)).toBe("night");
  });
});
