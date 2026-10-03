import { caregiverForPatientOrRedirect } from "@/server/auth/current";
import { getPatient } from "@/server/services/patients";
import { PatientNav } from "@/components/caregiver/PatientNav";

import type { NavItem } from "@/components/caregiver/PatientNav";

const NAV: NavItem[] = [
  { href: "", label: "Overview" },
  { href: "/people", label: "People" },
  { href: "/approvals", label: "Approvals", badge: "pending" },
  { href: "/schedule", label: "Schedule" },
  { href: "/safety", label: "Safety" },
];

export default async function PatientLayout({ children, params }: LayoutProps<"/caregiver/[pid]">) {
  const { pid } = await params;
  await caregiverForPatientOrRedirect(pid);
  const patient = await getPatient(pid);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{patient.preferredName}</h1>
        <span className="text-sm text-ink-soft">{patient.name}</span>
      </div>
      <PatientNav pid={pid} items={NAV} />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
