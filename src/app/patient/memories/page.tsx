import { deviceOrRedirect } from "@/server/auth/device-current";
import { MemoriesPicker } from "@/components/patient/MemoriesPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Memories · Waymax" };

export default async function MemoriesPage() {
  await deviceOrRedirect("patient_display");
  return <MemoriesPicker />;
}
