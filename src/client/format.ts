import { formatDistanceToNowStrict } from "date-fns";

export function ago(iso: string | Date | null | undefined, fallback = "never") {
  if (!iso) return fallback;
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
}

export function clockTime(iso: string | Date, timeZone?: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}
