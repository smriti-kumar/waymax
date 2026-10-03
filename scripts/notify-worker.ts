// Optional safety net on the team Mac: retries pending Photon alerts every 30 s.
//   APP_URL=https://<project>.vercel.app pnpm worker
const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.WORKER_SECRET;
const everyMs = Number(process.env.WORKER_INTERVAL_MS || 30_000);

if (!secret) {
  console.error("WORKER_SECRET is not set");
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(`${appUrl}/api/internal/notifications/retry`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) console.warn(`[worker] ${res.status}`, body?.error?.message ?? "");
    else if (body.retried) console.log(`[worker] retried ${body.retried}: sent ${body.sent}, failed ${body.failed}`);
  } catch (err) {
    console.warn("[worker] app unreachable:", (err as Error).message);
  }
}

console.log(`[worker] polling ${appUrl} every ${everyMs / 1000}s`);
void tick();
setInterval(tick, everyMs);
