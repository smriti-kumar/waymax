"use client";
import { PatientFrame, PatientLinkButton } from "./PatientFrame";
import { StartGate } from "./StartGate";
import { TodayCard } from "./TodayCard";
import { useToday } from "./useToday";

export function PatientHome({ preferredName, timezone }: { preferredName: string; timezone: string }) {
  const today = useToday();
  return (
    <StartGate preferredName={preferredName}>
      <PatientFrame
        buttons={
          <>
            <PatientLinkButton href="/patient/questions">Questions</PatientLinkButton>
            <PatientLinkButton href="/patient/memories">Memories</PatientLinkButton>
          </>
        }
      >
        <TodayCard today={today} timezone={timezone} preferredName={preferredName} />
      </PatientFrame>
    </StartGate>
  );
}
