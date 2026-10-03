"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { ago } from "@/client/format";
import { Button } from "@/components/ui/Button";
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
    <div className="grid gap-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <StatusTile state={d.geofenceState} changedAt={d.geofenceStateChangedAt} label={d.patient.homeLabel} lastAt={d.lastLocation?.recordedAt ?? null} />
      </div>

      {visibleFlags.length > 0 && (
        <Card className="md:col-span-2 border-sun-deep bg-sun-wash" data-testid="flags">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Needs a look</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismissed.dismiss(visibleFlags.map((f) => f.id))}
              aria-label="Dismiss all"
              data-testid="flags-dismiss-all"
            >
              Dismiss all
            </Button>
          </div>
          <ul className="flex flex-col gap-3">
            {visibleFlags.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 text-lg text-ink">
                <span>
                  <span aria-hidden>⚠︎ </span>
                  {f.message}
                </span>
                <Button size="sm" variant="ghost" onClick={() => dismissed.dismiss([f.id])} aria-label={`Dismiss: ${f.message}`}>
                  Dismiss
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>&quot;I feel confused&quot; presses</CardTitle>
        <p className="mb-3 text-ink-soft">Last 14 days</p>
        <p className="mb-2">
          <span className="text-5xl font-bold" data-testid="confusion-today">
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
            {d.visitsToday.slice(0, 5).map((v) => (
              <li key={v.id} className="flex items-center gap-3">
                <Avatar url={v.photoUrl} name={v.name} className="h-16 w-16 text-xl" />
                <span>
                  <span className="block text-lg font-bold">
                    {v.name} <span className="font-normal text-ink-soft">· {v.relationship}</span>
                  </span>
                  <span className="text-ink-soft">
                    arrived {v.timeText} · about {v.minutes} min
                  </span>
                </span>
              </li>
            ))}
            {d.visitsToday.length > 5 && <li className="text-ink-soft">…and {d.visitsToday.length - 5} earlier visits today.</li>}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Alerts</CardTitle>
          {d.unreadAlerts > 0 && <span className="rounded-full border-2 border-ink bg-sun px-3 text-base font-bold">{d.unreadAlerts} new</span>}
        </div>
        <AlertsFeed pid={pid} limit={5} />
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardTitle className="mb-2">Coming up</CardTitle>
          {d.upcomingDates.length === 0 ? (
            <p className="text-ink-soft">No birthdays or anniversaries in the next 30 days. Add them on each person&apos;s page.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="upcoming-dates">
              {d.upcomingDates.map((u) => (
                <li key={u.id} className="flex flex-wrap justify-between gap-x-3">
                  <span>{u.text}</span>
                  <span className={u.days === 0 ? "font-bold text-leaf" : "text-ink-soft"}>
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
            <Link
              href={`/caregiver/${pid}/approvals`}
              className="inline-flex min-h-14 items-center rounded-xl border-2 border-sea-deep bg-sea px-5 text-lg font-bold text-white hover:bg-sea-deep"
            >
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
              <Link className="font-bold text-sea-deep underline underline-offset-4" href={`/caregiver/${pid}/safety`}>
                Pair the laptop and phone
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.devices.map((x) => (
                <li key={x.id} className="flex flex-wrap justify-between gap-x-3">
                  <span>{x.label}</span>
                  <span className={x.online ? "font-bold text-leaf" : "text-ink-soft"}>{x.online ? "● online" : `seen ${ago(x.lastSeenAt)}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
