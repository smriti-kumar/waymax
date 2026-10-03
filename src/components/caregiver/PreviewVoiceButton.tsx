"use client";
import { useState } from "react";
import { speak } from "@/client/speech/speak";
import { Button } from "@/components/ui/Button";

/** Speaks "{name}, your {relationship}." through the same TTS pipeline as the patient laptop. */
export function PreviewVoiceButton({ name, relationship }: { name: string; relationship: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      loading={busy}
      disabled={!name || !relationship}
      onClick={async () => {
        setBusy(true);
        await speak(`${name}, your ${relationship}.`);
        setBusy(false);
      }}
    >
      Preview voice
    </Button>
  );
}
