import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Tone = "sea" | "sun" | "leaf" | "light";
const tones: Record<Tone, string> = {
  sea: "bg-sea text-white hover:bg-sea-deep",
  sun: "bg-sun text-ink hover:bg-[#dc9228]",
  leaf: "bg-leaf text-white hover:bg-[#3f6630]",
  light: "bg-white text-sea-deep border-4 border-sea hover:bg-sky",
};

/** Patient-facing button: always ≥ 72 px tall, ≥ 28 px text, always a text label. */
export const BigButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }>(
  function BigButton({ tone = "sea", className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          "min-h-[72px] rounded-3xl px-8 py-4 text-[28px] font-bold leading-tight shadow-sm transition active:scale-[0.98] disabled:opacity-60",
          tones[tone],
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
