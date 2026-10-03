"use client";
import { usePathname, useRouter } from "next/navigation";

/** Shown when a caregiver looks after more than one patient; keeps the current section. */
export function PatientSwitcher({ current, patients }: { current: string; patients: { id: string; preferredName: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  if (patients.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft">Switch to</span>
      <select
        data-testid="patient-switcher"
        value={current}
        onChange={(e) => router.push(path.replace(`/caregiver/${current}`, `/caregiver/${e.target.value}`))}
        className="rounded-lg border border-line bg-white px-2 py-1.5 font-semibold"
      >
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.preferredName}
          </option>
        ))}
      </select>
    </label>
  );
}
