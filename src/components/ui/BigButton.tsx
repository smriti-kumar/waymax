import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Tone = "sea" | "sun" | "leaf" | "light";
const tones: Record<Tone, string> = {
  sea: "border-4 border-sea-deep bg-sea text-white hover:bg-sea-deep",
  sun: "border-4 border-sun-deep bg-sun text-ink hover:bg-sun-hover",
  leaf: "border-4 border-leaf-deep bg-leaf text-white hover:bg-leaf-deep",
  light: "border-4 border-sea bg-white text-sea-deep hover:bg-sky",
};

/** Patient-facing button: always ≥ 72 px tall, ≥ 28 px text, always a text label. */
export const BigButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }>(
  function BigButton({ tone = "sea", className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          "min-h-[72px] rounded-3xl px-8 py-4 text-[28px] font-bold leading-tight transition active:scale-[0.98] disabled:opacity-60",
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
