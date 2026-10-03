"use client";
import { useState } from "react";
import { logPatientEvent } from "@/client/patient-api";
import { speak } from "@/client/speech/speak";
import { BigButton } from "@/components/ui/BigButton";
import { PatientFrame, PatientLinkButton } from "./PatientFrame";
import { PersonCard } from "./PersonCard";
import { StartGate } from "./StartGate";
import { TodayCard } from "./TodayCard";
import { usePatientRecognition } from "./usePatientRecognition";
import { useToday } from "./useToday";
import { WhoIsHerePicker } from "./WhoIsHerePicker";

function PatientMain({ preferredName, timezone }: { preferredName: string; timezone: string }) {
  const today = useToday();
  const rec = usePatientRecognition(true);
  const [picking, setPicking] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [adding, setAdding] = useState(false);

  const buttons = rec.card ? (
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
      <BigButton tone="light" onClick={rec.dismissCard}>
        Back to today
      </BigButton>
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
      <BigButton tone="light" onClick={() => setPicking(true)}>
        Who&apos;s here?
      </BigButton>
      <BigButton tone="light" onClick={rec.dismissUnknown}>
        Not now
      </BigButton>
    </>
  ) : (
    <>
      <BigButton tone="light" data-testid="whos-here" onClick={() => setPicking(true)}>
        Who&apos;s here?
      </BigButton>
      <PatientLinkButton href="/patient/questions">Questions</PatientLinkButton>
      <PatientLinkButton href="/patient/memories">Memories</PatientLinkButton>
    </>
  );

  return (
    <PatientFrame buttons={picking ? null : buttons}>
      <TodayCard today={today} timezone={timezone} preferredName={preferredName} />
      {rec.card && <PersonCard card={rec.card} />}
      {!rec.card && rec.unknown && (
        <div role="status" data-testid="someone-here" className="wm-slide-up absolute inset-x-10 top-6 z-10 rounded-3xl bg-sky px-8 py-6 text-[40px] font-bold text-sea-deep shadow-md">
          Someone is here.
        </div>
      )}
      {thanks && !rec.card && (
        <div role="status" className="wm-slide-up absolute inset-x-10 top-6 z-10 rounded-3xl bg-[#e4efdc] px-8 py-6 text-[36px] font-semibold text-leaf shadow-md">
          Thank you. Your family will add their name.
        </div>
      )}
      {picking && (
        <WhoIsHerePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            void rec.pickManually(id);
          }}
        />
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
