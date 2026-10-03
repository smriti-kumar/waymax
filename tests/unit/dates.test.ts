import { describe, expect, it } from "vitest";
import { daysUntil, describeDate, formatMonthDay } from "@/lib/dates";

describe("yearly dates", () => {
  it("counts days to the next occurrence, wrapping to next year", () => {
    expect(daysUntil({ month: 10, day: 3 }, "2026-10-03")).toEqual({ days: 0, year: 2026 });
    expect(daysUntil({ month: 10, day: 10 }, "2026-10-03")).toEqual({ days: 7, year: 2026 });
    expect(daysUntil({ month: 10, day: 2 }, "2026-10-03").year).toBe(2027);
  });
  it("puts Feb 29 on Feb 28 in non-leap years", () => {
    expect(daysUntil({ month: 2, day: 29 }, "2027-02-28")).toEqual({ days: 0, year: 2027 });
    expect(daysUntil({ month: 2, day: 29 }, "2028-02-28")).toEqual({ days: 1, year: 2028 });
  });
  it("describes dates gently, with the age when the year is known", () => {
    expect(describeDate({ kind: "birthday", label: null, month: 5, day: 1, year: 1990 }, "Priya", 2026)).toBe("Priya's 36th birthday");
    expect(describeDate({ kind: "birthday", label: null, month: 5, day: 1, year: null }, "Priya", 2026)).toBe("Priya's birthday");
    expect(describeDate({ kind: "anniversary", label: null, month: 6, day: 12, year: 2015 }, "Raj", 2026)).toBe("Raj's 11th anniversary");
    expect(describeDate({ kind: "anniversary", label: "Raj and Anita's wedding anniversary", month: 6, day: 12, year: null }, "Raj", 2026)).toBe("Raj and Anita's wedding anniversary");
    expect(describeDate({ kind: "other", label: "First day at school", month: 9, day: 1, year: null }, "Max", 2026)).toBe("Max: First day at school");
    expect(formatMonthDay({ month: 12, day: 25 })).toBe("December 25");
  });
});
