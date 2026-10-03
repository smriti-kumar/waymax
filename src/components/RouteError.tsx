"use client";
import { useEffect } from "react";

export type ErrorProps = {
  error: Error & { digest?: string };
  retry?: () => void;
  unstable_retry?: () => void;
  reset?: () => void;
};

export function retryFn(p: ErrorProps) {
  return p.retry ?? p.unstable_retry ?? p.reset ?? (() => location.reload());
}

/** Caregiver-side error card with a retry button (raw messages stay in the console). */
export function CaregiverRouteError(props: ErrorProps) {
  useEffect(() => console.error(props.error), [props.error]);
  return (
    <div role="alert" className="mx-auto my-10 flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-sun bg-[#fff6e6] p-8 text-center">
      <h2 className="text-xl font-bold">This page didn&apos;t load</h2>
      <p className="text-ink-soft">Check the connection and try again. Nothing you entered was lost.</p>
      <button onClick={() => retryFn(props)()} className="rounded-xl bg-sea px-4 py-2.5 font-semibold text-white hover:bg-sea-deep">
        Try again
      </button>
    </div>
  );
}
