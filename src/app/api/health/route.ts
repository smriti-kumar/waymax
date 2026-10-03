import { NextResponse } from "next/server";
import { sqlClient } from "@/server/db/client";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const e = env();
  let db: "up" | "down" = "down";
  try {
    await sqlClient()`select 1`;
    db = "up";
  } catch (err) {
    console.error("[health] database check failed", (err as Error).message);
  }
  return NextResponse.json(
    {
      ok: db === "up",
      db,
      gemini: e.geminiMode,
      tts: e.ttsMode,
      notify: e.notifyMode,
      demoMode: e.NEXT_PUBLIC_DEMO_MODE,
    },
    { status: db === "up" ? 200 : 503 },
  );
}
