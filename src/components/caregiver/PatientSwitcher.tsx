"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

/** Shown when a caregiver looks after more than one patient: one button per patient, keeping the current section. */
export function PatientSwitcher({ current, patients }: { current: string; patients: { id: string; preferredName: string }[] }) {
  const path = usePathname();
  if (patients.length < 2) return null;
  return (
    <nav aria-label="Switch patient" data-testid="patient-switcher" className="flex flex-wrap items-center gap-2">
      <span className="font-bold text-ink-soft">Caring for:</span>
      {patients.map((p) => (
        <Link
          key={p.id}
          href={path.replace(`/caregiver/${current}`, `/caregiver/${p.id}`)}
          aria-current={p.id === current ? "page" : undefined}
          className={cx(
            "inline-flex min-h-12 items-center rounded-xl border-2 px-4 text-lg font-bold",
            p.id === current ? "border-sea-deep bg-sea text-white" : "border-line bg-white text-ink hover:bg-sand",
          )}
        >
          {p.id === current && <span aria-hidden>✓&nbsp;</span>}
          {p.preferredName}
        </Link>
      ))}
    </nav>
  );
}
