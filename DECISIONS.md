# Decisions

Every assumption, install and deviation made during the autonomous build. Format: date · task · decision — reason.

## Installs (PLAN rule 15)

- 2026-10-02 · T0 · Activated **pnpm 11.28.2** via corepack — pnpm 12.8.1 (`latest`) fails to load under this machine's corepack (missing `bin/pnpm.cjs`). 11.x is the newest line that works. Pinned in `package.json#packageManager`.
- 2026-10-02 · T0 · Pulled Docker image `timescale/timescaledb:latest-pg17` and created container `waymax-db` — PLAN T0 first choice. **Abandoned**: the disk filled up during setup, Docker Desktop's containerd store got I/O errors and the daemon would not come back after a restart.
- 2026-10-02 · T0 · Fallback per PLAN T0: Homebrew `postgresql@17` (17.11) + `timescale/tap/timescaledb` (2.30.2), `brew trust timescale/tap`, `timescaledb_move.sh` (it installs into `postgresql@17`), `timescaledb-tune --quiet --yes`, `brew services start postgresql@17`. The timescaledb formula also pulled `postgresql@18`, `timescaledb-tools`, `cmake`, and upgraded `openssl@3`, `readline`, `xz` as its dependencies (brew did this automatically). Brew's parallel dependency install deadlocked on an `openssl@3` lock, so deps were installed one at a time and timescaledb with `--ignore-dependencies`.
- 2026-10-02 · T0 · Local role `waymax` / password `waymax` (superuser, local only), databases `waymax_dev` and `waymax_test`.
- 2026-10-02 · T0 · Playwright Chromium headless shell (`pnpm exec playwright install chromium`).

## Package versions (pinned exact)

Runtime: next 16.3.8, react 19.2.8, react-dom 19.2.8, zod 4.6.5, swr 2.5.1, drizzle-orm 0.45.3, postgres 3.4.9, bcryptjs 3.0.3, @vladmandic/human 3.3.6, @google/genai 2.26.0, spectrum-ts 12.10.1, leaflet 1.9.4, react-leaflet 5.0.0, recharts 3.10.1, date-fns 4.4.0, date-fns-tz 3.2.0, server-only.
Dev: drizzle-kit 0.31.11, vitest 5.0.3, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, jsdom 30.1.1, @playwright/test 1.63.0, msw 3.0.1, prettier 3.9.9, tsx 4.23.15, @vitejs/plugin-react 6.1.1, dotenv 18.0.5, @types/leaflet, tailwindcss 4.3.3, typescript 5.9.3, eslint 9 + eslint-config-next 16.3.8.

## Extra dependencies outside PLAN §3

- 2026-10-02 · T0 · `server-only` — marks server modules so they can never be bundled into the browser (enforces the §7 import rule).
- 2026-10-02 · T0 · `tsx` — runs the TypeScript scripts in `scripts/` (seed, reset, worker, verify).
- 2026-10-02 · T0 · `dotenv` — loads `.env.local` in the Vitest setup file.
- 2026-10-02 · T0 · `jsdom`, `@testing-library/dom`, `@testing-library/jest-dom`, `@vitejs/plugin-react` — needed for React component tests in Vitest.

## Build decisions

