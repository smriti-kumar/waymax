# What I need from you to go live (T20)

Everything is built and tested on mocks and a local database. These are the only things left that need you: **5 accounts, 5 keys, 1 voice ID, and one terminal login.** None of them needs a credit card. If any page asks for one, skip it.

Paste every value into **`.env.local`** in the repo root (it's already there, gitignored, and has the empty lines waiting). Don't change the values I generated (`SESSION_SECRET`, `WORKER_SECRET`, the local URLs). When you're done, tell me "keys are in .env.local". I'll verify each one with `pnpm verify:keys` and only ask again about keys that fail.

---

## 1. Tiger Data: main database (`DATABASE_URL`)

- **Why:** the live app's Postgres + TimescaleDB (hypertables and the continuous aggregate behind the confusion chart).
- **Click path:** <https://console.cloud.timescale.com> → sign up → **Create service** → choose the **Free** plan (any region near you, e.g. AWS us-east-1) → wait until it says *Running* → **Connection info** (or the "Connect" button) → copy the **Service URL** that starts with `postgres://tsdbadmin:…`. Save the password shown once.
- **Paste as:** `DATABASE_URL=postgres://tsdbadmin:<password>@<host>:<port>/tsdb?sslmode=require`
  (Replace the current local `DATABASE_URL` line. Keep `TEST_DATABASE_URL` and `E2E_DATABASE_URL` on localhost.)
- **Cost:** free (750 MB). ⚠️ **Never** click "Start trial", "Upgrade" or "Convert to standard". The free service just goes read-only if it fills up.

## 2. Google AI Studio: Gemini (`GEMINI_API_KEY`)

- **Why:** transcribes Listen recordings, writes visit summaries and memory narration.
- **Click path:** <https://aistudio.google.com> → sign in → **Get API key** → **Create API key** → *Create API key in new project* → copy it.
- **Also check:** open <https://aistudio.google.com/rate-limit> and confirm `gemini-3-flash-preview` and `gemini-3.1-flash-lite` are listed for the free tier. If either name differs, tell me what you see, or leave it: `pnpm verify:keys` lists the available models and I'll pick the closest free Flash model and tell you which line to change.
- **Paste as:** `GEMINI_API_KEY=…` (keep `GEMINI_MODEL=gemini-3-flash-preview` and `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite` unless told otherwise)
- **Cost:** free tier. ⚠️ **Don't enable billing** on the Google Cloud project. Free-tier prompts may be used by Google to improve models (fine for demo data). Avoid any 2.5 model; those shut down on 16 Oct 2026.

## 3. ElevenLabs: the voice (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`)

- **Why:** "Who is this?", question answers, calming words and memory narration in a warm voice. (Without a key, the browser's built-in voice is used.)
- **Key:** <https://elevenlabs.io> → sign up (Free) → bottom-left profile → **API Keys** → **Create API key**. Give it **Text to Speech** access (and Voices read). Copy it.
- **Voice ID:** **Voices** → **Voice Library** → pick one calm, warm voice (e.g. search "calm" or "warm narrator") → **Add to my voices** → in **My Voices** open it → copy its **Voice ID** (about 20 characters).
- **Paste as:** `ELEVENLABS_API_KEY=…` and `ELEVENLABS_VOICE_ID=…` (keep `ELEVENLABS_MODEL_ID=eleven_flash_v2_5`)
- **Cost:** free plan, 10,000 credits a month (about 20,000 characters with Flash). The demo pre-caches about 1,000 characters once, and the app stops calling ElevenLabs at 18,000 characters a month (`TTS_MONTHLY_CHAR_BUDGET`). The free plan asks for attribution ("Voice by ElevenLabs"). If you ever upgrade, Starter is about $5/month; you don't need it.

## 4. Photon: iMessage alerts (`SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`)

- **Why:** when Maggie leaves home, each alert iPhone gets an iMessage. (Without it, alerts are in-app only.)
- **Click path:** <https://app.photon.codes> → sign up → **Create project** → enable **Spectrum** / iMessage → wait until an **iMessage line is assigned** (shown on the project) → **Settings** → copy **Project ID** and **Project Secret**.
- **Paste as:** `SPECTRUM_PROJECT_ID=…` and `SPECTRUM_PROJECT_SECRET=…` (leave `SPECTRUM_WEBHOOK_SECRET` empty)
- **One-time step on every alert iPhone:** after adding the number under **Safety → Alert contacts**, scan the QR code shown with that iPhone and tap **Send** in Messages. (Needs `PHOTON_DASHBOARD_TOKEN` so Waymax can create the Photon user.)
- **Cost:** free shared line pool. If it asks for billing, use promo code **HACKWITHPHOTON**.

## 5. Optional: demo alert phone (`DEMO_ALERT_PHONE`)

- **Why:** the seed creates an alert contact with this number, and I send it one test iMessage at go-live.
- **Paste as:** `DEMO_ALERT_PHONE=+1XXXXXXXXXX` (international format, the iPhone that texted "hi" above).

## 6. Vercel: hosting (one command from you)

- **Why:** a free HTTPS URL. Camera, microphone and GPS only work over HTTPS.
- **Do this:** sign up at <https://vercel.com/signup> with GitHub (Hobby plan). Then in this terminal run:

  ```
  ! vercel login
  ```

  I installed the Vercel CLI (62.2.0) for you already. After you log in, I link the project, copy the env vars and deploy myself.
- **Cost:** free (Hobby, non-commercial).

## 7. Optional: calming music

Drop 3–4 calm, royalty-free tracks named `calm-1.mp3`, `calm-2.mp3`, … into `public/audio/calm/`. Without them, calming mode plays a soft generated pad, which works fine.

## 8. Things that needed sudo or a password

None. Everything was installed at user level. One note: Homebrew suggested updating the Xcode Command Line Tools (`sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install`). That's **not needed** for Waymax; it's only a Homebrew suggestion.

Also: Docker Desktop's storage got I/O errors when the disk filled up early in the build, so I switched to Homebrew Postgres. You may want to restart Docker Desktop or run "Clean / Purge data" in it, but Waymax doesn't need Docker.

---

## After you say "done", I will

1. `pnpm verify:keys`: DB connects and has TimescaleDB; Gemini lists models and answers one line; ElevenLabs speaks five words; Photon initializes **without** sending. I'll show you a pass/fail table and re-ask only for failures.
2. Set `AI_MOCK=false`, and `NOTIFY_MODE=photon` if Photon passed.
3. Against Tiger: `pnpm db:migrate && pnpm db:seed && pnpm tts:prewarm`. If `DEMO_ALERT_PHONE` is set, send one test iMessage.
4. Run the live smoke checks locally, then `vercel link`, copy the env vars to Vercel, `vercel --prod`, set `NEXT_PUBLIC_APP_URL` to the live URL, redeploy, and smoke-test the live URL.
5. Then you do the steps that need a human (about 5 minutes): pair the laptop in Chrome at `/pair`, pair the iPhone in Safari at `/pair`, upload 3 face photos per teammate, and walk in front of the camera.
