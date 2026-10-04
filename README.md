# Waymax

Waymax helps a person with Alzheimer's know **who is in front of them**, **what today holds** and **where they are**, while keeping caregivers informed.

- **Patient laptop** (`/patient`): a calm Today card, in-browser face recognition, "Who is this?" spoken in a warm voice, Listen (conversation memory), "I feel confused" calming mode, repeat-question answers, and narrated Memories.
- **Patient phone** (`/phone`): shares GPS while the page is open; leaving the home area sends an iMessage to caregivers.
- **Caregiver** (`/caregiver`): people and photos, approvals, schedule, questions, conversations, the map with safe areas, alerts and a dashboard.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind, Postgres + TimescaleDB via Drizzle, `@vladmandic/human` for face recognition in the browser, Gemini (transcription, summaries, narration), ElevenLabs (speech), Photon Spectrum (iMessage), optional Firebase Authentication. See `PLAN.md` for the full design and `DECISIONS.md` for every assumption made while building.

Live demo: **https://waymax-livid.vercel.app** (login below).

## Quick start

You need **Node 22+**, **pnpm 11** and **Postgres 17 with TimescaleDB**. No API keys are needed to run it: without them, AI is mocked, speech uses the browser's voice and alerts stay in the app.

### 1. Clone and install

```bash
git clone <this repo> waymax && cd waymax
corepack enable && corepack prepare pnpm@11.28.2 --activate
pnpm install        # also copies the face-recognition models into public/models/human
```

### 2. Start a database

Easiest is Docker:

```bash
docker run -d --name waymax-db -p 5432:5432 \
  -e POSTGRES_USER=waymax -e POSTGRES_PASSWORD=waymax -e POSTGRES_DB=waymax \
  timescale/timescaledb:latest-pg17
```

Without Docker, install `postgresql@17` and `timescale/tap/timescaledb` with Homebrew, follow the caveats `brew` prints for TimescaleDB, then create a `waymax` user and database. Plain Postgres without TimescaleDB also works: migrations skip the Timescale features with a warning and the dashboard uses ordinary SQL.

