"use client";
import type { TodayResponse } from "@/lib/contracts/schedule";
import { cx } from "@/components/ui/cx";
import { useClock } from "./useClock";

const GREETING = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good evening" };

/** The idle screen. Never scrolls: shows at most 3 visitors and 4 plan items. */
export function TodayCard({ today, timezone, preferredName }: { today: TodayResponse | null; timezone: string; preferredName: string }) {
  const clock = useClock(timezone);
  const items = (today?.items ?? []).filter((i) => i.status !== "done");
  const shown = items.slice(0, 4);
  const visitors = (today?.visitorsToday ?? []).slice(0, 3);

  return (
    <section aria-label="Today" className="flex h-full min-h-0 flex-col gap-6 px-10 py-8" data-testid="today-card">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[32px] text-ink-soft">
            {GREETING[clock.partOfDay]}, {preferredName}
          </p>
          <h1 className="text-[64px] font-bold leading-tight">
            It&apos;s {clock.dayName} {clock.partOfDay === "night" ? "night" : clock.partOfDay}
          </h1>
          <p className="text-[36px]">{clock.dateText}</p>
        </div>
        <div className="text-right">
          <p className="text-[88px] font-bold leading-none text-sea-deep" data-testid="today-time">
            {clock.timeText}
          </p>
          <p className="mt-2 text-[32px]">
            You&apos;re at <span className="font-bold">{today?.locationLabel ?? "Home"}</span>
          </p>
        </div>
      </header>

      {today?.nextText && (
        <p className="rounded-3xl bg-sea px-8 py-5 text-[40px] font-bold text-white" data-testid="today-next">
          {today.nextText}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex min-h-0 flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-[48px] font-bold leading-tight">Visitors today</h2>
          {visitors.length === 0 ? (
            <p className="text-ink-soft">No visitors planned today.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {visitors.map((v) => (
                <li key={v.personId} className="flex items-center gap-5">
                  {v.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.photoUrl} alt="" className="h-20 w-20 flex-none rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-20 w-20 flex-none items-center justify-center rounded-2xl bg-sand text-[32px] font-bold text-sea-deep">
                      {v.name[0]}
                    </span>
                  )}
                  <span className="leading-tight">
                    <span className="block font-bold">{v.name}</span>
                    <span className="text-ink-soft">
                      your {v.relationship} · {v.timeText}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-[48px] font-bold leading-tight">Today&apos;s plan</h2>
          {today?.emptyText || shown.length === 0 ? (
            <p className="text-[32px]">{today?.emptyText ?? "A quiet day at home"}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((i) => (
                <li
                  key={i.id}
                  className={cx(
                    "flex items-baseline gap-5 rounded-2xl px-4 py-2",
                    i.status === "now" && "bg-sky font-bold",
                    i.status === "next" && "bg-[#fdf0d8]",
                  )}
                >
                  <span className="w-[150px] flex-none text-ink-soft">{i.timeText}</span>
                  <span>
                    {i.title}
                    {i.personName && !i.title.includes(i.personName) ? ` with ${i.personName}` : ""}
                    {i.status === "now" && <span className="ml-3 text-sea-deep">· now</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
