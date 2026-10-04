// Creates (or updates) the demo caregiver in Firebase Authentication and links it
// to the demo account in the database. Run: pnpm firebase:demo
import { eq } from "drizzle-orm";
import { getAuth } from "firebase-admin/auth";
import { closeDb, db } from "../src/server/db/client";
import { caregivers } from "../src/server/db/schema";
import { firebaseAdmin } from "../src/server/auth/firebase-admin";
import { DEMO_CAREGIVER_NAME, DEMO_EMAIL, DEMO_PASSWORD } from "../src/server/seed/demo";

async function main() {
  const auth = getAuth(firebaseAdmin());
  let user = await auth.getUserByEmail(DEMO_EMAIL).catch(() => null);
  if (user) {
    user = await auth.updateUser(user.uid, { password: DEMO_PASSWORD, displayName: DEMO_CAREGIVER_NAME, emailVerified: true });
    console.log(`Firebase: updated ${DEMO_EMAIL}`);
  } else {
    user = await auth.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, displayName: DEMO_CAREGIVER_NAME, emailVerified: true });
    console.log(`Firebase: created ${DEMO_EMAIL}`);
  }
  const rows = await db().update(caregivers).set({ firebaseUid: user.uid }).where(eq(caregivers.email, DEMO_EMAIL)).returning({ id: caregivers.id });
  console.log(rows.length ? "Linked to the demo caregiver in the database." : "No demo caregiver in this database yet — run pnpm db:seed first.");
}

main()
  .catch((err) => {
    console.error("firebase:demo failed:", (err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
