"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/Spinner";
import { AboutPatientForm } from "./AboutPatientForm";
import { AlertContactsPanel } from "./AlertContactsPanel";
import { DevicesPanel } from "./DevicesPanel";
import { QuestionsEditor } from "./QuestionsEditor";
import { QuickAddPeople } from "./QuickAddPeople";
import { SafetyMapPanel } from "./SafetyMapPanel";
import { ScheduleEditor } from "./ScheduleEditor";

const STEPS = [
  { key: "about", title: "About them", intro: "How the patient's screens greet them." },
  { key: "home", title: "Home area", intro: "Click their home on the map and choose how far they can wander before you're told." },
  { key: "contacts", title: "Alert phones", intro: "Who gets an iMessage if they leave the area. Send a test to check." },
  { key: "devices", title: "Pair devices", intro: "Open /pair on the patient's laptop (Chrome) and iPhone (Safari) and type the code." },
  { key: "people", title: "Family & friends", intro: "Add the people who visit, with 3 clear face photos each, so the laptop can recognize them." },
  { key: "schedule", title: "Their day", intro: "Meals, visits and activities for the Today screen." },
  { key: "questions", title: "Questions", intro: "Questions they ask often, with the calm answer you want them to hear every time." },
] as const;
type Key = (typeof STEPS)[number]["key"];

export function SetupWizard({ pid }: { pid: string }) {
  const { data, mutate } = useSWR<{ steps: Record<Key, boolean> }>(`/api/patients/${pid}/setup-status`, fetcher);
  const [current, setCurrent] = useState<number | null>(null);

  if (!data) return <Skeleton className="h-96" />;
  // A brand-new patient starts at step 1; otherwise resume at the first unfinished
  // step (progress is remembered through the data itself).
  const anyDone = STEPS.some((s) => s.key !== "about" && data.steps[s.key]);
  const firstOpen = STEPS.findIndex((s) => s.key !== "about" && !data.steps[s.key]);
  const idx = current ?? (!anyDone ? 0 : firstOpen === -1 ? STEPS.length - 1 : firstOpen);
  const step = STEPS[idx]!;
  const next = () => {
    void mutate();
    setCurrent(Math.min(idx + 1, STEPS.length));
  };
  const done = current === STEPS.length;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              onClick={() => setCurrent(i)}
              aria-current={!done && i === idx ? "step" : undefined}
              className={cx(
                "flex min-h-12 items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-bold",
                !done && i === idx ? "border-sea bg-sea text-white" : "border-line bg-white text-ink-soft hover:border-sea",
              )}
            >
              <span>{data.steps[s.key] ? "✓" : i + 1}</span>
              {s.title}
            </button>
          </li>
        ))}
      </ol>

      {done ? (
        <Card className="flex flex-col items-start gap-3">
          <h2 className="text-2xl font-bold">All set</h2>
          <p className="text-ink-soft">
            The patient&apos;s laptop shows today&apos;s plan and recognizes visitors; their phone shares location. You can change anything later from the tabs above.
          </p>
          <Link href={`/caregiver/${pid}`} className="inline-flex min-h-14 items-center rounded-xl border-2 border-sea-deep bg-sea px-6 text-lg font-bold text-white hover:bg-sea-deep">
            Go to the overview
          </Link>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4" data-testid={`setup-step-${step.key}`}>
          <div>
            <p className="text-sm font-semibold text-ink-soft">
              Step {idx + 1} of {STEPS.length}
            </p>
            <h2 className="text-2xl font-bold">{step.title}</h2>
            <p className="text-ink-soft">{step.intro}</p>
          </div>
          {step.key === "about" && <AboutPatientForm pid={pid} onSaved={next} />}
          {step.key === "home" && <SafetyMapPanel pid={pid} />}
          {step.key === "contacts" && <AlertContactsPanel pid={pid} />}
          {step.key === "devices" && <DevicesPanel pid={pid} />}
          {step.key === "people" && <QuickAddPeople pid={pid} onChange={() => void mutate()} />}
          {step.key === "schedule" && <ScheduleEditor pid={pid} />}
          {step.key === "questions" && <QuestionsEditor pid={pid} />}
          <div className="flex flex-wrap gap-2 border-t-2 border-line pt-4">
            {idx > 0 && (
              <Button variant="ghost" onClick={() => setCurrent(idx - 1)}>
                Back
              </Button>
            )}
            {step.key !== "about" && (
              <Button onClick={next} data-testid="setup-next">
                {data.steps[step.key] ? "Next" : "Skip for now"}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
