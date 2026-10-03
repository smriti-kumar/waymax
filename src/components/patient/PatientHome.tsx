"use client";
import { useEffect, useState } from "react";
import { logPatientEvent } from "@/client/patient-api";
import { speak } from "@/client/speech/speak";
import { BigButton } from "@/components/ui/BigButton";
import { PatientFrame, PatientLinkButton } from "./PatientFrame";
import { PersonCard } from "./PersonCard";
import { StartGate } from "./StartGate";
import { TodayCard } from "./TodayCard";
import { usePatientRecognition } from "./usePatientRecognition";
import { useToday } from "./useToday";
import { useListen } from "./useListen";

function PatientMain({ preferredName, timezone }: { preferredName: string; timezone: string }) {
  const today = useToday();
  const rec = usePatientRecognition(true);
  const [thanks, setThanks] = useState(false);
  const [adding, setAdding] = useState(false);
  const listen = useListen();
  const recording = listen.state === "recording" || listen.state === "starting";

  // A saved conversation updates the card so it shows what was just talked about.
  const { updateCard } = rec;
  const savedCard = listen.result?.card ?? null;
  useEffect(() => {
    if (savedCard) updateCard(savedCard);
  }, [savedCard, updateCard]);

  // Results fade on their own after a little while.
  useEffect(() => {
    if (!listen.result && !listen.problem) return;
    const t = setTimeout(listen.clear, 10_000);
    return () => clearTimeout(t);
  }, [listen.result, listen.problem, listen.clear]);

  const listenButton = (
    <BigButton
      tone="leaf"
      data-testid="listen"
      disabled={listen.state !== "idle"}
      onClick={() => listen.start({ visitId: rec.card?.visitId ?? null, personId: rec.card?.personId ?? null })}
    >
      {listen.state === "saving" ? "Saving…" : "Listen"}
    </BigButton>
  );

  const buttons = recording ? (
    <BigButton tone="sea" data-testid="listen-stop" onClick={() => void listen.stop()} className="min-w-[260px]">
      Stop
    </BigButton>
  ) : rec.card ? (
    <>
      <BigButton
        data-testid="who-is-this"
        onClick={() => {
          logPatientEvent("who_is_this", { personId: rec.card!.personId });
          void speak(rec.card!.sayText);
        }}
      >
        Who is this?
      </BigButton>
      {listenButton}
    </>
  ) : rec.unknown ? (
    <>
      <BigButton
        data-testid="add-this-person"
        disabled={adding}
        onClick={async () => {
          setAdding(true);
          const ok = await rec.addUnknown();
          setAdding(false);
          if (ok) {
            setThanks(true);
            setTimeout(() => setThanks(false), 8000);
          }
        }}
      >
        {adding ? "One moment…" : "Add this person"}
      </BigButton>
      <BigButton tone="light" onClick={rec.dismissUnknown}>
        Not now
      </BigButton>
    </>
  ) : (
    <>
      {listenButton}
      <PatientLinkButton href="/patient/questions">Questions</PatientLinkButton>
      <PatientLinkButton href="/patient/memories">Memories</PatientLinkButton>
    </>
  );

  return (
    <PatientFrame buttons={buttons}>
      <TodayCard today={today} timezone={timezone} preferredName={preferredName} />
      {rec.card && <PersonCard card={rec.card} onClose={rec.dismissCard} />}
      {!rec.card && rec.unknown && (
        <div role="status" data-testid="someone-here" className="wm-slide-up absolute inset-x-10 top-6 z-10 rounded-3xl border-4 border-sea bg-sky px-8 py-6 text-[40px] font-bold text-sea-deep shadow-md">
          Someone is here.
        </div>
      )}
      {recording && (
        <div role="status" data-testid="recording" className="absolute right-10 top-6 z-30 flex items-center gap-4 rounded-full border-4 border-sun-deep bg-white px-8 py-4 text-[36px] font-bold shadow-md">
          <span className="wm-pulse h-6 w-6 rounded-full bg-sun-deep" aria-hidden />
          {listen.state === "starting" ? "Starting…" : "Recording"}
        </div>
      )}
      {listen.result && !recording && (
        <div role="status" data-testid="listen-saved" className="wm-slide-up absolute inset-x-10 top-6 z-30 rounded-3xl border-4 border-leaf bg-leaf-wash px-8 py-6 text-[36px] font-bold text-leaf shadow-md">
          {listen.result.mightBe ? `This might be ${listen.result.mightBe.name}.` : "Saved. Thank you."}
        </div>
      )}
      {listen.problem && !recording && (
        <div role="status" className="wm-slide-up absolute inset-x-10 top-6 z-30 rounded-3xl border-4 border-sea bg-sky px-8 py-6 text-[32px] font-bold text-sea-deep shadow-md">
          {listen.problem}
        </div>
      )}
      {thanks && !rec.card && (
        <div role="status" className="wm-slide-up absolute inset-x-10 top-6 z-10 rounded-3xl border-4 border-leaf bg-leaf-wash px-8 py-6 text-[36px] font-bold text-leaf shadow-md">
          Thank you. Your family will add their name.
        </div>
      )}
    </PatientFrame>
  );
}

export function PatientHome({ preferredName, timezone }: { preferredName: string; timezone: string }) {
  return (
    <StartGate preferredName={preferredName}>
      <PatientMain preferredName={preferredName} timezone={timezone} />
    </StartGate>
  );
}
