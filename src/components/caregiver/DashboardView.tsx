"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { ago } from "@/client/format";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import { AlertsFeed } from "./AlertsFeed";
import { Avatar } from "./Avatar";
import { ConfusionChart } from "./ConfusionChart";
import { StatusTile } from "./SafetyMapPanel";

type Dashboard = {
  patient: { id: string; preferredName: string; homeLabel: string };
  geofenceState: "unknown" | "inside" | "outside";
  geofenceStateChangedAt: string | null;
  lastLocation: { recordedAt: string } | null;
  pendingPeople: number;
  unreadAlerts: number;
  visitsToday: { id: string; name: string; relationship: string; photoUrl: string | null; timeText: string; minutes: number }[];
  confusionToday: number;
  devices: { id: string; kind: string; label: string; lastSeenAt: string | null; online: boolean }[];
  flags: { id: string; kind: string; message: string }[];
  upcomingDates: { id: string; days: number; dateText: string; text: string }[];
};
type Confusion = { daily: { day: string; n: number }[]; byHour: { hour: number; n: number }[]; insight?: string | null };

/** Flags this caregiver dismissed, remembered per browser. */
function useDismissed(pid: string) {
  const key = `waymax:dismissed-flags:${pid}`;
  // Flags render only after client-side data loads, so reading storage here can't cause a hydration mismatch.
  const [ids, setIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  });
  const dismiss = (more: string[]) =>
    setIds((cur) => {
      const next = [...new Set([...cur, ...more])].slice(-200);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* private mode: dismissal lasts until reload */
      }
      return next;
    });
  return { ids, dismiss };
}

export function DashboardView({ pid }: { pid: string }) {
  const dismissed = useDismissed(pid);
  const dash = useSWR<Dashboard>(`/api/patients/${pid}/dashboard`, fetcher, { refreshInterval: 5000 });
  const conf = useSWR<Confusion>(`/api/patients/${pid}/confusion?days=14`, fetcher, { refreshInterval: 10_000 });
  const d = dash.data;

  if (dash.error && !d) return <ErrorState message="We couldn't load the dashboard." onRetry={() => dash.mutate()} />;
  if (!d)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64 md:col-span-2" />
      </div>
    );

  const visibleFlags = d.flags.filter((f) => !dismissed.ids.includes(f.id));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <StatusTile state={d.geofenceState} changedAt={d.geofenceStateChangedAt} label={d.patient.homeLabel} lastAt={d.lastLocation?.recordedAt ?? null} />
      </div>

      {visibleFlags.length > 0 && (
        <Card className="md:col-span-2 border-sun bg-[#fffaf0]" data-testid="flags">
          <div className="mb-2 flex items-center justify-between gap-2">
            <CardTitle>Needs a look</CardTitle>
            <button
              onClick={() => dismissed.dismiss(visibleFlags.map((f) => f.id))}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-ink-soft hover:bg-sand"
              aria-label="Dismiss all"
              data-testid="flags-dismiss-all"
            >
              Dismiss all ✕
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {visibleFlags.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 text-ink">
                <span>
                  <span aria-hidden>⚠︎ </span>
                  {f.message}
                </span>
                <button
                  onClick={() => dismissed.dismiss([f.id])}
                  aria-label={`Dismiss: ${f.message}`}
                  className="flex-none rounded-lg px-2 text-lg leading-6 text-ink-soft hover:bg-sand"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <CardTitle>&quot;I feel confused&quot; presses</CardTitle>
          <span className="text-sm text-ink-soft">last 14 days</span>
        </div>
        <p className="mb-2">
          <span className="text-4xl font-bold" data-testid="confusion-today">
            {d.confusionToday}
          </span>{" "}
          <span className="text-ink-soft">today</span>
        </p>
        {conf.data?.insight && <p className="mb-2 text-ink-soft">{conf.data.insight}</p>}
        {conf.data ? <ConfusionChart daily={conf.data.daily} /> : conf.error ? <ErrorState onRetry={() => conf.mutate()} /> : <Skeleton className="h-56" />}
      </Card>

      <Card>
        <CardTitle className="mb-3">Visitors today</CardTitle>
        {d.visitsToday.length === 0 ? (
          <EmptyState title="No visitors yet today" body="When someone is recognized on the patient's screen, they appear here." />
        ) : (
          <ul className="flex flex-col gap-3">
            {d.visitsToday.map((v) => (
              <li key={v.id} className="flex items-center gap-3">
                <Avatar url={v.photoUrl} name={v.name} className="h-12 w-12" />
                <span>
                  <span className="block font-semibold">
                    {v.name} <span className="font-normal text-ink-soft">· {v.relationship}</span>
                  </span>
                  <span className="text-sm text-ink-soft">
                    arrived {v.timeText} · about {v.minutes} min
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <CardTitle>Alerts</CardTitle>
          {d.unreadAlerts > 0 && <span className="rounded-full bg-sun px-2 text-sm font-bold">{d.unreadAlerts} new</span>}
        </div>
        <AlertsFeed pid={pid} limit={5} />
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle className="mb-2">Coming up</CardTitle>
          {d.upcomingDates.length === 0 ? (
            <p className="text-ink-soft">No birthdays or anniversaries in the next 30 days. Add them on each person&apos;s page.</p>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="upcoming-dates">
              {d.upcomingDates.map((u) => (
                <li key={u.id} className="flex justify-between gap-3">
                  <span>{u.text}</span>
                  <span className={u.days === 0 ? "font-semibold text-leaf" : "text-ink-soft"}>
                    {u.days === 0 ? "today" : u.days === 1 ? "tomorrow" : `${u.dateText} · in ${u.days} days`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle className="mb-2">Waiting for approval</CardTitle>
          {d.pendingPeople > 0 ? (
            <Link href={`/caregiver/${pid}/approvals`} className="font-semibold text-sea-deep underline">
              {d.pendingPeople} new {d.pendingPeople === 1 ? "face" : "faces"} to name →
            </Link>
          ) : (
            <p className="text-ink-soft">Nothing waiting.</p>
          )}
        </Card>
        <Card>
          <CardTitle className="mb-2">Devices</CardTitle>
          {d.devices.length === 0 ? (
            <p className="text-ink-soft">
              No devices yet.{" "}
              <Link className="font-semibold text-sea-deep underline" href={`/caregiver/${pid}/safety`}>
                Pair the laptop and phone
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {d.devices.map((x) => (
                <li key={x.id} className="flex justify-between gap-2">
                  <span>{x.label}</span>
                  <span className={x.online ? "font-semibold text-leaf" : "text-ink-soft"}>{x.online ? "● online" : `seen ${ago(x.lastSeenAt)}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
