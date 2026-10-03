"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { retryFn, type ErrorProps } from "@/components/RouteError";

/**
 * Patient screens never show raw errors: a calm clock, a reassurance, and a
 * quiet automatic retry every 20 s.
 */
export default function PatientError(props: ErrorProps) {
  const [now, setNow] = useState(() => new Date());
  const retry = retryFn(props);
  useEffect(() => {
    console.error(props.error);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const again = setInterval(retry, 20_000);
    return () => {
      clearInterval(tick);
      clearInterval(again);
    };
  }, [props.error, retry]);
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-8 bg-cream px-10 text-center text-ink">
      <p className="text-[88px] font-bold text-sea-deep">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
      <p className="text-[48px] font-bold">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
      <p className="text-[36px]">You&apos;re safe. Everything is fine.</p>
      <Link href="/patient" onClick={() => retry()} className="min-h-[72px] rounded-3xl bg-sea px-10 py-4 text-[28px] font-bold text-white">
        Back to today
      </Link>
    </main>
  );
}
