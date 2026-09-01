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

/**
 * Physical item weight (grams) — a distinct concept from carat weight.
 * `Product.weight` holds this (e.g. a ring's metal weight from the legacy
 * `weight` column), so a bare carat-style query like "5" would otherwise
 * only ever be checked against `size`/`caratWeight` and never against this
 * field. Requires an explicit unit ("g"/"gm"/"gram(s)") so it never
 * collides with a bare-number carat query — "0.35" alone still means
 * carats, not grams.
 *
 * Matches: "5g", "5 g", "5gm", "5gms", "5 gram", "5.25 grams".
 * Returns null when the query doesn't look like a gram-weight spec.
 */
export function extractWeight(q: string): number | null {
  const lq = q.trim().toLowerCase();
  const m = lq.match(/(\d+(?:\.\d+)?)\s*(gm?s?|grams?)\b/);
  if (m) return parseFloat(m[1]);
  return null;
}

/**
 * Weight tolerance scales with the value instead of a fixed constant —
 * a 1g stud earring and a 40g bangle need very different absolute
 * windows to feel like "close enough" matches. Floored at 0.2g so tiny
 * weights still get a usable window.
 */
export function weightTolerance(weight: number): number {
  return Math.max(0.2, weight * 0.05);
}

/**
 * Physical diameter/size in millimetres — e.g. "1.2mm", "6.5 mm". Matched
 * against the same `size` field diamonds/gemstones store their spec in
 * (carat elsewhere in this file, mm here), since the catalogue has no
 * separate mm column. Requires an explicit "mm" unit so it never collides
 * with a bare-number carat query like "1.2" (which stays carats).
 */
export function extractMm(q: string): number | null {
  const lq = q.trim().toLowerCase();
  const m = lq.match(/(\d+(?:\.\d+)?)\s*mm\b/);
  if (m) return parseFloat(m[1]);
  return null;
}

/** How close two mm sizes need to be to count as a match — tighter than carat since mm specs are usually given precisely. */
export function mmTolerance(mm: number): number {
  return Math.max(0.05, mm * 0.03);
}

export interface DimensionQuery { a: number; b: number }

/**
 * WxH style physical dimensions, e.g. "14.5x9.3mm", "14.5 x 9.3 mm",
 * "7x5", "7 X 5mm". Stored as a free-text string on Product.dimensions
 * (there's no structured width/height column), so this can't be matched
 * with a numeric range query the way carat/weight/mm are above — see
 * buildDimensionRegex, which matches it via a flexible regex instead.
 */
export function extractDimensions(q: string): DimensionQuery | null {
  const lq = q.trim().toLowerCase();
  const m = lq.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*mm)?\b/);
  if (!m) return null;
  return { a: parseFloat(m[1]), b: parseFloat(m[2]) };
}

/**
 * Case-insensitive regex matching the two dimension numbers appearing
 * close together, in EITHER order (so a "14.5x9.3mm" query also matches a
 * product whose dimensions are stored as "9.3 x 14.5 mm") — tolerant of
 * whatever separator/spacing/unit the catalogue used ("x", "×", extra
 * spaces, "mm"/"MM"/no unit at all).
 */
export function buildDimensionRegex(dims: DimensionQuery): RegExp {
  const a = escapeRegex(String(dims.a));
  const b = escapeRegex(String(dims.b));
  return new RegExp(`(${a}[^0-9]{1,6}${b})|(${b}[^0-9]{1,6}${a})`, 'i');
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}