"use client";
import type { PersonCardDto } from "@/lib/contracts/patient";

/** Slides over the Today card when someone is recognized. Announced politely to screen readers. */
export function PersonCard({ card, onClose }: { card: PersonCardDto; onClose: () => void }) {
  return (
    <section
      aria-live="polite"
      aria-label={`${card.name}, your ${card.relationship}`}
      data-testid="person-card"
      className="wm-slide-up absolute inset-x-8 top-6 bottom-6 z-10 flex items-center gap-12 rounded-[40px] border-[6px] border-sea bg-cream px-12 py-8 shadow-xl"
    >
      <button
        onClick={onClose}
        data-testid="person-card-close"
        aria-label="Close"
        className="absolute right-6 top-6 flex min-h-[72px] items-center gap-3 rounded-3xl border-4 border-sea bg-white px-6 text-[28px] font-bold text-sea-deep hover:bg-sky"
      >
        <span aria-hidden className="text-[32px] leading-none">✕</span> Close
      </button>
      {card.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photoUrl} alt="" className="h-[min(52vh,440px)] w-[min(52vh,440px)] flex-none rounded-[48px] border-4 border-line object-cover" />
      ) : (
        <div className="flex h-[min(52vh,440px)] w-[min(52vh,440px)] flex-none items-center justify-center rounded-[48px] bg-sand text-[160px] font-bold text-sea-deep">
          {card.name[0]}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="text-[88px] font-bold leading-none" data-testid="person-card-name">
          {card.name}
        </h1>
        <p className="text-[48px] font-semibold text-sea-deep">Your {card.relationship}</p>
        <p className="max-w-[28ch] text-[36px] leading-normal text-ink" data-testid="person-card-recap">
          {card.recap.replace(new RegExp(`^${card.name}, your ${card.relationship}\\.\\s*`, "i"), "")}
        </p>
      </div>
    </section>
  );
}
