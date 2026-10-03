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
