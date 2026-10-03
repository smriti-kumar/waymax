"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ListenSession } from "@/client/audio/listen";
import type { FinishResponse } from "@/lib/contracts/conversations";

export type ListenState = "idle" | "starting" | "recording" | "saving";

export function useListen() {
  const [state, setState] = useState<ListenState>("idle");
  const [result, setResult] = useState<FinishResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const session = useRef<ListenSession | null>(null);

  const stop = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setState("saving");
    try {
      const r = await s.stop();
      setResult(r);
    } catch {
      setProblem("That conversation couldn't be saved.");
    } finally {
      session.current = null;
      setState("idle");
    }
  }, []);

  const start = useCallback(
    async (context: { visitId?: string | null; personId?: string | null }) => {
      if (session.current) return;
      setResult(null);
      setProblem(null);
      setState("starting");
      const s = new ListenSession(undefined, () => void stop());
      session.current = s;
      try {
        await s.start(context);
        setState("recording");
      } catch {
        session.current = null;
        setState("idle");
        setProblem("The microphone isn't available right now.");
      }
    },
    [stop],
  );

  useEffect(
    () => () => {
      void session.current?.stop();
    },
    [],
  );

  const clear = useCallback(() => {
    setResult(null);
    setProblem(null);
  }, []);

  return { state, result, problem, start, stop, clear };
}
