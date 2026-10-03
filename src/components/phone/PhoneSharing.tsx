"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserGeolocation, PingThrottle, type Fix, type LocationError } from "@/client/location/source";
import { haversineM } from "@/lib/geo";
import { api } from "@/client/api";
import { reportStatus } from "@/client/patient-api";

type Status = "starting" | "sharing" | LocationError;

export function PhoneSharing({ preferredName, caregiverName }: { preferredName: string; caregiverName: string }) {
  const [status, setStatus] = useState<Status>("starting");
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const throttle = useRef(new PingThrottle(15_000, 25, (a, b) => haversineM(a, b)));

  useEffect(() => {
    const src = new BrowserGeolocation();
    let sending = false;
    src.start(
      async (f: Fix) => {
        setStatus("sharing");
        if (sending || !throttle.current.shouldSend(f)) return;
        sending = true;
        try {
          await api("/api/location", {
            method: "POST",
            json: { lat: f.lat, lng: f.lng, accuracyM: f.accuracyM, recordedAt: new Date(f.at).toISOString(), source: "browser" },
          });
          throttle.current.sent(f);
          setLastSent(Date.now());
        } catch {
          /* offline: the next fix retries */
        } finally {
          sending = false;
        }
      },
      (e) => {
        setStatus(e);
        reportStatus({ geolocation: e === "denied" ? "denied" : "error" });
      },
    );
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      src.stop();
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (status === "sharing") reportStatus({ geolocation: "ok" });
  }, [status]);

  const secondsAgo = lastSent ? Math.max(0, Math.round((now - lastSent) / 1000)) : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-cream px-6 py-10 text-center text-ink">
      {status === "denied" ? (
        <>
          <h1 className="text-[36px] font-bold leading-tight">Location is turned off for this page</h1>
          <ol className="max-w-md list-decimal space-y-3 pl-6 text-left text-[22px]">
            <li>
              Open the iPhone <b>Settings</b> app.
            </li>
            <li>
              Tap <b>Privacy &amp; Security</b> → <b>Location Services</b> → <b>Safari Websites</b>.
            </li>
            <li>
              Choose <b>While Using the App</b> and turn on <b>Precise Location</b>.
            </li>
            <li>Come back here and reload the page.</li>
          </ol>
          <button onClick={() => location.reload()} className="min-h-[72px] rounded-3xl bg-sea px-10 text-[28px] font-bold text-white">
            Try again
          </button>
        </>
      ) : (
        <>
          <div className={"h-24 w-24 rounded-full " + (status === "sharing" ? "wm-pulse bg-leaf" : "bg-sand")} aria-hidden />
          <h1 className="text-[36px] font-bold leading-tight" data-testid="phone-status">
            {status === "sharing" ? `Sharing location with ${caregiverName}` : status === "starting" ? "Starting…" : "Looking for your location…"}
          </h1>
          <p className="text-[24px]">Hello, {preferredName}.</p>
          <p className="max-w-md rounded-3xl bg-sky px-6 py-4 text-[22px] font-semibold text-sea-deep">Keep this page open.</p>
          <p className="text-lg text-ink-soft">
            {secondsAgo !== null ? `Last update ${secondsAgo < 10 ? "just now" : `${secondsAgo} seconds ago`}` : " "}
          </p>
        </>
      )}
    </main>
  );
}
