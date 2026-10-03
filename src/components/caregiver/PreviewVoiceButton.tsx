"use client";
import { Button } from "@/components/ui/Button";

/** Speaks "{name}, your {relationship}." — wired to the TTS pipeline in T7. */
export function PreviewVoiceButton({ name, relationship }: { name: string; relationship: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!name || !relationship}
      onClick={() => {
        const u = new SpeechSynthesisUtterance(`${name}, your ${relationship}.`);
        u.rate = 0.85;
        window.speechSynthesis?.speak(u);
      }}
    >
      Preview voice
    </Button>
  );
}
