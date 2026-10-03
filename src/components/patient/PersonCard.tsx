"use client";
import type { PersonCardDto } from "@/lib/contracts/patient";

/** Slides over the Today card when someone is recognized. Announced politely to screen readers. */
export function PersonCard({ card }: { card: PersonCardDto }) {
  return (
    <section
      aria-live="polite"
      aria-label={`${card.name}, your ${card.relationship}`}
      data-testid="person-card"
      className="wm-slide-up absolute inset-0 z-10 flex items-center gap-12 bg-cream px-12 py-10"
    >
      {card.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photoUrl} alt="" className="h-[min(60vh,460px)] w-[min(60vh,460px)] flex-none rounded-[48px] object-cover shadow-md" />
      ) : (
        <div className="flex h-[min(60vh,460px)] w-[min(60vh,460px)] flex-none items-center justify-center rounded-[48px] bg-sand text-[160px] font-bold text-sea-deep">
          {card.name[0]}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="text-[88px] font-bold leading-none" data-testid="person-card-name">
          {card.name}
        </h1>
        <p className="text-[48px] font-semibold text-sea-deep">Your {card.relationship}</p>
        <p className="max-w-[28ch] text-[36px] leading-snug text-ink-soft" data-testid="person-card-recap">
          {card.recap.replace(new RegExp(`^${card.name}, your ${card.relationship}\\.\\s*`, "i"), "")}
        </p>
      </div>
    </section>
  );
}
