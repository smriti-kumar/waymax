export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

const FRIENDLY: Record<string, string> = {
  "America/New_York": "Eastern (New York)",
  "America/Chicago": "Central (Chicago)",
  "America/Denver": "Mountain (Denver)",
  "America/Phoenix": "Arizona (Phoenix)",
  "America/Los_Angeles": "Pacific (Los Angeles)",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

/** A name a caregiver recognises at a glance, e.g. "Eastern (New York)" or "Europe / London". */
export function timezoneLabel(tz: string) {
  return FRIENDLY[tz] ?? tz.replace(/_/g, " ").replace("/", " / ");
}

export const timezoneChoices = (tzs: readonly string[]) => tzs.map((tz) => ({ value: tz, label: timezoneLabel(tz) }));
