// Caregiver-facing wording for text-message delivery problems. Raw provider
// errors are kept in the database for debugging but never shown.

export function friendlyDeliveryError(raw: string | null | undefined): string {
  const e = (raw ?? "").toLowerCase();
  if (!e) return "It didn't go through.";
  if (e.includes("not allowed") || e.includes("not registered") || e.includes("allowlist"))
    return "This number isn't set up to receive alerts yet. We're adding it — try again in a minute.";
  if (e.includes("timed out") || e.includes("timeout")) return "It took too long to go through. Please try again.";
  if (e.includes("not set up") || e.includes("not configured")) return "Text alerts aren't switched on yet.";
  if (e.includes("imessage") && (e.includes("not") || e.includes("unavailable")))
    return "This number doesn't seem to use iMessage.";
  if (e.includes("connect") || e.includes("network") || e.includes("fetch failed"))
    return "We couldn't reach the messaging service. Please try again.";
  return "It didn't go through. Please try again.";
}

/** Show a phone number as "…9506" so lists stay readable. */
export const lastFour = (phone: string) => `…${phone.replace(/\D/g, "").slice(-4)}`;
