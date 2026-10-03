"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { cx } from "@/components/ui/cx";

export type NavItem = { href: string; label: string; badge?: "pending" };

/** Every section is always visible as a large button: no hidden overflow, no menus. */
export function PatientNav({ pid, items }: { pid: string; items: NavItem[] }) {
  const path = usePathname();
  const { data } = useSWR<{ people: unknown[] }>(`/api/patients/${pid}/people?status=pending`, fetcher, {
    refreshInterval: 5000,
  });
  const pending = data?.people.length ?? 0;
  return (
    <nav aria-label="Patient sections">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => {
          const href = `/caregiver/${pid}${it.href}`;
          const active = it.href === "" ? path === href : path.startsWith(href);
          return (
            <li key={it.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-center text-lg font-bold",
                  active ? "border-sea-deep bg-sea text-white" : "border-line bg-white text-ink hover:bg-sand",
                )}
              >
                {it.label}
                {it.badge === "pending" && pending > 0 && (
                  <span
                    data-testid="pending-badge"
                    className="inline-flex min-w-8 items-center justify-center rounded-full border-2 border-ink bg-sun px-2 text-base font-bold text-ink"
                  >
                    {pending}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
