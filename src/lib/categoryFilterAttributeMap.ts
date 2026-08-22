// ─── CSV filter_name → Product field mapping ──────────────────────────────────
// `final_category_filters.csv` uses ~30 distinct filter_name values (see
// attribute_id in the source file). Most map onto a real, already-existing
// Product field (added when the catalogue was normalized — shapeRaw,
// colorRaw, clarityRaw, gradeRaw, cutType, luster, hardness, treatment,
// origin, dimensions, caratWeight, gemstoneName, numberOfStones). A few
// filter_names are HTML section headers from the legacy site's filter
// sidebar (e.g. "<b>DIAMOND INFO</b>") rather than real filters, and are
// excluded outright. Everything else falls back to a case-insensitive
// lookup inside Product.legacyAttributes, so no filter_name is ever
// silently dropped even if it doesn't have a first-class schema field.

export type FieldKind = 'string' | 'numeric' | 'array-string';

export interface FilterFieldMapping {
  /** Product schema field this filter reads/writes. */
  field: string;
  kind: FieldKind;
  /** True if `field` lives on Product directly; false ⇒ legacyAttributes[field]. */
  direct: boolean;
}

// Canonical, upper-cased, whitespace-trimmed filter_name → mapping.
const DIRECT_FIELD_MAP: Record<string, FilterFieldMapping> = {
  TREATMENT:        { field: 'treatment',      kind: 'string',  direct: true },
  ORIGIN:           { field: 'origin',         kind: 'string',  direct: true },
  CUT:              { field: 'cutType',        kind: 'string',  direct: true },
  COLOR:            { field: 'colorRaw',       kind: 'string',  direct: true },
  SHAPE:            { field: 'shapeRaw',       kind: 'string',  direct: true },
  LUSTER:           { field: 'luster',         kind: 'string',  direct: true },
  HARDNESS:         { field: 'hardness',       kind: 'string',  direct: true },
  GRADE:            { field: 'gradeRaw',       kind: 'string',  direct: true },
  CLARITY:          { field: 'clarityRaw',     kind: 'string',  direct: true },
  NAME:             { field: 'gemstoneName',   kind: 'string',  direct: true },
  // Physical dimensions ("6x3.7 mm", "7x5 mm") — free-text, compared
  // case/whitespace-insensitively rather than parsed as a number.
  SIZE:             { field: 'dimensions',     kind: 'string',  direct: true },
  // Carat weight ("0.40 ct.", "1 ct.") — always compared numerically
  // against the numeric caratWeight field so "0.4 ct" / "0.40 ct."
  // formatting differences never cause a false negative.
  WEIGHT:           { field: 'caratWeight',    kind: 'numeric', direct: true },
  'NUMBER OF STONES':          { field: 'numberOfStones', kind: 'numeric', direct: true },
  'APPROX. NUMBER OF STONES':  { field: 'numberOfStones', kind: 'numeric', direct: true },
  // Combined gemstone "clarity or grade" column — some categories grade by
  // clarity code (SI/VS…), others by a letter grade (A/AA/AAA). Checked
  // against both underlying fields with OR.
  'CLARITY/GRADE':  { field: 'clarityRaw|gradeRaw', kind: 'string', direct: true },
};

// filter_names with no dedicated Product column — matched against
// legacyAttributes (case-insensitive key match against the CSV's own
// filter_name, e.g. legacyAttributes["ring size"]) instead of being dropped.
const LEGACY_ATTRIBUTE_FALLBACK_FIELDS = new Set([
  'METAL/MATERIAL', 'RING SIZE', 'SUGGESTED SHAPE', 'SUGGESTED SIZE',
  'DEPTH', 'ITEM', 'CARAT RANGE', 'SIZE RANGE', 'POLISH', 'WIDTH',
  'AVAILABLE AS', 'LENGTH', 'BACKING',
]);

// Pure presentational section headers from the legacy filter sidebar — not
// real, selectable filters. Imported for completeness/audit but always
// excluded from query building and facet computation.
export function isSectionHeaderFilterName(filterNameRaw: string): boolean {
  return /^<b>.*<\/b>$/i.test(filterNameRaw.trim());
}

export function canonicalFilterName(filterNameRaw: string): string {
  return filterNameRaw.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function getFieldMapping(filterNameRaw: string): FilterFieldMapping | null {
  const key = canonicalFilterName(filterNameRaw);
  if (DIRECT_FIELD_MAP[key]) return DIRECT_FIELD_MAP[key];
  if (LEGACY_ATTRIBUTE_FALLBACK_FIELDS.has(key)) {
    return { field: key, kind: 'string', direct: false };
  }
  return null; // section header or genuinely unrecognized — skip
}

// ─── Normalization helpers ─────────────────────────────────────────────────────
// Handles inconsistent capitalization/whitespace between the CSV's filter
// values and what actually ended up in product attribute strings, without
// ever touching the underlying stored product data.

export function normalizeValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Escapes a value for use inside a RegExp, then relaxes internal whitespace
// so "6x3.7 mm" and "6x3.7  mm" (double space) are treated as the same
// value. Anchored, case-insensitive, exact-value match (not substring) —
// filter selection should never accidentally match a longer descriptive
// string that merely contains the chosen value.
export function exactValueRegex(raw: string): RegExp {
  const escaped = raw.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexibleWhitespace = escaped.replace(/\s+/g, '\\s+');
  return new RegExp(`^${flexibleWhitespace}$`, 'i');
}

// Extracts the leading numeric portion of a value like "0.40 ct.", "1 ct.",
// "7x5 mm" (→ 7) — used for the numeric filter kinds (WEIGHT, NUMBER OF
// STONES). Returns null if nothing numeric could be parsed.
export function extractLeadingNumber(raw: string): number | null {
  const m = raw.trim().match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export const NUMERIC_MATCH_TOLERANCE = 0.005;
