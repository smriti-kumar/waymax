"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * Every patient screen: content area that never scrolls, a bottom bar of up to
 * 3 big labelled buttons, and "I feel confused" always bottom-right.
 */
export function PatientFrame({
  children,
  buttons,
  className,
  hideConfused,
}: {
  children: ReactNode;
  buttons?: ReactNode;
  className?: string;
  hideConfused?: boolean;
}) {
  return (
    <div className={cx("flex h-dvh flex-col overflow-hidden bg-cream text-[28px] text-ink", className)}>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      <nav aria-label="Actions" className="flex flex-none items-stretch gap-4 border-t-2 border-line bg-sand/70 px-6 py-4">
        <div className="flex flex-1 flex-wrap gap-4">{buttons}</div>
        {!hideConfused && <ConfusedButton />}
      </nav>
    </div>
  );
}

export function ConfusedButton() {
  return (
    <Link
      href="/patient/calming"
      data-testid="confused-button"
      className="flex min-h-[72px] flex-none items-center rounded-3xl bg-sun px-8 text-[28px] font-bold text-ink shadow-sm hover:bg-[#dc9228] active:scale-[0.98]"
    >
      I feel confused
    </Link>
  );
}

export function PatientLinkButton({ href, children, tone = "light" }: { href: string; children: ReactNode; tone?: "light" | "sea" }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-[72px] items-center rounded-3xl px-8 text-[28px] font-bold shadow-sm active:scale-[0.98]",
        tone === "sea" ? "bg-sea text-white hover:bg-sea-deep" : "border-4 border-sea bg-white text-sea-deep hover:bg-sky",
      )}
    >
      {children}
    </Link>
  );
}
