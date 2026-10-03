"use client";
import { useEffect, useState } from "react";

/** Device clock, ticking every 30 s, formatted in the patient's timezone. */
export function useClock(timeZone: string, everyMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone, ...o }).format(now);
  const hour = Number(fmt({ hour: "numeric", hourCycle: "h23" }));
  const partOfDay = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night";
  return {
    now,
    timeText: fmt({ hour: "numeric", minute: "2-digit" }),
    dayName: fmt({ weekday: "long" }),
    dateText: fmt({ month: "long", day: "numeric", year: "numeric" }),
    partOfDay: partOfDay as "morning" | "afternoon" | "evening" | "night",
  };
}
