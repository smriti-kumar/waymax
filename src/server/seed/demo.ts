import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  alertContacts,
  caregivers,
  conversations,
  patientCaregivers,
  patientEvents,
  patients,
  people,
  personDates,
  personMemories,
  questions,
  scheduleItems,
  visits,
} from "@/server/db/schema";
import { hashPassword } from "@/server/auth/passwords";
import { recordPing, setHomeFence } from "@/server/services/geofence";
import { storage } from "@/server/storage";
import { env } from "@/server/env";
import { dayBounds, localDate } from "@/lib/schedule";
import { placeholderPhoto, placeholderScene } from "./images";

export const DEMO_EMAIL = "demo@waymax.app";
export const DEMO_PASSWORD = "waymax-demo";
/** Central Ithaca, NY (Ithaca Commons). */
export const DEMO_HOME = { lat: 42.4396, lng: -76.4969, radiusM: 150 };
const TZ = "America/New_York";

const PEOPLE = [
  {
    key: "priya",
    name: "Priya",
    relationship: "daughter",
    spokenName: "PREE-yah",
    description: "Your daughter. She's a teacher and lives across town with her husband Dev.",
    visitRoutine: "Comes for lunch most days",
    color: "#2f6f73",
    memories: [
      { title: "Priya's graduation", body: "You cried happy tears when she walked across the stage.", occurredOn: "2012-05-26", scene: "#7fb3a7" },
      { title: "Beach day at Cape May", body: "Priya built a sandcastle with a moat, and you found a perfect shell.", occurredOn: "1994-07-10", scene: "#e9c46a" },
      { title: "Max the puppy", body: "Priya's new golden retriever puppy. He loves your garden.", occurredOn: null, scene: "#d4a373" },
    ],
  },
  {
    key: "raj",
    name: "Raj",
    relationship: "son",
    spokenName: null,
    description: "Your son. He works as an engineer in Rochester and calls every evening.",
    visitRoutine: "Visits Wednesdays for tea and calls every evening at 7",
    color: "#b8731a",
    memories: [
      { title: "Fishing on Cayuga Lake", body: "Raj caught his first fish and wanted to name it.", occurredOn: "1990-08-18", scene: "#6a9fb5" },
      { title: "Raj's wedding", body: "You danced with Raj to your favourite song.", occurredOn: "2015-09-12", scene: "#c9a0dc" },
    ],
  },
  {
    key: "sam",
    name: "Sam",
    relationship: "neighbor",
    spokenName: null,
    description: "Your neighbour from next door. He helps with the garden.",
    visitRoutine: "Pops by on Saturday mornings",
    color: "#4f7a3a",
    memories: [{ title: "The tomato harvest", body: "Sam and you grew the biggest tomatoes on the street.", occurredOn: "2023-08-30", scene: "#e76f51" }],
  },
  {
    key: "nora",
    name: "Nora",
    relationship: "home helper",
    spokenName: null,
    description: "Nora helps at home on weekday mornings.",
    visitRoutine: "Weekday mornings from 9 to 12",
    color: "#6d597a",
    memories: [{ title: "Baking banana bread", body: "Nora and you baked banana bread with walnuts.", occurredOn: "2025-11-02", scene: "#f4a261" }],
  },
] as const;

const QUESTIONS = [
  ["Where is Priya?", "Priya is at school, teaching. She'll come for lunch at 12:30."],
  ["When is Raj coming?", "Raj calls you every evening at 7 o'clock, and he visits on Wednesday for tea."],
  ["What day is it today?", "Look at the big clock on this screen. It shows the day and the time."],
  ["Where am I?", "You are at home, in your own house in Ithaca. You're safe."],
  ["Have I eaten lunch?", "Lunch is at 12:30 with Priya. If it's later than that, you've had it. If you're hungry, Nora left fruit in the kitchen."],
  ["Where are my glasses?", "Your glasses are usually on the table next to your armchair."],
] as const;

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Deterministic pseudo-random numbers so every seed looks the same. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local wall-clock time `hh:mm` on the day `daysAgo` before today, in the demo timezone. */
function localAt(daysAgo: number, hh: number, mm: number, now: Date) {
  const today = localDate(now, TZ);
  const [y, m, d] = today.split("-").map(Number);
  const ymd = new Date(Date.UTC(y!, m! - 1, d! - daysAgo)).toISOString().slice(0, 10);
  return new Date(dayBounds(ymd, TZ).start.getTime() + (hh * 60 + mm) * 60_000);
}

