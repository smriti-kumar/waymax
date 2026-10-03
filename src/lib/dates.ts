// Yearly dates (birthdays, anniversaries): next occurrence and gentle wording. Pure.
export type YearlyDate = { kind: "birthday" | "anniversary" | "other"; label: string | null; month: number; day: number; year: number | null };

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The month/day as a real calendar date in `year` (Feb 29 → Feb 28 in non-leap years). */
function onYear(d: { month: number; day: number }, year: number) {
  const day = d.month === 2 && d.day === 29 && !isLeap(year) ? 28 : d.day;
  return { y: year, m: d.month, d: day };
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** Days from local "YYYY-MM-DD" `today` until the next occurrence (0 = today). */
export function daysUntil(date: { month: number; day: number }, today: string) {
  const [ty, tm, td] = today.split("-").map(Number);
  const t = Date.UTC(ty!, tm! - 1, td!);
  for (const y of [ty!, ty! + 1]) {
    const o = onYear(date, y);
    const at = Date.UTC(o.y, o.m - 1, o.d);
    if (at >= t) return { days: Math.round((at - t) / 86400_000), year: y };
  }
  return { days: 365, year: ty! + 1 };
}

/** "Priya's birthday", "Priya's 30th birthday", "Priya and Dev's anniversary", or the custom label. */
export function describeDate(d: YearlyDate, personName: string, occursInYear?: number) {
  const n = d.year && occursInYear ? occursInYear - d.year : null;
  if (d.kind === "birthday") return `${personName}'s ${n && n > 0 ? `${ordinal(n)} ` : ""}birthday`;
  if (d.kind === "anniversary") return d.label ? `${d.label}` : `${personName}'s ${n && n > 0 ? `${ordinal(n)} ` : ""}anniversary`;
  return d.label ? `${personName}: ${d.label}` : `A special day for ${personName}`;
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const formatMonthDay = (d: { month: number; day: number }) => `${MONTHS[d.month - 1]} ${d.day}`;
