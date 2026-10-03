import { deviceOrRedirect } from "@/server/auth/device-current";

export const dynamic = "force-dynamic";

export default async function PhonePage() {
  const { patient } = await deviceOrRedirect("patient_phone");
  return (
    <main className="flex flex-1 items-center justify-center bg-cream p-8 text-center">
      <h1 className="text-[40px] font-bold">Hello, {patient.preferredName}</h1>
    </main>
  );
}
