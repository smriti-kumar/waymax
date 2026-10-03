"use client";
import dynamic from "next/dynamic";
import { useMemo, useState, type FormEvent } from "react";
import useSWR from "swr";
import { api, ApiClientError, fetcher } from "@/client/api";
import { ago, clockTime } from "@/client/format";
import type { LocationResponse } from "@/lib/contracts/location";
import { pickActiveFence } from "@/lib/geo";
import { Button } from "@/components/ui/Button";
import { Choices, Field, Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { MapFence, MapPoint } from "./FenceMapInner";

// Google Maps when a browser key is configured, otherwise OpenStreetMap (no key needed).
const FenceMap = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  ? dynamic(() => import("./GoogleFenceMap"), { ssr: false, loading: () => <Skeleton className="h-[420px]" /> })
  : dynamic(() => import("./FenceMapInner"), { ssr: false, loading: () => <Skeleton className="h-[420px]" /> });

const DEFAULT_CENTER = { lat: 42.444, lng: -76.5019 }; // Ithaca, NY
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const RADII = [100, 150, 250, 500, 1000, 2000];

type FenceRow = MapFence & { activeFrom: string | null; activeUntil: string | null; isActive: boolean };

export function StatusTile({ state, changedAt, label, lastAt }: { state: string; changedAt: string | null; label: string; lastAt: string | null }) {
  const outside = state === "outside";
  return (
    <div
      data-testid="fence-status"
      className={"rounded-2xl border-4 px-5 py-4 " + (outside ? "border-sun-deep bg-sun-wash text-sun-deep" : state === "inside" ? "border-leaf bg-leaf-wash text-leaf" : "border-line bg-sand text-ink-soft")}
    >
      <p className="text-3xl font-bold">{outside ? `Outside ${label}` : state === "inside" ? `Inside ${label}` : "Location not known yet"}</p>
      <p className="text-lg font-semibold">
        {changedAt ? `Since ${clockTime(changedAt)} · ` : ""}
        {lastAt ? `last update ${ago(lastAt)}` : "No location received yet — pair the patient's phone."}
      </p>
    </div>
  );
}

export function SafetyMapPanel({ pid }: { pid: string }) {
  const toast = useToast();
  const loc = useSWR<LocationResponse>(`/api/patients/${pid}/location?limit=50`, fetcher, { refreshInterval: 5000 });
  const fences = useSWR<{ fences: FenceRow[] }>(`/api/patients/${pid}/geofences`, fetcher);
  const home = fences.data?.fences.find((f) => f.kind === "home") ?? null;
  const [draft, setDraft] = useState<MapPoint | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [mode, setMode] = useState<"home" | "temp">("home");
  const [busy, setBusy] = useState<string | null>(null);
  const [recenter, setRecenter] = useState<string | undefined>(undefined);
  const radiusM = radius ?? home?.radiusM ?? 150;

  const center = draft ?? (home ? { lat: home.centerLat, lng: home.centerLng } : DEFAULT_CENTER);
  const active = useMemo(() => (fences.data ? pickActiveFence(fences.data.fences) : null), [fences.data]);
  const mapFences = (fences.data?.fences ?? []).map((f) => ({ ...f, active: active?.id === f.id }));

  async function saveHome() {
    setBusy("home");
    try {
      await api(`/api/patients/${pid}/geofences/home`, {
        method: "PUT",
        json: { lat: center.lat, lng: center.lng, radiusM, label: home?.label ?? "Home" },
      });
      setDraft(null);
      toast("Home area saved", "success");
      await fences.mutate();
      await loc.mutate();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Couldn't save", "warn");
    } finally {
      setBusy(null);
    }
  }

  async function simulate(action: "walk_out" | "walk_home") {
    setBusy(action);
    try {
      const r = await api<{ state: string }>(`/api/patients/${pid}/location/simulate`, { method: "POST", json: { action } });
      toast(r.state === "outside" ? "Simulated: left home" : "Simulated: back home", "success");
      await loc.mutate();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Couldn't simulate", "warn");
    } finally {
      setBusy(null);
    }
  }

  async function addTemp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    if (!draft) return toast("Click the map where the event is first", "warn");
    setBusy("temp");
    try {
      await api(`/api/patients/${pid}/geofences`, {
        method: "POST",
        json: {
          label: f.get("label"),
          lat: draft.lat,
          lng: draft.lng,
          radiusM,
          activeFrom: new Date(String(f.get("from"))).toISOString(),
          activeUntil: new Date(String(f.get("until"))).toISOString(),
        },
      });
      form.reset();
      setDraft(null);
      toast("Event area added", "success");
      await fences.mutate();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Couldn't add", "warn");
    } finally {
      setBusy(null);
    }
  }

  const latest = loc.data?.latest ? { lat: loc.data.latest.lat, lng: loc.data.latest.lng } : null;

  return (
    <div className="flex flex-col gap-4">
      <StatusTile
        state={loc.data?.state ?? "unknown"}
        changedAt={loc.data?.stateChangedAt ?? null}
        label={loc.data?.fence?.label ?? "home"}
        lastAt={loc.data?.latest?.recordedAt ?? null}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={mode === "home" ? "primary" : "secondary"} onClick={() => setMode("home")}>
          Home area
        </Button>
        <Button size="sm" variant={mode === "temp" ? "primary" : "secondary"} onClick={() => setMode("temp")}>
          Event area (temporary)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition((p) => {
              setDraft({ lat: p.coords.latitude, lng: p.coords.longitude });
              setRecenter(String(Date.now()));
            })
          }
        >
          Use my location
        </Button>
        {latest && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(null);
              setRecenter(`latest-${Date.now()}`);
            }}
          >
            Show patient
          </Button>
        )}
      </div>
      <p className="text-sm text-ink-soft">
        {mode === "home" ? "Click the map to place home, adjust the radius, then save." : "Click where the event is, set the radius and the time window."}
      </p>
      <FenceMap
        center={recenter?.startsWith("latest") && latest ? latest : center}
        recenterKey={recenter}
        fences={mapFences}
        draft={draft ? { ...draft, radiusM } : null}
        trail={(loc.data?.trail ?? []).map((t) => ({ lat: t.lat, lng: t.lng }))}
        latest={latest}
        onClick={(p) => setDraft(p)}
      />
      <Choices
        label="How far can they go before you're alerted?"
        name="radius"
        value={String(radiusM)}
        onChange={(v) => setRadius(Number(v))}
        options={[
          ...(RADII.includes(radiusM) ? [] : [{ value: String(radiusM), label: `${radiusM} m (current)` }]),
          ...RADII.map((m) => ({ value: String(m), label: m < 1000 ? `${m} m` : `${m / 1000} km` })),
        ]}
      />
      {mode === "home" ? (
        <Button onClick={saveHome} loading={busy === "home"} disabled={!draft && radius === null && !!home}>
          {home ? "Save home area" : "Set home here"}
        </Button>
      ) : (
        <form onSubmit={addTemp} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Event">
            <Input name="label" required maxLength={60} placeholder="Birthday party" />
          </Field>
          <Field label="From">
            <Input name="from" type="datetime-local" required />
          </Field>
          <Field label="Until">
            <Input name="until" type="datetime-local" required />
          </Field>
          <Button type="submit" loading={busy === "temp"}>
            Add event area
          </Button>
        </form>
      )}
      {fences.data?.fences.some((f) => f.kind === "temporary") && (
        <ul className="flex flex-col gap-2">
          {fences.data.fences
            .filter((f) => f.kind === "temporary")
            .map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-line bg-white px-4 py-3">
                <span>
                  <span className="font-semibold">{f.label}</span>{" "}
                  <span className="text-sm text-ink-soft">
                    {new Date(f.activeFrom!).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} –{" "}
                    {new Date(f.activeUntil!).toLocaleTimeString([], { timeStyle: "short" })} · {f.radiusM} m
                    {active?.id === f.id ? " · active now" : ""}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api(`/api/patients/${pid}/geofences/${f.id}`, { method: "DELETE" });
                    await fences.mutate();
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
        </ul>
      )}
      {DEMO && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-sun-deep bg-sun-wash p-4">
          <span className="font-semibold text-sun-deep">Demo:</span>
          <Button size="sm" variant="warn" loading={busy === "walk_out"} disabled={!home} onClick={() => simulate("walk_out")}>
            Simulate walk out
          </Button>
          <Button size="sm" variant="secondary" loading={busy === "walk_home"} disabled={!home} onClick={() => simulate("walk_home")}>
            Simulate walk home
          </Button>
        </div>
      )}
    </div>
  );
}
