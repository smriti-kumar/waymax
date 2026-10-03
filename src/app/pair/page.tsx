import Link from "next/link";
import { currentDevice } from "@/server/auth/device-current";
import { PairForm } from "@/components/PairForm";

export const metadata = { title: "Set up this device · Waymax" };
export const dynamic = "force-dynamic";

export default async function PairPage() {
  const d = await currentDevice();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <h1 className="text-5xl font-bold text-sea-deep">Set up this device</h1>
      {d && (
        <div className="w-full rounded-3xl bg-sky p-5 text-[24px]">
          This device is already set up for {d.patient.preferredName}.{" "}
          <Link className="font-bold text-sea-deep underline" href={d.device.kind === "patient_phone" ? "/phone" : "/patient"}>
            Continue
          </Link>
        </div>
      )}
      <PairForm />
      <p className="text-lg text-ink-soft">The caregiver makes this code on their Safety page.</p>
    </main>
  );
}
