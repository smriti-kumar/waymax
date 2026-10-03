"use client";
import { useState, type ReactNode } from "react";
import { requestMediaPermissions, unlockAudio, within } from "@/client/audio-unlock";
import { reportStatus } from "@/client/patient-api";

// Survives client-side navigation between patient screens (same document, audio
// already unlocked); a full reload needs a fresh gesture, so it starts false again.
let startedThisDocument = false;

/**
 * One tap before anything else: unlocks audio, asks for camera + mic, and goes
 * full screen (Esc leaves full screen).
 * Browsers require a gesture for sound, so this can't be skipped.
 */
export function StartGate({
  preferredName,
  children,
  onStarted,
}: {
  preferredName: string;
  children: ReactNode;
  onStarted?: (perm: { camera: boolean; mic: boolean }) => void;
}) {
  const [started, setStarted] = useState(startedThisDocument);
  const [busy, setBusy] = useState(false);
  if (started) return <>{children}</>;
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-10 bg-cream px-8 text-center text-ink">
      <h1 className="text-[64px] font-bold">Hello, {preferredName}</h1>
      <button
        data-testid="start-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await unlockAudio();
          try {
            if (!document.fullscreenElement) await within(document.documentElement.requestFullscreen(), 1500, undefined);
          } catch {
            /* full screen not available; carry on */
          }
          reportStatus({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
          const perm = await requestMediaPermissions();
          onStarted?.(perm);
          startedThisDocument = true;
          setStarted(true);
        }}
        className="min-h-[120px] min-w-[360px] rounded-[40px] bg-sea px-12 text-[48px] font-bold text-white shadow-md hover:bg-sea-deep"
      >
        {busy ? "One moment…" : "Start"}
      </button>
    </main>
  );
}
