import { deviceOrRedirect } from "@/server/auth/device-current";

export const dynamic = "force-dynamic";

export default async function PatientPage() {
  const { patient } = await deviceOrRedirect("patient_display");
  return (
    <main className="flex flex-1 items-center justify-center bg-cream p-10">
      <h1 className="text-[64px] font-bold">Hello, {patient.preferredName}</h1>
    </main>
  );
}
