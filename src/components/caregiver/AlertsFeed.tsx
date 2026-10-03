"use client";
import useSWR from "swr";
import { api, fetcher } from "@/client/api";
import { ago } from "@/client/format";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";

export type NotificationDto = {
  id: string;
  kind: "geofence_exit" | "geofence_return" | "person_pending" | "test";
  title: string;
  body: string;
  photonStatus: "skipped" | "pending" | "sent" | "failed";
  photonLastError: string | null;
  readAt: string | null;
  createdAt: string;
};

const DELIVERY: Record<NotificationDto["photonStatus"], string> = {
  sent: "iMessage sent",
  pending: "iMessage sending…",
  failed: "iMessage failed",
  skipped: "in-app only",
};

export function AlertsFeed({ pid, limit = 10 }: { pid: string; limit?: number }) {
  const { data, error, isLoading, mutate } = useSWR<{ notifications: NotificationDto[] }>(`/api/patients/${pid}/notifications`, fetcher, {
    refreshInterval: 5000,
  });
  if (isLoading) return <Skeleton className="h-24" />;
  if (error) return <ErrorState onRetry={() => mutate()} />;
  const items = data?.notifications.slice(0, limit) ?? [];
  if (!items.length) return <EmptyState title="No alerts" body="Leaving or returning home, and new faces, show up here." />;
  return (
    <ul className="flex flex-col gap-2" data-testid="alerts-feed">
      {items.map((n) => (
        <li
          key={n.id}
          className={
            "flex flex-wrap items-start justify-between gap-2 rounded-xl border px-4 py-3 " +
            (n.readAt ? "border-line bg-white" : n.kind === "geofence_exit" ? "border-sun bg-[#fff6e6]" : "border-sea/40 bg-sky/50")
          }
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{n.title}</p>
            <p className="break-words text-sm text-ink-soft">{n.body}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {ago(n.createdAt)} · {n.kind === "person_pending" ? "in-app" : DELIVERY[n.photonStatus]}
            </p>
          </div>
          {!n.readAt && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await api(`/api/notifications/${n.id}/read`, { method: "POST" });
                mutate();
              }}
            >
              Mark read
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
