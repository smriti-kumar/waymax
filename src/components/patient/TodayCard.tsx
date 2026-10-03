"use client";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import type { TodayItem, TodayResponse } from "@/lib/contracts/schedule";
import { cx } from "@/components/ui/cx";
import { useClock } from "./useClock";
import { useFitCount } from "./useFitCount";

const GREETING = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good evening" };

type Plan = { offset: number; dayLabel: string; dateText: string; items: TodayItem[]; emptyText: string | null };

// Row heights the lists are measured against (keep in sync with the row classes).
const VISITOR_ROW = 76;
const PLAN_ROW = 56;
const ROW_GAP = 12;

const arrowCls =
  "min-h-[64px] rounded-2xl border-4 border-sea bg-white px-5 text-[24px] font-bold text-sea-deep hover:bg-sky disabled:border-line disabled:text-ink-soft disabled:opacity-60";

/**
 * The idle screen. Sizes scale with the window height and each list shows only
 * the rows that fit, so nothing ever spills over the action buttons.
 */
export function TodayCard({ today, timezone, preferredName }: { today: TodayResponse | null; timezone: string; preferredName: string }) {
  const clock = useClock(timezone);
  const [offset, setOffset] = useState(0);
  const { data: other } = useSWR<Plan>(offset !== 0 ? `/api/patient/plan?offset=${offset}` : null, fetcher, { keepPreviousData: true });
  const [visitorsRef, visitorFit] = useFitCount<HTMLUListElement>(VISITOR_ROW, ROW_GAP);
  const [planRef, planFit] = useFitCount<HTMLUListElement>(PLAN_ROW, 8);

  const showingToday = offset === 0;
  const items = showingToday ? (today?.items ?? []).filter((i) => i.status !== "done") : (other?.items ?? []);
  const emptyText = showingToday ? (today?.emptyText ?? (items.length ? null : "A quiet day at home")) : other?.emptyText;
  const visitors = (today?.visitorsToday ?? []).slice(0, visitorFit);
  const planTitle = showingToday ? "Today's plan" : other ? `${other.dayLabel}'s plan` : "…";

  return (
    <section aria-label="Today" className="flex h-full min-h-0 flex-col gap-[2.2vh] px-10 py-[3vh]" data-testid="today-card">
      <header className="flex flex-none flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-[clamp(24px,3.6vh,32px)] text-ink-soft">
            {GREETING[clock.partOfDay]}, {preferredName}
          </p>
          <h1 className="text-[clamp(44px,7.5vh,64px)] font-bold leading-tight">
            It&apos;s {clock.dayName} {clock.partOfDay === "night" ? "night" : clock.partOfDay}
          </h1>
          <p className="text-[clamp(28px,4.2vh,36px)]">{clock.dateText}</p>
        </div>
        <div className="text-right">
          <p className="text-[clamp(56px,10.5vh,88px)] font-bold leading-none text-sea-deep" data-testid="today-time">
            {clock.timeText}
          </p>
          <p className="mt-2 text-[clamp(28px,3.8vh,32px)]">
            You&apos;re at <span className="font-bold">{today?.locationLabel ?? "Home"}</span>
          </p>
        </div>
      </header>

      {!!today?.specialToday?.length && (
        <p className="flex-none rounded-3xl border-4 border-sun bg-sun-wash px-8 py-[1.2vh] text-[clamp(28px,4.2vh,36px)] font-bold text-ink" data-testid="today-special">
          {today.specialToday.join(" ")}
        </p>
      )}

      {today?.nextText && (
        <p className="flex-none rounded-3xl border-4 border-sea-deep bg-sea px-8 py-[1.6vh] text-[clamp(30px,4.8vh,40px)] font-bold text-white" data-testid="today-next">
          {today.nextText}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-6 lg:grid-cols-[1fr_1.3fr] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-3xl border-4 border-line bg-white p-6">
          <h2 className="flex-none text-[clamp(32px,5.4vh,48px)] font-bold leading-tight">Visitors today</h2>
          {(today?.visitorsToday.length ?? 0) === 0 ? (
            <p className="text-ink-soft">No visitors planned today.</p>
          ) : (
            <ul ref={visitorsRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              {visitors.map((v) => (
                <li key={v.personId} className="flex h-[76px] flex-none items-center gap-5">
                  {v.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.photoUrl} alt="" className="h-[72px] w-[72px] flex-none rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-2xl bg-sand text-[32px] font-bold text-sea-deep">
                      {v.name[0]}
                    </span>
                  )}
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-bold">{v.name}</span>
                    <span className="block truncate text-ink-soft">
                      your {v.relationship} · {v.timeText}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-3xl border-4 border-line bg-white p-6">
          <div className="flex flex-none flex-wrap items-center justify-between gap-3">
            <h2 className="text-[clamp(32px,5.4vh,48px)] font-bold leading-tight" data-testid="plan-title">
              {planTitle}
            </h2>
            <div className="flex gap-2">
              <button className={arrowCls} onClick={() => setOffset((o) => Math.max(-7, o - 1))} disabled={offset <= -7} data-testid="plan-prev">
                ‹ {offset === 1 ? "Today" : "Day before"}
              </button>
              <button className={arrowCls} onClick={() => setOffset((o) => Math.min(14, o + 1))} disabled={offset >= 14} data-testid="plan-next">
                {offset === -1 ? "Today" : "Next day"} ›
              </button>
            </div>
          </div>
          {!showingToday && other && <p className="flex-none text-[24px] text-ink-soft">{other.dateText}</p>}
          {emptyText || items.length === 0 ? (
            <p className="text-[clamp(28px,4vh,32px)]">{emptyText ?? "A quiet day at home"}</p>
          ) : (
            <ul ref={planRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              {items.slice(0, planFit).map((i) => (
                <li
                  key={i.id + i.startsAt}
                  className={cx(
                    "flex h-[56px] flex-none items-center gap-5 rounded-2xl px-4",
                    showingToday && i.status === "now" && "bg-sky font-bold outline-4 -outline-offset-4 outline-sea",
                    showingToday && i.status === "next" && "bg-sun-wash",
                  )}
                >
                  <span className="w-[150px] flex-none text-ink-soft">{i.timeText}</span>
                  <span className="truncate">
                    {i.title}
                    {i.personName && !i.title.includes(i.personName) ? ` with ${i.personName}` : ""}
                    {showingToday && i.status === "now" && <span className="ml-3 text-sea-deep">· now</span>}
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
