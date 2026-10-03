import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-2xl border-2 border-line bg-white p-6", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx("text-2xl font-bold text-ink", className)} {...rest} />;
}
