import "server-only";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import generated from "@/generated/calm-tracks.json";
import { buildToday } from "./schedule";

/** Files in public/audio/calm/ (read live when the folder is on disk, else the build-time list). */
export async function listCalmTracks(): Promise<string[]> {
  try {
    const files = await readdir(join(process.cwd(), "public", "audio", "calm"));
    return files
      .filter((f) => /\.(mp3|m4a|ogg|wav)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => `/audio/calm/${encodeURIComponent(f)}`);
  } catch {
    return generated as string[];
  }
}

export async function buildCalming(patientId: string, now = new Date()) {
  const t = await buildToday(patientId, now);
  const part = t.partOfDay === "night" ? "evening" : t.partOfDay;
  const clock = t.timeText.replace(/\s?(AM|PM)$/i, "");
  const plan = t.items.filter((i) => i.status !== "done");
  return {
    locationText: `You are at ${t.locationLabel}.`,
    timeText: `It's ${t.dayName} ${part}, ${clock}.`,
    dateText: t.dateText,
    reassurance: "You're safe.",
    plan: plan.map((i) => ({ id: i.id, title: i.title, timeText: i.timeText, status: i.status, personName: i.personName })),
    planText: plan.length
      ? `Later today: ${plan
          .slice(0, 4)
          .map((i) => `${i.title}${i.personName && !i.title.includes(i.personName) ? ` with ${i.personName}` : ""} at ${i.timeText}`)
          .join(", ")}.`
      : "The rest of today is quiet and restful.",
    musicTracks: await listCalmTracks(),
  };
}
