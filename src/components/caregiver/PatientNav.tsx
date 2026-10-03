"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

export type NavItem = { href: string; label: string; badge?: number };

export function PatientNav({ pid, items }: { pid: string; items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Patient sections" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 whitespace-nowrap">
        {items.map((it) => {
          const href = `/caregiver/${pid}${it.href}`;
          const active = it.href === "" ? path === href : path.startsWith(href);
          return (
            <li key={it.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold",
                  active ? "bg-sea text-white" : "text-ink-soft hover:bg-sand",
                )}
              >
                {it.label}
                {!!it.badge && (
                  <span className="rounded-full bg-sun px-1.5 text-xs font-bold text-ink">{it.badge}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
