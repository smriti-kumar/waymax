"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { logPatientEvent } from "@/client/patient-api";
import { speak, stopSpeaking } from "@/client/speech/speak";
import { BigButton } from "@/components/ui/BigButton";
import { PatientFrame } from "./PatientFrame";

type Show = {
  personId: string;
  name: string;
  relationship: string;
  intro: string;
  slides: { memoryId: string; title: string; caption: string; photoUrl: string | null }[];
  outro: string;
};

const backLink = "flex min-h-[72px] items-center rounded-3xl border-4 border-sea bg-white px-8 text-[28px] font-bold text-sea-deep";

/** Full-screen photo + caption, narrated; advances every 8 s (after the caption has been spoken). */
export function Slideshow({ personId, slideMs = 8000 }: { personId: string; slideMs?: number }) {
  const { data, error } = useSWR<Show>(`/api/patient/people/${personId}/memories`, fetcher, { shouldRetryOnError: true, errorRetryInterval: 10_000 });
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const logged = useRef(false);

  useEffect(() => {
    if (data && !logged.current) {
      logged.current = true;
      logPatientEvent("memories_opened", { personId });
    }
  }, [data, personId]);

  const advance = useCallback(() => {
    if (!data) return;
    if (i + 1 < data.slides.length) setI(i + 1);
    else setFinished(true);
  }, [data, i]);

  // Narrate the current slide; move on once both 8 s and the speech are done.
  useEffect(() => {
    if (!data || paused || finished) return;
    let cancelled = false;
    const slide = data.slides[i]!;
    const text = i === 0 && data.intro ? `${data.intro} ${slide.caption}` : slide.caption;
    let spoken = false;
    let timed = false;
    const maybeNext = () => {
      if (spoken && timed && !cancelled) advance();
    };
    void speak(text).then(() => {
      spoken = true;
      maybeNext();
    });
    const t = setTimeout(() => {
      timed = true;
      maybeNext();
    }, slideMs);
    return () => {
      clearTimeout(t);
      cancelled = true;
    };
  }, [data, i, paused, finished, slideMs, advance]);

  useEffect(() => {
    if (finished && data?.outro) void speak(data.outro);
  }, [finished, data]);

  useEffect(() => () => stopSpeaking(), []);

  const slide = data?.slides[Math.min(i, (data?.slides.length ?? 1) - 1)];

  return (
    <PatientFrame
      buttons={
        <>
          {finished ? (
            <BigButton
              onClick={() => {
                setFinished(false);
                setI(0);
              }}
            >
              Watch again
            </BigButton>
          ) : (
            <BigButton
              data-testid="slideshow-pause"
              onClick={() => {
                if (!paused) stopSpeaking();
                setPaused(!paused);
              }}
            >
              {paused ? "Play" : "Pause"}
            </BigButton>
          )}
          <Link href="/patient/memories" className={backLink}>
            Back
          </Link>
        </>
      }
    >
      {!data || !slide ? (
        <p className="m-auto text-[36px]">{error ? "These photos aren't ready just now. Let's look again in a little while." : "One moment…"}</p>
      ) : (
        <section className="relative flex h-full flex-col items-center justify-center gap-6 bg-ink px-10 py-6" data-testid="slideshow" data-slide={i}>
          {slide.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={slide.memoryId} src={slide.photoUrl} alt={slide.title} className="wm-slide-up min-h-0 flex-1 rounded-3xl object-contain" />
          ) : (
            <div className="flex min-h-0 w-[min(60vh,520px)] flex-1 items-center justify-center rounded-[48px] bg-sand text-[200px] font-bold text-sea-deep">
              {data.name[0]}
            </div>
          )}
          <p className="max-w-[30ch] text-center text-[40px] font-semibold leading-snug text-white" aria-live="polite" data-testid="slide-caption">
            {finished && data.outro ? data.outro : slide.caption}
          </p>
          {paused && <p className="absolute right-10 top-6 rounded-full bg-white px-6 py-2 text-[28px] font-bold text-ink">Paused</p>}
        </section>
      )}
    </PatientFrame>
  );
}
