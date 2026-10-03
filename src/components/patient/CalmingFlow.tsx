"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { chooseMusicSource, makePlayer, type MusicPlayer } from "@/client/audio/music";
import { logPatientEvent } from "@/client/patient-api";
import { speak, stopSpeaking } from "@/client/speech/speak";
import { BigButton } from "@/components/ui/BigButton";
import { PatientFrame } from "./PatientFrame";
import { useClock } from "./useClock";

type Calming = {
  locationText: string;
  timeText: string;
  dateText: string;
  reassurance: string;
  plan: { id: string; title: string; timeText: string; status: string; personName: string | null }[];
  planText: string;
  musicTracks: string[];
};

const backLink = "flex min-h-[72px] items-center rounded-3xl border-4 border-sea bg-white px-8 text-[28px] font-bold text-sea-deep";

export function CalmingFlow({ timezone, homeLabel }: { timezone: string; homeLabel: string }) {
  const router = useRouter();
  const { data } = useSWR<Calming>("/api/patient/calming", fetcher);
  const clock = useClock(timezone);
  const [step, setStep] = useState<1 | 2 | 3 | "music">(1);
  const player = useRef<MusicPlayer | null>(null);
  const spokenStep = useRef<number | string | null>(null);

  // Offline fallback: the device clock and home label still orient the patient.
  const part = clock.partOfDay === "night" ? "evening" : clock.partOfDay;
  const locationText = data?.locationText ?? `You are at ${homeLabel}.`;
  const timeText = data?.timeText ?? `It's ${clock.dayName} ${part}, ${clock.timeText.replace(/\s?(AM|PM)$/i, "")}.`;

  useEffect(() => {
    if (spokenStep.current === step) return;
    if (step === 1 && (data || spokenStep.current === null)) {
      spokenStep.current = 1;
      void speak(`${locationText} ${timeText} You're safe.`);
    } else if (step === 2 && data) {
      spokenStep.current = 2;
      void speak(data.planText);
    }
  }, [step, data, locationText, timeText]);

  useEffect(
    () => () => {
      player.current?.stop();
      stopSpeaking();
    },
    [],
  );

  async function playMusic() {
    logPatientEvent("calming_music");
    stopSpeaking();
    const source = chooseMusicSource(data?.musicTracks);
    player.current = makePlayer(source);
    setStep("music");
    try {
      await player.current.start();
    } catch {
      // A bundled file failed to play: fall back to the generated pad.
      player.current = makePlayer({ kind: "ambient" });
      await player.current.start().catch(() => {});
    }
  }

  const buttons =
    step === 1 ? (
      <>
        <BigButton onClick={() => setStep(2)} data-testid="calming-next">
          What&apos;s next today?
        </BigButton>
        <Link href="/patient" className={backLink}>
          Back to today
        </Link>
      </>
    ) : step === 2 ? (
      <>
        <BigButton onClick={() => setStep(3)} data-testid="calming-next">
          Something soothing
        </BigButton>
        <Link href="/patient" className={backLink}>
          Back to today
        </Link>
      </>
    ) : step === 3 ? (
      <Link href="/patient" className={backLink}>
        Back to today
      </Link>
    ) : (
      <BigButton
        tone="sea"
        data-testid="music-stop"
        onClick={() => {
          player.current?.stop();
          player.current = null;
          setStep(3);
        }}
      >
        Stop the music
      </BigButton>
    );

  return (
    <PatientFrame
      buttons={buttons}
      onConfused={() => {
        player.current?.stop();
        player.current = null;
        stopSpeaking();
        spokenStep.current = 1;
        setStep(1);
        void speak(`${locationText} ${timeText} You're safe.`);
      }}
    >
      <section className="flex h-full flex-col items-center justify-center gap-8 px-10 text-center" aria-live="polite" data-testid={`calming-step-${step}`}>
        {step === 1 && (
          <>
            <p className="text-[64px] font-bold leading-tight">{locationText}</p>
            <p className="text-[48px]">{timeText}</p>
            <p className="text-[56px] font-bold text-sea-deep">You&apos;re safe.</p>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-[56px] font-bold">The rest of today</h1>
            {data && data.plan.length ? (
              <ul className="flex flex-col gap-4 text-left text-[36px]">
                {data.plan.slice(0, 4).map((i) => (
                  <li key={i.id} className="flex gap-8">
                    <span className="w-[180px] text-ink-soft">{i.timeText}</span>
                    <span className={i.status === "now" ? "font-bold" : ""}>
                      {i.title}
                      {i.personName && !i.title.includes(i.personName) ? ` with ${i.personName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[40px]">The rest of today is quiet and restful.</p>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-[56px] font-bold">What would feel nice?</h1>
            <div className="flex flex-wrap justify-center gap-8">
              <button
                data-testid="play-music"
                onClick={playMusic}
                className="min-h-[200px] min-w-[360px] rounded-[40px] border-4 border-sea-deep bg-sea px-10 text-[40px] font-bold text-white hover:bg-sea-deep"
              >
                Play soothing music
              </button>
              <button
                data-testid="look-at-memories"
                onClick={() => {
                  logPatientEvent("calming_memories");
                  router.push("/patient/memories");
                }}
                className="min-h-[200px] min-w-[360px] rounded-[40px] border-4 border-sun-deep bg-sun px-10 text-[40px] font-bold text-ink hover:bg-sun-hover"
              >
                Look at memories
              </button>
            </div>
          </>
        )}
        {step === "music" && (
          <>
            <div className="wm-pulse h-40 w-40 rounded-full bg-sky" aria-hidden />
            <p className="text-[56px] font-bold">Soothing music is playing.</p>
            <p className="text-[36px] text-ink-soft">Breathe slowly. You&apos;re safe.</p>
          </>
        )}
      </section>
    </PatientFrame>
  );
}
