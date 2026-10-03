import Link from "next/link";
import { currentCaregiverOrRedirect } from "@/server/auth/current";
import { patientsForCaregiver } from "@/server/services/caregivers";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardTitle } from "@/components/ui/Card";
import { CreatePatientForm } from "@/components/caregiver/CreatePatientForm";

export const metadata = { title: "Patients · Waymax" };

export default async function CaregiverHome() {
  const cg = await currentCaregiverOrRedirect();
  const patients = await patientsForCaregiver(cg.id);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <h1 className="text-4xl font-bold">Hello, {cg.name.split(" ")[0]}</h1>
      {patients.length === 0 ? (
        <EmptyState title="No patients yet" body="Add the person you care for to get started." />
      ) : (
        <ul className="grid gap-3">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/caregiver/${p.id}`}
                className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border-2 border-line bg-white px-6 py-4 hover:border-sea-deep hover:bg-sky"
              >
                <span>
                  <span className="block text-2xl font-bold">{p.preferredName}</span>
                  <span className="text-ink-soft">{p.name}</span>
                </span>
                <span className="text-ink-soft">{p.role === "owner" ? "Owner" : "Co-caregiver"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardTitle className="mb-4">Add a patient</CardTitle>
        <CreatePatientForm />
      </Card>
    </main>
  );
}
