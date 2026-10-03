// Registers every alert contact with Photon (shared lines only text registered
// numbers). New contacts are registered automatically; this backfills old ones.
// Run: pnpm photon:register
import { closeDb, db } from "../src/server/db/client";
import { alertContacts } from "../src/server/db/schema";
import { registerPhotonUser } from "../src/server/notify/photon-users";

async function main() {
  const contacts = await db().select({ name: alertContacts.name, phone: alertContacts.phoneE164 }).from(alertContacts);
  const seen = new Set<string>();
  for (const c of contacts) {
    if (seen.has(c.phone)) continue;
    seen.add(c.phone);
    const r = await registerPhotonUser(c.phone, c.name);
    console.log(`${c.name.padEnd(20)} …${c.phone.slice(-4)}  ${r}`);
  }
  if (!contacts.length) console.log("No alert contacts yet.");
}

main()
  .catch((err) => {
    console.error((err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
