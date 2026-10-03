# Waymax

Waymax helps a person with Alzheimer's know **who is in front of them**, **what today holds** and **where they are**, while keeping caregivers informed.

- **Patient laptop** (`/patient`): a calm Today card, in-browser face recognition, "Who is this?" spoken in a warm voice, Listen (conversation memory), "I feel confused" calming mode, repeat-question answers, and narrated Memories.
- **Patient phone** (`/phone`): shares GPS while the page is open; leaving the home area sends an iMessage to caregivers.
- **Caregiver** (`/caregiver`): people and photos, approvals, schedule, questions, conversations, the map with safe areas, alerts and a dashboard.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind on Vercel, Tiger Data (Postgres + TimescaleDB) via Drizzle, `@vladmandic/human` in the browser, Gemini (transcription, summaries, narration), ElevenLabs (speech), Photon Spectrum (iMessage). See `PLAN.md` for the full design and `DECISIONS.md` for every assumption made while building.

## Run it locally

Requirements: Node 22, pnpm 11 (`corepack enable && corepack prepare pnpm@11.28.2 --activate`), and Postgres 17 with TimescaleDB (Homebrew `postgresql@17` + `timescale/tap/timescaledb`, or Docker `timescale/timescaledb:latest-pg17`).

```bash
pnpm install              # also copies the face models into public/models/human
cp .env.example .env.local  # then fill in DATABASE_URL, SESSION_SECRET, WORKER_SECRET (openssl rand -base64 32)
pnpm db:migrate           # schema + Timescale hypertables / continuous aggregate
pnpm db:seed              # demo account (add `-- --force` to rebuild it)
pnpm dev                  # http://localhost:3000
```

Caregiver sign-in uses Firebase Authentication when the `NEXT_PUBLIC_FIREBASE_*` web config and the `FIREBASE_*` service account are set; otherwise it falls back to built-in email + password. With no API keys (or `AI_MOCK=true`) everything still works: Gemini is mocked, speech uses the browser voice, and alerts are in-app only. `/api/health` shows which providers are live.

| Command | What it does |
| --- | --- |
| `pnpm check` | lint + typecheck + unit/integration tests (needs `TEST_DATABASE_URL`, a local database) |
| `pnpm test:e2e` | Playwright end-to-end tests (fake camera, mic and GPS; mock face engine; own `waymax_e2e` database) |
| `pnpm db:reset` | drop and re-migrate — **local databases only**; refuses in production or on a remote URL |
| `pnpm tts:prewarm` | caches the demo's spoken phrases in ElevenLabs (~25 phrases, ~1,000 characters) |
| `pnpm verify:keys` | checks the database, Gemini, ElevenLabs and Photon keys and prints a pass/fail table |
| `pnpm worker` | optional: retries pending iMessage alerts every 30 s (`APP_URL=https://… pnpm worker`) |

## Demo login

- Caregiver: **`demo@waymax.app` / `waymax-demo`** (a Firebase Authentication account, project `waymax-ae1c3`; recreate it with `pnpm firebase:demo`)
- Patient: Margaret Lee ("Maggie"), home area 150 m around Ithaca Commons
- People: Priya (daughter), Raj (son), Sam (neighbor), Nora (home helper) — with placeholder photos. **Before the demo, add 3 real face photos of each teammate** on their person page (or rename a seeded person to a teammate and replace the photos), so the laptop recognizes real faces.

Optional: put 3–4 calm royalty-free tracks named `calm-1.mp3`, `calm-2.mp3`, … in `public/audio/calm/` (otherwise calming mode plays a gentle generated pad).

## Before going on stage (one time)

1. Caregiver laptop/phone: sign in as the demo caregiver → **Safety** → *Pair patient laptop* and *Pair patient phone*.
2. Patient laptop (Chrome): open `/pair`, type the laptop code, tap **Start** (allow camera and microphone).
3. Patient iPhone (Safari): open `/pair`, type the phone code, allow location, keep the page open.
4. **Safety → Alert contacts**: add the judge-facing iPhone and press **Send test iMessage**. Each alert iPhone must first text "hi" to the Photon line once.
5. Make sure each teammate in the demo shows "3 face samples ✓".

## 3-minute demo script (click order)

1. **(0:00) The problem, the Today card.** Show the patient laptop: "Good afternoon, Maggie. It's Saturday afternoon," the time, *You're at Home*, today's visitors and the "Next: Lunch with Priya, 12:30" banner. Calm, large, no scrolling.
2. **(0:25) Who is this?** A teammate walks up to the laptop. Within ~2 s their card slides in: photo, name, "your daughter" and a recap ("Last visit: Thursday. Priya's puppy Max chewed her shoe."). Tap **Who is this?** — it speaks in the ElevenLabs voice.
3. **(0:55) Listen.** Tap **Listen** (the "Recording" pill pulses). Teammate says "Hi Mom, it's Priya, we're going to the farmers market tomorrow." Tap **Stop** → "Saved." On the caregiver tab, **Conversations** shows a warm summary written by Gemini, and "Voice confirmed: Priya ✓". (Audio is never stored.)
4. **(1:25) Someone new.** A second teammate who isn't enrolled steps in: "Someone is here." Tap **Add this person**. On the caregiver tab, **Approvals** (badge "1") shows their face; type a name and relationship → **Approve**. They step back in → their card appears.
5. **(1:55) I feel confused.** On the patient laptop tap **I feel confused**: "You are at Home. It's Saturday afternoon, 3:10. You're safe." → the rest of today → **Play soothing music** (or **Look at memories** → a narrated slideshow). The caregiver **Overview** chart ticks up by one; the bars come from a TimescaleDB continuous aggregate.
6. **(2:20) Wandering.** On the caregiver **Safety** page press **Simulate walk out** (or walk out the door with the paired iPhone). The tile flips to "Outside Home", the alert appears, and an **iMessage arrives on the judge's iPhone** via Photon. **Simulate walk home** sends "back at Home".
7. **(2:45) Questions + close.** Patient taps **Questions → "Where is Priya?"**: the same calm answer, shown and spoken, every time. Close on the dashboard.

## Deploy (Vercel)

`pnpm add -g vercel`, `vercel login`, `vercel link --yes`, add every variable from `.env.example` (except `TEST_DATABASE_URL`) to Production and Preview, then `vercel --prod`. Run `pnpm db:migrate && pnpm db:seed && pnpm tts:prewarm` from the laptop against the Tiger `DATABASE_URL` (never in the Vercel build). Set `NEXT_PUBLIC_APP_URL` to the production URL and redeploy.

Live URL: **https://waymax-livid.vercel.app** (demo login above).

## Privacy notes

Face recognition runs in the patient's browser; only the match result goes to the server. Nothing is recorded until someone taps **Listen**, and only the transcript and summary are kept.