/**
 * Loads the demo account. Idempotent: does nothing if the demo caregiver exists,
 * unless `force` is set, which deletes only the demo caregiver's patients first.
 */
export async function seedDemo({ force = false, now = new Date() } = {}): Promise<string> {
  const [existing] = await db().select().from(caregivers).where(eq(caregivers.email, DEMO_EMAIL));
  if (existing && !force) return `Demo data already present (${DEMO_EMAIL}). Use --force to rebuild it.`;
  if (existing) {
    const links = await db().select({ pid: patientCaregivers.patientId }).from(patientCaregivers).where(eq(patientCaregivers.caregiverId, existing.id));
    if (links.length) await db().delete(patients).where(inArray(patients.id, links.map((l) => l.pid)));
    await db().delete(caregivers).where(eq(caregivers.id, existing.id));
  }

  const [cg] = await db()
    .insert(caregivers)
    .values({ email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD), name: "Alex Demo", phoneE164: env().DEMO_ALERT_PHONE ?? null })
    .returning();
  const [p] = await db()
    .insert(patients)
    .values({ name: "Margaret Lee", preferredName: "Maggie", timezone: TZ, homeLabel: "Home" })
    .returning();
  await db().insert(patientCaregivers).values({ patientId: p.id, caregiverId: cg.id, role: "owner" });
  await setHomeFence(p.id, { lat: DEMO_HOME.lat, lng: DEMO_HOME.lng, radiusM: DEMO_HOME.radiusM, label: "Home" });

  // Start "Inside Home" so the dashboard tile and map have a dot before the phone is paired.
  await recordPing(p.id, null, { lat: DEMO_HOME.lat, lng: DEMO_HOME.lng, accuracyM: 12, source: "simulated" }, now);

  const demoPhone = env().DEMO_ALERT_PHONE;
  if (demoPhone && /^\+[1-9][0-9]{7,14}$/.test(demoPhone)) {
    await db().insert(alertContacts).values({ patientId: p.id, name: "Demo phone", phoneE164: demoPhone, notifyGeofence: true });
  }

  // People, placeholder photos and memories.
  const ids: Record<string, string> = {};
  for (const person of PEOPLE) {
    const photo = await storage().put({ patientId: p.id, mime: "image/png", bytes: await placeholderPhoto(person.name, person.color) });
    const [row] = await db()
      .insert(people)
      .values({
        patientId: p.id,
        status: "approved",
        name: person.name,
        relationship: person.relationship,
        spokenName: person.spokenName,
        description: person.description,
        visitRoutine: person.visitRoutine,
        primaryPhotoId: photo.id,
        createdVia: "seed",
        approvedBy: cg.id,
        approvedAt: now,
      })
      .returning();
    ids[person.key] = row.id;
    for (const m of person.memories) {
      const scene = await storage().put({ patientId: p.id, mime: "image/png", bytes: await placeholderScene(m.title, m.scene) });
      await db().insert(personMemories).values({ personId: row.id, kind: "photo", title: m.title, body: m.body, occurredOn: m.occurredOn, mediaId: scene.id });
    }
  }

  // Important dates.
  await db().insert(personDates).values([
    { personId: ids.priya!, kind: "birthday", month: 5, day: 14, year: 1988 },
    { personId: ids.raj!, kind: "birthday", month: 11, day: 2, year: 1985 },
    { personId: ids.raj!, kind: "anniversary", label: "Raj and Anita's wedding anniversary", month: 9, day: 12, year: 2015 },
  ]);

  // Weekly schedule.
  const weekly = (title: string, kind: "visit" | "activity" | "therapy" | "meal" | "other", days: readonly number[], time: string, durationMin = 60, personId: string | null = null) => ({
    patientId: p.id,
    kind,
    title,
    personId,
    daysOfWeek: [...days],
    startTime: time,
    durationMin,
  });
  await db().insert(scheduleItems).values([
    weekly("Breakfast", "meal", EVERY_DAY, "08:00", 30),
    weekly("Nora is here", "visit", [1, 2, 3, 4, 5], "09:00", 180, ids.nora),
    weekly("Morning walk", "activity", [1, 3, 5], "10:30", 45),
    weekly("Lunch", "visit", EVERY_DAY, "12:30", 60, ids.priya),
    weekly("Physio exercises", "therapy", [2, 4], "15:00", 45),
    weekly("Tea", "visit", [3], "16:00", 60, ids.raj),
    weekly("Garden time", "activity", [6], "10:00", 60, ids.sam),
    weekly("Dinner", "meal", EVERY_DAY, "18:00", 45),
    weekly("Phone call", "other", EVERY_DAY, "19:00", 20, ids.raj),
  ]);

  await db()
    .insert(questions)
    .values(QUESTIONS.map(([question, answer], i) => ({ patientId: p.id, question, answer, sortOrder: i })));

  // A little history so recaps say "Last visit: …" and carry a fact.
  const pastVisits = [
    { key: "priya", daysAgo: 1, hh: 12, mm: 35, mins: 55 },
    { key: "priya", daysAgo: 3, hh: 12, mm: 40, mins: 50 },
    { key: "raj", daysAgo: 5, hh: 16, mm: 5, mins: 70 },
    { key: "sam", daysAgo: 2, hh: 10, mm: 10, mins: 25 },
  ];
  for (const v of pastVisits) {
    const start = localAt(v.daysAgo, v.hh, v.mm, now);
    const end = new Date(start.getTime() + v.mins * 60_000);
    const [visit] = await db()
      .insert(visits)
      .values({ patientId: p.id, personId: ids[v.key]!, startedAt: start, lastSeenAt: end, endedAt: end })
      .returning();
    if (v.key === "priya" && v.daysAgo === 1) {
      await db().insert(conversations).values({
        patientId: p.id,
        visitId: visit.id,
        personId: ids.priya,
        status: "done",
        transcript: "A: Hi Mom, it's Priya.\nB: Oh, hello dear.\nA: Max chewed my shoe again! He's getting so big.\nB: That puppy!\nA: We're going to the farmers market on Saturday.",
        summary: "You had lunch with Priya. She told you her puppy Max chewed her shoe, and she's going to the farmers market on Saturday.",
        keyFacts: ["Priya's puppy Max chewed her shoe", "Priya is going to the farmers market on Saturday"],
        speakerClaim: { claimedName: "Priya", matchesFace: true, matchedPersonId: ids.priya, faceName: "Priya" },
        startedAt: start,
        endedAt: end,
      });
    }
  }

  // 14 days of "I feel confused" presses, highest in late afternoon.
  const r = rng(20261002);
  const events: (typeof patientEvents.$inferInsert)[] = [];
  for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
    const n = Math.round(1 + r() * 3 + (daysAgo % 7 === 2 ? 2 : 0));
    for (let i = 0; i < n; i++) {
      const late = r() < 0.7;
      const hh = late ? 15 + Math.floor(r() * 4) : 9 + Math.floor(r() * 5);
      events.push({ patientId: p.id, kind: "confused_pressed", payload: { seeded: true }, occurredAt: localAt(daysAgo, hh, Math.floor(r() * 60), now) });
      if (r() < 0.5) {
        events.push({
          patientId: p.id,
          kind: r() < 0.6 ? "calming_music" : "calming_memories",
          payload: { seeded: true },
          occurredAt: localAt(daysAgo, hh, 59, now),
        });
      }
    }
  }
  await db().insert(patientEvents).values(events);

  return [
    `Seeded demo account ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
    `Patient: Margaret Lee ("Maggie"), home fence ${DEMO_HOME.radiusM} m at Ithaca Commons`,
    `People: ${PEOPLE.map((x) => `${x.name} (${x.relationship})`).join(", ")} — add real face photos on each person's page`,
    `${QUESTIONS.length} questions, weekly schedule, ${pastVisits.length} past visits, ${events.filter((e) => e.kind === "confused_pressed").length} confusion presses over 14 days`,
    demoPhone ? `Alert contact: ${demoPhone}` : "No DEMO_ALERT_PHONE set: no alert contact created",
  ].join("\n");
}

export const DEMO_SEED_PEOPLE = PEOPLE;
export const DEMO_SEED_QUESTIONS = QUESTIONS;
