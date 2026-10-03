// Pure text helpers: the recognition recap (no LLM, PLAN §5.5) and fuzzy name matching (§5.4).

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s'-]/g, "")
    .trim();

/** Case-insensitive, Levenshtein ≤ 2 on the whole name or on its first word. */
export function namesMatch(claimed: string, candidates: (string | null | undefined)[], maxDistance = 2): boolean {
  const c = norm(claimed);
  if (!c) return false;
  for (const raw of candidates) {
    if (!raw) continue;
    const n = norm(raw);
    if (!n) continue;
    if (levenshtein(c, n) <= maxDistance) return true;
    const first = n.split(/\s+/)[0]!;
    if (levenshtein(c, first) <= maxDistance) return true;
    const cFirst = c.split(/\s+/)[0]!;
    if (levenshtein(cFirst, first) <= maxDistance && cFirst.length > 2) return true;
  }
  return false;
}

export type RecapInput = {
  name: string;
  relationship: string | null;
  lastVisit: { at: Date; isToday: boolean; weekday: string } | null;
  lastFact: string | null;
};

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/** "{name}, your {relationship}. {Last visit: weekday}. {fact or summary}." — missing parts skipped. */
export function buildRecap(r: RecapInput): string {
  const parts: string[] = [];
  parts.push(sentence(r.relationship ? `${r.name}, your ${r.relationship}` : r.name));
  if (r.lastVisit) parts.push(sentence(`Last visit: ${r.lastVisit.isToday ? "earlier today" : r.lastVisit.weekday}`));
  if (r.lastFact) parts.push(sentence(r.lastFact));
  return parts.filter(Boolean).join(" ");
}

/** What "Who is this?" says. Uses the pronunciation hint when there is one. */
export function buildSayText(name: string, spokenName: string | null, relationship: string | null) {
  const n = spokenName?.trim() || name;
  return relationship ? `This is ${n}, your ${relationship}.` : `This is ${n}.`;
}
