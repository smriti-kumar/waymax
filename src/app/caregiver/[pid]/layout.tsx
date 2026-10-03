import { caregiverForPatientOrRedirect } from "@/server/auth/current";
import { getPatient } from "@/server/services/patients";
import { PatientNav } from "@/components/caregiver/PatientNav";
import { PatientSwitcher } from "@/components/caregiver/PatientSwitcher";
import { patientsForCaregiver } from "@/server/services/caregivers";

import type { NavItem } from "@/components/caregiver/PatientNav";

const NAV: NavItem[] = [
  { href: "", label: "Overview" },
  { href: "/people", label: "People" },
  { href: "/approvals", label: "Approvals", badge: "pending" },
  { href: "/schedule", label: "Schedule" },
  { href: "/conversations", label: "Conversations" },
  { href: "/questions", label: "Questions" },
  { href: "/safety", label: "Safety" },
  { href: "/setup", label: "Setup" },
];

export default async function PatientLayout({ children, params }: LayoutProps<"/caregiver/[pid]">) {
  const { pid } = await params;
  const { caregiver } = await caregiverForPatientOrRedirect(pid);
  const [patient, all] = await Promise.all([getPatient(pid), patientsForCaregiver(caregiver.id)]);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{patient.preferredName}</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-soft">{patient.name}</span>
          <PatientSwitcher current={pid} patients={all} />
        </div>
      </div>
      <PatientNav pid={pid} items={NAV} />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
