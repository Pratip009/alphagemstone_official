// Shared between the server-side search route (app/api/products/search/route.ts)
// and the client SearchBar. Keeping the scoring/parsing logic in one place means
// "what counts as a match" can't quietly diverge between server and client.

/**
 * Cheap, dependency-free scorer: exact / prefix / substring get strong scores;
 * anything else falls back to an in-order subsequence match so typos and
 * partial words ("dtjst" → "Datejust") still surface a result, just ranked lower.
 */
export function fuzzyScore(text: string | undefined | null, q: string): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  const query = q.toLowerCase().trim();
  if (!query) return 0;
  if (t === query) return 100;
  if (t.startsWith(query)) return 92;
  if (t.includes(query)) return 78;
  if (query.length < 2) return 0;

  let ti = 0, qi = 0, matched = 0, lastMatch = -1, gaps = 0;
  while (ti < t.length && qi < query.length) {
    if (t[ti] === query[qi]) {
      if (lastMatch !== -1 && ti - lastMatch > 1) gaps++;
      lastMatch = ti;
      matched++;
      qi++;
    }
    ti++;
  }
  if (qi < query.length) return 0; // not every query char appeared in order
  const coverage = matched / Math.max(t.length, query.length);
  const score = 45 * coverage - gaps * 3;
  return score > 12 ? score : 0;
}

/**
 * Diamonds/gemstones are identified by carat weight (a `size` number field),
 * not by free text — nothing in the product document literally contains the
 * string "0.35 Carat". This detects a carat-style query so it can be matched
 * against `size` numerically instead of via string search.
 *
 * Matches: "0.35", "0.35 carat", "0.35 carats", "0.35ct", "0.35 ct", "0.35cts".
 * Returns null when the query doesn't look like a carat spec.
 */
export function extractCarat(q: string): number | null {
  const lq = q.trim().toLowerCase();
  const withUnit = lq.match(/(\d+(?:\.\d+)?)\s*(carats?|cts?)\b/);
  if (withUnit) return parseFloat(withUnit[1]);
  if (/^\d+(?:\.\d+)?$/.test(lq)) return parseFloat(lq);
  return null;
}

/** How close two carat weights need to be to count as a match, in carats. */
export const CARAT_MATCH_TOLERANCE = 0.02;

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}