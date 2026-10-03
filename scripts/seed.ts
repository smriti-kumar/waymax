// Demo data loader. Filled out in T18.
import { closeDb } from "../src/server/db/client";
import { seedDemo } from "../src/server/seed/demo";

seedDemo()
  .then((summary) => console.log(summary))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
