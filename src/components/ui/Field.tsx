import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

const inputCls =
  "w-full min-h-14 rounded-xl border-2 border-line bg-white px-4 py-3 text-lg text-ink focus:border-sea-deep";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-lg font-bold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="text-base text-ink-soft">{hint}</span>}
      {error && <span className="text-base font-bold text-sun-deep">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, props.className)} />;
}

export type Choice = { value: string; label: string };

/**
 * A row of large tap targets instead of a dropdown: every option is visible at
 * once and picked with one tap. Backed by real radio inputs, so it works in
 * plain forms (`name` + `defaultValue`) or controlled (`value` + `onChange`).
 * The chosen option is marked with a ✓ as well as colour.
 */
export function Choices({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  hint,
  className,
}: {
  label: string;
  name: string;
  options: readonly Choice[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  hint?: string;
  className?: string;
}) {
  return (
    <fieldset className={cx("flex min-w-0 flex-col gap-2", className)}>
      <legend className="mb-2 text-lg font-bold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-line bg-white px-4 py-2 text-lg font-bold text-ink hover:bg-sand has-checked:border-sea-deep has-checked:bg-sea has-checked:text-white has-focus-visible:outline-4 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              className="peer sr-only"
              {...(value !== undefined
                ? { checked: value === o.value, onChange: () => onChange?.(o.value) }
                : { defaultChecked: defaultValue === o.value, onChange: () => onChange?.(o.value) })}
            />
            <span aria-hidden className="hidden peer-checked:inline">
              ✓
            </span>
            {o.label}
          </label>
        ))}
      </div>
      {hint && <span className="text-base text-ink-soft">{hint}</span>}
    </fieldset>
  );
}