A free hosted option is [Tiger Data](https://console.cloud.timescale.com) (Free plan, Postgres + TimescaleDB). Copy its Service URL.

### 3. Configure

```bash
cp .env.example .env.local
```

In `.env.local`, set the three required values:

```bash
DATABASE_URL=postgres://waymax:waymax@localhost:5432/waymax   # or your Tiger Service URL
SESSION_SECRET=   # paste the output of: openssl rand -base64 32
WORKER_SECRET=    # paste another: openssl rand -base64 32
```

Then, to start without any API keys, set `AI_MOCK=true` and `NOTIFY_MODE=in_app`. Leave everything else as it is for now; [Optional services](#optional-services) explains each key.

### 4. Create the tables and the demo account

```bash
pnpm db:migrate     # schema + Timescale hypertables and continuous aggregate
pnpm db:seed        # demo caregiver, patient, people, schedule, questions and history
```

### 5. Run it

```bash
pnpm dev            # http://localhost:3000
```

Open <http://localhost:3000>, choose **I'm a caregiver**, and sign in with the demo account. `/api/health` shows which services are live and which are mocked.

## Demo account

- **Caregiver:** BigRed Hacks, **`demo@waymax.app` / `waymax-demo`**
- **Patient:** Margaret Lee ("Maggie"). Her home area is 150 m around the Physical Sciences Building at Cornell.
- **People:** Jiya (daughter), Smriti (daughter), Trishia (neighbor), Urja (home helper). Each has placeholder photos, memories, past visits and conversations.
- 14 days of "I feel confused" presses for the dashboard chart, a weekly schedule and 6 saved questions.

`pnpm db:seed` does nothing if the demo account already exists. Run `pnpm db:seed -- --force` to delete it and build it again.

## Set up the patient's devices

1. **Pair the laptop.** As the caregiver, open **Safety** and choose **Pair patient laptop**. On the patient laptop, open `/pair` in Chrome, type the code, tap **Start**, and allow the camera and microphone.
2. **Pair the phone (optional).** Choose **Pair patient phone**. On the iPhone, open `/pair` in Safari, type the code, allow location, and keep the page open.
3. **Teach it faces.** The placeholder people have no faces yet. For each real person, either:
   - stand in front of the patient laptop. When it says **Someone is here**, tap **Add this person**, then in **Approvals** name them or **merge** them into an existing person; or
   - upload 3 clear, front-facing photos on their person page.

   Faces captured by the patient laptop's own camera match best. If someone keeps showing as "someone new", merge one of their captures into their person, or set the face-match strictness to **Relaxed** on the **People** page.

Camera, microphone and GPS only work on `localhost` or over HTTPS.

## Optional services

Every key goes in `.env.local`. Leave a key empty and that feature falls back quietly. Run `pnpm verify:keys` to check every key you've set; it prints a pass/fail table.

| Service | Used for | Variables | Without it |
| --- | --- | --- | --- |
| [Google AI Studio](https://aistudio.google.com) (Gemini) | transcribing Listen, summaries, memory narration | `GEMINI_API_KEY` (keep the model names in `.env.example`) | mocked text |
| [ElevenLabs](https://elevenlabs.io) | the warm voice | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (use a premade voice on the free plan) | the browser's voice |
| [Photon](https://app.photon.codes) | iMessage alerts to caregivers | `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, `PHOTON_DASHBOARD_TOKEN`, and `NOTIFY_MODE=photon` | alerts show only in the app |
| [Firebase](https://console.firebase.google.com) Authentication | caregiver sign-in | `NEXT_PUBLIC_FIREBASE_*` (web app config) and `FIREBASE_*` (service account) | built-in email + password |
| Google Maps | the safety map | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | OpenStreetMap |

Once real keys are in, set `AI_MOCK=false`.

**Photon setup:**
1. Create a project, enable Spectrum (iMessage), and wait until a line is assigned. Copy the project ID and secret from **Settings**.
2. Run `npx @photon-ai/cli login`, then copy the token from `~/.config/photon/credentials/production.json` into `PHOTON_DASHBOARD_TOKEN`. Waymax uses this token to register each alert number with Photon automatically.
3. In the app, go to **Safety → Alert contacts** and add a number. A QR code appears. Scan it with that iPhone and tap **Send** in Messages. That one text turns on alerts for the number, and **Show QR** brings the code back later.
4. **Send test message** checks that alerts reach the phone.

**Firebase setup:** after filling in the Firebase variables, run `pnpm firebase:demo` once. It creates the demo caregiver in Firebase and links it to the database.

**Calming music (optional):** put 3–4 calm, royalty-free tracks named `calm-1.mp3`, `calm-2.mp3`, … in `public/audio/calm/`. Without them, calming mode plays a soft generated tone.

## Try it

1. **Today card.** The patient laptop shows the greeting, the time, *You're at Home*, today's visitors and the next event ("Next: Lunch with Jiya, 12:30").
2. **Who is this?** An enrolled person steps in front of the laptop. Their card appears with a recap ("Last visit: …" plus something from their last conversation). Tap **Who is this?** to hear it.
3. **Listen.** Tap **Listen**, have the visitor say "Hi Mom, it's Jiya…", then tap **Stop**. The caregiver's **Conversations** page shows the transcript, a summary and whether the voice matched the face. Audio is never stored.
4. **Someone new.** An unenrolled person steps in, and the laptop offers **Add this person**. They show up in the caregiver's **Approvals** queue.
5. **I feel confused.** It says where Maggie is and what's next, then offers music or a memories slideshow. The press shows up on the caregiver dashboard chart.
6. **Wandering.** On **Safety**, **Simulate walk out** flips the status to "Outside Home" and sends alerts; **Simulate walk home** sends "back at Home".
7. **Questions.** **Questions → "Where is Jiya?"** gives the same calm answer every time.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | runs the app at <http://localhost:3000> |
| `pnpm db:migrate` | creates or updates the database tables |
| `pnpm db:seed` | loads the demo account (`-- --force` rebuilds it) |
| `pnpm db:reset` | drops and re-migrates. **Local databases only**: it refuses in production or on a remote URL |
| `pnpm verify:keys` | checks the database, Gemini, ElevenLabs and Photon keys |
| `pnpm tts:prewarm` | caches the demo's spoken phrases in ElevenLabs (about 2,000 characters) |
| `pnpm photon:register` | registers every existing alert number with Photon |
| `pnpm firebase:demo` | creates or updates the demo caregiver in Firebase |
| `pnpm worker` | retries pending iMessage alerts every 30 s (`APP_URL=https://… pnpm worker`) |
| `pnpm check` | lint + typecheck + tests |
| `pnpm test:e2e` | Playwright end-to-end tests with a fake camera, mic and GPS |

**Tests:** the database tests need a separate local database in `TEST_DATABASE_URL` (e.g. `postgres://waymax:waymax@localhost:5432/waymax_test`); they're skipped if it's empty. End-to-end tests use their own `waymax_e2e` database (`E2E_DATABASE_URL`). With Docker, create both with `docker exec waymax-db createdb -U waymax waymax_test` and `… waymax_e2e`.

**Dashboard chart shows zeros after a reseed?** The chart reads a TimescaleDB continuous aggregate, which may not pick up history inserted with past dates. Refresh it once:

```bash
psql "$DATABASE_URL" -c "CALL refresh_continuous_aggregate('patient_events_daily', NULL, NULL)"
```

## Deploy (Vercel)

1. `pnpm add -g vercel`, then `vercel login` and `vercel link --yes`.
2. Add every variable from `.env.local` to Vercel for Production and Preview, except `TEST_DATABASE_URL` and `E2E_DATABASE_URL`. Use a hosted database such as Tiger for `DATABASE_URL`.
3. From your laptop, pointed at that hosted database, run `pnpm db:migrate && pnpm db:seed` (and `pnpm tts:prewarm` if ElevenLabs is set up). Never run these in the Vercel build.
4. Run `vercel --prod`, set `NEXT_PUBLIC_APP_URL` to the production URL, and deploy again.

## Privacy

Face recognition runs in the patient's browser; only the match result goes to the server. Nothing is recorded until someone taps **Listen**, and only the transcript and summary are kept.
