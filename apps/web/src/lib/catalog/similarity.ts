/**
 * Lightweight name-similarity for catalog duplicate detection (Phase 5C).
 *
 * Used before creating a new material / bought-out item to surface possible
 * duplicates so the user can reuse an existing record instead of spawning a
 * near-identical one (feedback 3.2 — the 67%-duplicate problem).
 *
 * Deliberately simple and dependency-free: normalized token overlap, no
 * Levenshtein / ML. Good enough to catch "BASKET Type Strainer" vs
 * "Basket-type strainer" for a 10-person team's catalog.
 */

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
export function normalizeName(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenize(s: string): Set<string> {
  const norm = normalizeName(s);
  if (!norm) return new Set();
  // Drop 1-char tokens (units, stray letters) — they add noise, not signal.
  return new Set(norm.split(' ').filter((t) => t.length > 1));
}

/**
 * Jaccard-ish overlap of the two token sets, in [0, 1]. Also returns 1 when one
 * normalized name fully contains the other (handles "Pump" vs "Centrifugal Pump").
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 1;

  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}

export interface SimilarCandidate<T> {
  item: T;
  score: number;
}

/**
 * Rank `items` by how similar their `name` is to `query`, returning those at or
 * above `threshold`, highest first. Default threshold 0.5 catches close
 * variants without flooding the user with weak matches.
 */
export function rankByNameSimilarity<T>(
  items: T[],
  getName: (item: T) => string,
  query: string,
  opts: { threshold?: number; limit?: number } = {}
): SimilarCandidate<T>[] {
  const threshold = opts.threshold ?? 0.5;
  const limit = opts.limit ?? 5;
  return items
    .map((item) => ({ item, score: nameSimilarity(getName(item), query) }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
