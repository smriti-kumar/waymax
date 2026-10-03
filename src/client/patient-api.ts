import { api } from "./api";
import type { EventKind, PersonCardDto } from "@/lib/contracts/patient";

/** Fire-and-forget event log; never throws into patient UI. */
export function logPatientEvent(kind: EventKind, payload: Record<string, unknown> = {}) {
  void api("/api/patient/events", { method: "POST", json: { kind, payload } }).catch(() => {});
}

export function reportStatus(status: Record<string, string>) {
  void api("/api/patient/status", { method: "POST", json: status }).catch(() => {});
}

export async function postRecognition(personId: string | null, confidence: number, source: "face" | "manual") {
  return api<{ card: PersonCardDto | null }>("/api/patient/recognitions", {
    method: "POST",
    json: { personId, confidence, source },
  });
}
