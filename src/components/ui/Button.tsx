import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "warn";
type Size = "sm" | "md" | "lg";

// Every variant has a solid, visible edge so it reads as a button, never as plain text.
const variants: Record<Variant, string> = {
  primary: "border-2 border-sea bg-sea text-white hover:border-sea-deep hover:bg-sea-deep",
  secondary: "border-2 border-sea bg-white text-sea-deep hover:bg-sky",
  ghost: "border-2 border-line bg-white text-ink hover:bg-sand",
  warn: "border-2 border-sun-deep bg-sun-deep text-white hover:bg-[#5e3909]",
};
// Touch targets: 48 px at the smallest, 56 px by default.
const sizes: Record<Size, string> = {
  sm: "min-h-12 px-4 py-2 text-base rounded-xl",
  md: "min-h-14 px-5 py-3 text-lg rounded-xl",
  lg: "min-h-16 px-7 py-4 text-xl rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-bold leading-snug transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" />}
      {children}
    </button>
  );
});
