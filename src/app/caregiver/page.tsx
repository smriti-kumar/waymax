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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Hello, {cg.name.split(" ")[0]}</h1>
      {patients.length === 0 ? (
        <EmptyState title="No patients yet" body="Add the person you care for to get started." />
      ) : (
        <ul className="grid gap-3">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/caregiver/${p.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 shadow-sm hover:border-sea"
              >
                <span>
                  <span className="block text-lg font-semibold">{p.preferredName}</span>
                  <span className="text-sm text-ink-soft">{p.name}</span>
                </span>
                <span className="text-sm text-ink-soft">{p.role === "owner" ? "Owner" : "Co-caregiver"}</span>
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