- 2026-10-02 · T0 · Next.js 16 renamed `middleware.ts` to `proxy.ts`; the caregiver redirect (PLAN T2) lives in `src/proxy.ts`.
- 2026-10-02 · T0 · `pnpm typecheck` runs `next typegen && tsc --noEmit` — Next 16 generates `LayoutProps`/`PageProps` route types that `tsc` needs.
- 2026-10-02 · T0 · Scripts run via `tsx --conditions=react-server --env-file-if-exists=.env.local` so `server-only` modules load outside Next and `.env.local` is read without extra code.
- 2026-10-02 · T0 · Vitest runs test files sequentially (`fileParallelism: false`) because integration suites share `waymax_test`. The setup file forces `AI_MOCK=true`, `NOTIFY_MODE=in_app` and points `DATABASE_URL` at `TEST_DATABASE_URL`.
- 2026-10-02 · T0 · `env()` is parsed lazily on first use (not at import) so `next build` doesn't need runtime secrets; it still throws a clear error on first request when `DATABASE_URL`/`SESSION_SECRET` are missing.
- 2026-10-02 · T0 · `/api/health` returns `{ok, db, gemini, tts, notify, demoMode}`; status 200 when the DB answers, 503 when it doesn't.
- 2026-10-02 · T0 · Only the four Human models Waymax uses (blazeface, facemesh, iris, faceres; ~6 MB) are copied to `public/models/human/`; the folder is gitignored and recreated by `postinstall`.
- 2026-10-02 · T0 · System font stack instead of `next/font/google` so builds never need network access to Google Fonts.
- 2026-10-02 · T0 · pnpm 11 blocks dependency build scripts by default; `pnpm-workspace.yaml#allowBuilds` allows `esbuild`, `sharp`, `unrs-resolver` (needed) and denies `protobufjs`, `@google/genai` (no-op/optional scripts).
- 2026-10-02 · T1 · Schema lives in `src/server/db/schema.ts` (PLAN §7 layout), not `src/db/schema.ts` (§4 wording) — §7 is the authoritative repo structure.
- 2026-10-02 · T1 · Migration files are `drizzle/0000_init.sql` and `drizzle/0001_timescale.sql`. Every Timescale statement in 0001 is wrapped in a `DO … EXCEPTION WHEN others THEN RAISE WARNING` block. Drizzle runs migrations in one transaction, so a single failing Timescale call on the free service would otherwise roll back the whole schema; this way plain tables always survive (PLAN §4 "the app must still work") and `pnpm db:migrate` prints the warnings.
- 2026-10-02 · T1 · Locally all Timescale features applied without warnings (3 hypertables, `patient_events_daily` continuous aggregate, policy, compression).
- 2026-10-02 · T1 · Daily confusion buckets use the fixed timezone `America/New_York` (PLAN §4 note).
- 2026-10-02 · T1 · `bytea` is a Drizzle `customType` (drizzle-orm 0.45 has no built-in bytea column).
- 2026-10-02 · T1 · Vitest `globalSetup` drops and re-migrates `waymax_test` once per run; integration files truncate all tables in `beforeEach`. It refuses to touch a non-localhost `TEST_DATABASE_URL`.
- 2026-10-03 · T2 · Session and device tokens are stored as HMAC-SHA256(SESSION_SECRET, token) rather than bare sha256. Same shape and column as PLAN §4, and gives `SESSION_SECRET` a real job (a leaked DB can't be turned into cookies). Changing `SESSION_SECRET` logs everyone out and un-pairs devices — so T20 keeps the generated value when copying to Vercel.
- 2026-10-03 · T2 · Cookies are `Secure` when `NODE_ENV=production` or `NEXT_PUBLIC_APP_URL` is https; plain http on localhost otherwise so `next dev` works.
- 2026-10-03 · T2 · `requirePatientAccess` returns 404 for a non-existent patient and 403 for an existing one the caregiver isn't linked to (matches the §6 "403, 404" columns).
- 2026-10-03 · T2 · Login compares against a dummy bcrypt hash when the email is unknown, so timing and message are the same for both failure cases.
- 2026-10-03 · T2 · `route()` also maps raw Postgres errors as a safety net: unique violation → 409, check/FK violation → 422, bad uuid text → 400.
- 2026-10-03 · T2 · ESLint allows `any` in `tests/**` only.
- 2026-10-03 · T3 · Pairing returns `201` (it creates a device). Invalid, expired and already-used codes share one calm 400 message so the patient screen never explains why.
- 2026-10-03 · T3 · Only `patient_display` and `patient_phone` can be paired from the UI (PLAN §6); other `device_kind` values stay as future seams.
- 2026-10-03 · T3 · Device `capabilities` default to `{camera, microphone, speaker, gps}` flags per kind at pairing time.
- 2026-10-03 · T3 · Co-caregivers join as `member`; only an `owner` can add caregivers. Care-team management lives on the Safety page next to devices.
- 2026-10-03 · T3 · A device is considered "online" when seen in the last 2 minutes.
- 2026-10-03 · T3 · Patient pages (`/patient`, `/phone`) check the `wm_device` cookie server-side and redirect to `/pair` if missing/revoked, or to the other page if the device kind doesn't match.
