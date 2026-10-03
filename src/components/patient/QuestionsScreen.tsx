"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { logPatientEvent } from "@/client/patient-api";
import { speak, stopSpeaking } from "@/client/speech/speak";
import { BigButton } from "@/components/ui/BigButton";
import { PatientFrame } from "./PatientFrame";

type Q = { id: string; question: string; answer: string };
const backLink = "flex min-h-[72px] items-center rounded-3xl border-4 border-sea bg-white px-8 text-[28px] font-bold text-sea-deep";

/** One big button per question; the answer is shown and spoken exactly as written. */
export function QuestionsScreen() {
  const { data, error } = useSWR<{ questions: Q[] }>("/api/patient/questions", fetcher, { keepPreviousData: true });
  const [open, setOpen] = useState<Q | null>(null);
  const [page, setPage] = useState(0);
  const qs = data?.questions ?? [];
  // Max 4 action buttons: 3 questions + Back, or 2 + More + Back when there are more.
  const perPage = qs.length > 3 ? 2 : 3;
  const pages = Math.max(1, Math.ceil(qs.length / perPage));
  const shown = qs.slice(page * perPage, page * perPage + perPage);

  function ask(q: Q) {
    setOpen(q);
    logPatientEvent("question_asked", { questionId: q.id });
    stopSpeaking();
    void speak(q.answer);
  }

  if (open) {
    return (
      <PatientFrame
        buttons={
          <>
            <BigButton onClick={() => speak(open.answer)}>Hear it again</BigButton>
            <BigButton tone="light" onClick={() => setOpen(null)}>
              Back to questions
            </BigButton>
          </>
        }
      >
        <section className="flex h-full flex-col justify-center gap-8 px-12" aria-live="polite">
          <p className="text-[36px] text-ink-soft">{open.question}</p>
          <p className="text-[56px] font-bold leading-snug" data-testid="question-answer">
            {open.answer}
          </p>
        </section>
      </PatientFrame>
    );
  }

  return (
    <PatientFrame
      buttons={
        <>
          {pages > 1 && <BigButton tone="light" onClick={() => setPage((p) => (p + 1) % pages)}>More questions</BigButton>}
          <Link href="/patient" className={backLink}>
            Back to today
          </Link>
        </>
      }
    >
      <section className="flex h-full flex-col justify-center gap-6 px-12">
        <h1 className="text-[56px] font-bold">Questions</h1>
        {!data && !error ? (
          <p>One moment…</p>
        ) : qs.length === 0 ? (
          <p className="text-[36px]">Your family hasn&apos;t added any questions yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {shown.map((q) => (
              <button
                key={q.id}
                onClick={() => ask(q)}
                className="min-h-[96px] rounded-3xl bg-sea px-10 text-left text-[40px] font-bold text-white shadow-sm hover:bg-sea-deep"
              >
                {q.question}
              </button>
            ))}
          </div>
        )}
      </section>
    </PatientFrame>
  );
}
