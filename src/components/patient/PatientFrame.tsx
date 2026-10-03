"use client";
import Link from "next/link";
import { logPatientEvent } from "@/client/patient-api";
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
  onConfused,
}: {
  children: ReactNode;
  buttons?: ReactNode;
  className?: string;
  hideConfused?: boolean;
  /** On the calming screen itself, pressing again restarts the steps instead of navigating. */
  onConfused?: () => void;
}) {
  return (
    <div className={cx("flex h-dvh flex-col overflow-hidden bg-cream text-[28px] text-ink", className)}>
      {/* Content is clipped and sits below the action bar, so it can never cover a button. */}
      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      <nav aria-label="Actions" className="relative z-20 flex flex-none items-stretch gap-4 border-t-2 border-line bg-sand px-6 py-4">
        <div className="flex flex-1 flex-wrap gap-4">{buttons}</div>
        {!hideConfused && <ConfusedButton onPress={onConfused} />}
      </nav>
    </div>
  );
}

export function ConfusedButton({ onPress }: { onPress?: () => void }) {
  return (
    <Link
      href="/patient/calming"
      data-testid="confused-button"
      onClick={(e) => {
        logPatientEvent("confused_pressed");
        if (onPress) {
          e.preventDefault();
          onPress();
        }
      }}
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
