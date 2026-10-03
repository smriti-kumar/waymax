// Finds names people use to introduce themselves in a transcript line
// ("Hi Mom, it's Priya", "I'm Sam from next door", "this is Raj", "my name is Nora").
import type { SelfIntroduction } from "@/server/ai/interfaces";

const PATTERNS = [
  /\b(?:it's|it is|its)\s+([A-Z][a-z'-]{1,20})(?:\s+[A-Z][a-z'-]{1,20})?\b/g,
  /\b(?:I'm|I am|im)\s+([A-Z][a-z'-]{1,20})\b/g,
  /\bthis is\s+([A-Z][a-z'-]{1,20})\b/g,
  /\bmy name is\s+([A-Z][a-z'-]{1,20})\b/gi,
  /\b(?:call me)\s+([A-Z][a-z'-]{1,20})\b/g,
];

// Capitalized words that follow "it's"/"I'm" but aren't names.
const NOT_NAMES = new Set([
  "I", "Me", "Mom", "Dad", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
  "Okay", "OK", "Good", "Fine", "Great", "Here", "Home", "Back", "Sorry", "So", "Not", "Just", "The", "A", "An", "Christmas", "Easter",
]);

export function extractSelfIntroductions(text: string): SelfIntroduction[] {
  const out: SelfIntroduction[] = [];
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const name = m[1]!;
      if (NOT_NAMES.has(name) || name.length < 2) continue;
      const proper = name[0]!.toUpperCase() + name.slice(1);
      if (!out.some((o) => o.name === proper)) out.push({ name: proper, quote: m[0] });
    }
  }
  return out;
}
