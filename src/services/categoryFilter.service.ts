import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import CategoryFilter from '@/models/CategoryFilter';
import Product, { IProduct } from '@/models/Product';
import {
  getFieldMapping,
  canonicalFilterName,
  exactValueRegex,
  extractLeadingNumber,
  NUMERIC_MATCH_TOLERANCE,
  FilterFieldMapping,
} from '@/lib/categoryFilterAttributeMap';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryFilterOption {
  value: string;
  count: number;
  selected: boolean;
}

export interface CategoryFilterGroup {
  filterName: string;
  attributeId: number;
  options: CategoryFilterOption[];
}

// Selections coming off the query string: { SHAPE: ['Marquise'], COLOR: ['Pink', 'Red'] }
// Multiple values within one filterName = OR. Multiple filterNames = AND.
export type CategoryFilterSelection = Record<string, string[]>;

// Unit label appended to a filter's displayed option values only (never to
// the underlying stored/matched number). Keyed by canonicalFilterName.
// WEIGHT's backing field (caratWeight) is a bare number, so "0.4" alone in
// a dropdown reads as ambiguous — "0.4 ct." doesn't.
const DISPLAY_UNIT_SUFFIX: Record<string, string> = {
  WEIGHT: ' ct.',
};

// ─── Parsing selections from the URL ───────────────────────────────────────────
// Accepts either a single `filters` query param holding JSON
// (?filters={"SHAPE":["Marquise"],"COLOR":["Pink"]}) or bracket-style params
// (?filter[SHAPE]=Marquise&filter[COLOR]=Pink,Red) — whichever the client finds
// easier to construct. Both are supported so the existing FilterBar/URL
// patterns don't need to change shape to adopt this.
export function parseCategoryFilterSelection(
  searchParams: URLSearchParams
): CategoryFilterSelection {
  const selection: CategoryFilterSelection = {};

  const jsonParam = searchParams.get('filters');
  if (jsonParam) {
    try {
      const parsed = JSON.parse(jsonParam);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const key = canonicalFilterName(k);
          const values = Array.isArray(v) ? v.map(String) : [String(v)];
          selection[key] = (selection[key] || []).concat(values.filter(Boolean));
        }
      }
    } catch {
      // Malformed JSON — ignore rather than 500ing the page.
    }
  }

  for (const [key, value] of searchParams.entries()) {
    const m = key.match(/^filter\[(.+)]$/);
    if (!m) continue;
    const filterName = canonicalFilterName(m[1]);
    const values = value.split(',').map((s) => s.trim()).filter(Boolean);
    selection[filterName] = (selection[filterName] || []).concat(values);
  }

  // De-duplicate values within each filter.
  for (const key of Object.keys(selection)) {
    selection[key] = Array.from(new Set(selection[key]));
  }

  return selection;
}

// Same parsing as parseCategoryFilterSelection, for server components that
// already have searchParams as a plain object (Next.js App Router's async
// `searchParams` prop) rather than a URLSearchParams instance.
export function parseCategoryFilterSelectionFromObject(
  sp: Record<string, string | string[] | undefined>
): CategoryFilterSelection {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((val) => usp.append(k, val));
    else usp.append(k, v);
  }
  return parseCategoryFilterSelection(usp);
}

// ─── Mongo condition builder for one filterName's selected values ────────────
// OR across values within the same filterName.
function buildFieldCondition(
  mapping: FilterFieldMapping,
  values: string[]
): FilterQuery<IProduct> | null {
  if (values.length === 0) return null;

  const fieldsToCheck = mapping.field.split('|'); // e.g. 'clarityRaw|gradeRaw'

  const orConditions: FilterQuery<IProduct>[] = [];

  for (const value of values) {
    if (mapping.kind === 'numeric') {
      const n = extractLeadingNumber(value);
      if (n === null) continue;
      for (const f of fieldsToCheck) {
        const path = mapping.direct ? f : `legacyAttributes.${f}`;
        orConditions.push({
          [path]: { $gte: n - NUMERIC_MATCH_TOLERANCE, $lte: n + NUMERIC_MATCH_TOLERANCE },
        } as FilterQuery<IProduct>);
      }
    } else {
      const rx = exactValueRegex(value);
      for (const f of fieldsToCheck) {
        if (mapping.direct) {
          orConditions.push({ [f]: rx } as FilterQuery<IProduct>);
        } else {
          // Legacy-attribute fallback fields: the CSV filter_name doesn't
          // necessarily match the raw legacy column key casing, so try a
          // couple of common variants (best-effort — these categories are
          // a small minority with no dedicated schema field).
          orConditions.push(
            { [`legacyAttributes.${f}`]: rx } as FilterQuery<IProduct>,
            { [`legacyAttributes.${f.toLowerCase()}`]: rx } as FilterQuery<IProduct>,
            { [`legacyAttributes.${f.replace(/\s+/g, '_').toLowerCase()}`]: rx } as FilterQuery<IProduct>,
          );
        }
      }
    }
  }

  if (orConditions.length === 0) return null;
  return orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
}

// ─── Apply selections to a base product query (AND across filterNames) ───────
export function applyCategoryFilterSelection(
  baseQuery: FilterQuery<IProduct>,
  selection: CategoryFilterSelection
): FilterQuery<IProduct> {
  const andConditions: FilterQuery<IProduct>[] = [];

  for (const [filterName, values] of Object.entries(selection)) {
    if (!values || values.length === 0) continue;
    const mapping = getFieldMapping(filterName);
    if (!mapping) continue; // unknown/section-header filterName — ignore safely
    const condition = buildFieldCondition(mapping, values);
    if (condition) andConditions.push(condition);
  }

  if (andConditions.length === 0) return baseQuery;

  return {
    ...baseQuery,
    $and: [...(baseQuery.$and || []), ...andConditions],
  };
}

// ─── Which filter attributes apply to a given category/subcategory ───────────
// Scoped by the resolved Category/Subcategory ObjectId (the same scope the
// product listing itself uses), NOT by legacyCategoryId directly — so a
// category never shows filters that belong to an unrelated legacy category
// that happened to collapse into the same real subcategory, and vice versa
// nothing leaks across subcategories that map to different real records.
export async function getApplicableFilterDefinitions(scope: {
  categoryId?: string;
  subcategoryId?: string;
}): Promise<{ filterName: string; attributeId: number }[]> {
  if (!scope.subcategoryId && !scope.categoryId) return [];

  // aggregate()'s $match does NOT auto-cast query values the way
  // Model.find() does — a plain string here would be compared against the
  // stored ObjectId and never match, silently returning [] every time (the
  // bug that made the filter panel never render). Cast explicitly.
  if (scope.subcategoryId && !mongoose.isValidObjectId(scope.subcategoryId)) return [];
  if (scope.categoryId && !mongoose.isValidObjectId(scope.categoryId)) return [];

  const match: Record<string, unknown> = scope.subcategoryId
    ? { subcategory: new mongoose.Types.ObjectId(scope.subcategoryId) }
    : { category: new mongoose.Types.ObjectId(scope.categoryId as string), subcategory: { $exists: false } };

  const docs = await CategoryFilter.aggregate([
    { $match: match },
    { $match: { isSectionHeader: false } },
    { $group: { _id: { filterName: '$filterName', attributeId: '$attributeId' } } },
    { $sort: { '_id.attributeId': 1 } },
  ]);

  const definitions = docs
    .map((d) => ({ filterName: d._id.filterName as string, attributeId: d._id.attributeId as number }))
    .filter((d) => getFieldMapping(d.filterName) !== null);

  // A single real Subcategory can aggregate several legacy categories (see
  // the CategoryFilter model comment above), and each legacy category has
  // its own attribute_id numbering — so the same canonical filterName (e.g.
  // "GRADE") can legitimately come back twice here with two different
  // attributeIds, one per legacy category. Everything downstream (the facet
  // computation's `branches` map, and the group-by-filterName selection
  // object in DynamicCategoryFilters) is keyed on filterName alone and
  // assumes one entry per name, so collapse to a single definition per
  // filterName here rather than surface duplicates as two identical-looking
  // dropdowns (React key collision) that silently fight over the same
  // selection/URL param.
  const seen = new Set<string>();
  const deduped: { filterName: string; attributeId: number }[] = [];
  for (const def of definitions) {
    if (seen.has(def.filterName)) continue;
    seen.add(def.filterName);
    deduped.push(def);
  }

  return deduped;
}

// ─── Live facet counts, self-excluding per filter ─────────────────────────────
// For each applicable filterName, counts are computed against every OTHER
// currently-selected filter (AND) but never the field's own selection, so
// picking "Marquise" under SHAPE doesn't collapse the SHAPE list down to
// just Marquise — exactly the cascading-facet pattern already used by
// buildSimpleFilterFacetsPipeline in productFilter.service.ts.
export async function getCategoryFilterFacets(
  baseQuery: FilterQuery<IProduct>,
  definitions: { filterName: string; attributeId: number }[],
  selection: CategoryFilterSelection
): Promise<CategoryFilterGroup[]> {
  if (definitions.length === 0) return [];

  // Same aggregate()-doesn't-auto-cast issue as getApplicableFilterDefinitions:
  // baseQuery.category/subcategory arrive as plain ObjectId-hex strings
  // (fine for Product.find(), which Mongoose casts) but this function feeds
  // them into a raw Product.aggregate() $match, which does NOT cast — so
  // left as strings, every branch would silently match zero products and
  // every facet group would come back empty. Cast a local copy here without
  // touching the shared baseQuery/buildProductFilterQuery used elsewhere.
  const castScope = (q: FilterQuery<IProduct>): FilterQuery<IProduct> => {
    const out: FilterQuery<IProduct> = { ...q };
    if (typeof out.category === 'string' && mongoose.isValidObjectId(out.category)) {
      out.category = new mongoose.Types.ObjectId(out.category);
    }
    if (typeof out.subcategory === 'string' && mongoose.isValidObjectId(out.subcategory)) {
      out.subcategory = new mongoose.Types.ObjectId(out.subcategory);
    }
    return out;
  };
  baseQuery = castScope(baseQuery);

  const branches: Record<string, object[]> = {};
  const branchMeta: Record<string, FilterFieldMapping> = {};

  // $facet stage names must be valid field-path expressions (no dots, no
  // leading '$', etc.) — Mongo throws "FieldPath field names may not
  // contain '.'" otherwise. filterName values come from admin-entered
  // CategoryFilter documents and can legitimately contain a dot (e.g.
  // "APPROX. NUMBER OF STONES"), so they're unsafe to use directly as
  // facet keys. Use a positional, always-safe key instead and keep a
  // map back to the real filterName for reading results out below.
  const filterNameToFacetKey: Record<string, string> = {};

  for (const [i, def] of definitions.entries()) {
    const mapping = getFieldMapping(def.filterName);
    if (!mapping) continue;

    // Apply every other filterName's selection, never this one's own.
    const otherSelection: CategoryFilterSelection = {};
    for (const [k, v] of Object.entries(selection)) {
      if (k === def.filterName) continue;
      otherSelection[k] = v;
    }
    const scopedQuery = applyCategoryFilterSelection(baseQuery, otherSelection);

    const primaryField = mapping.field.split('|')[0];
    const path = mapping.direct ? primaryField : `legacyAttributes.${primaryField}`;

    // WEIGHT / NUMBER OF STONES map to real numeric Product fields
    // (caratWeight, numberOfStones) — $trim/$toLower only work on strings,
    // so grouping a numeric field through them throws at runtime. Convert
    // numeric fields to a string first instead; string fields keep the
    // existing case/whitespace-insensitive grouping.
    const isNumeric = mapping.kind === 'numeric';
    const groupIdExpr = isNumeric
      ? { $toString: `$${path}` }
      : { $toLower: { $trim: { input: `$${path}` } } };
    const displayExpr = isNumeric ? { $toString: `$${path}` } : `$${path}`;

    const facetKey = `f${i}`;
    filterNameToFacetKey[def.filterName] = facetKey;

    branchMeta[def.filterName] = mapping;
    branches[facetKey] = [
      { $match: scopedQuery },
      { $match: { [path]: { $exists: true, $nin: [null, ''] } } },
      // Group case/whitespace-insensitively so "SI" and "si " count as one
      // option, while keeping the most common original casing for display.
      {
        $group: {
          _id: groupIdExpr,
          count: { $sum: 1 },
          display: { $first: displayExpr },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 500 },
    ];
  }

  if (Object.keys(branches).length === 0) return [];

  const [result] = await Product.aggregate([{ $facet: branches }] as mongoose.PipelineStage[]);

  return definitions
    .filter((def) => branchMeta[def.filterName])
    .map((def) => {
      const rows: { _id: string; count: number; display: string }[] =
        result[filterNameToFacetKey[def.filterName]] || [];
      const mapping = branchMeta[def.filterName];

      // caratWeight is stored as a bare number (0.4, 1, 2…), so the raw
      // $toString display ("0.4") reads as an unlabeled quantity in the
      // dropdown — easy to mistake for something else. Appending the unit
      // here is purely a display concern; the underlying _id used for
      // matching/selection stays the raw number.
      const displaySuffix = DISPLAY_UNIT_SUFFIX[canonicalFilterName(def.filterName)] ?? '';

      // Selections round-trip through the URL as the *displayed* value
      // (see DynamicCategoryFilters, which toggles on option.value), so a
      // selected WEIGHT option now arrives back here as e.g. "0.4 ct."
      // while the facet's own _id is the bare "0.4". For numeric fields,
      // compare by parsed number rather than raw string so re-selecting a
      // suffixed value still highlights correctly; other fields keep the
      // original exact string match.
      const selectedRaw = selection[def.filterName] || [];
      const isNumericField = mapping.kind === 'numeric';
      const selectedNums = isNumericField
        ? selectedRaw.map((v) => extractLeadingNumber(v)).filter((n): n is number => n !== null)
        : [];
      const selectedValues = new Set(selectedRaw.map((v) => v.trim().toLowerCase()));

      const options: CategoryFilterOption[] = rows.map((r) => {
        const selected = isNumericField
          ? selectedNums.some((n) => Math.abs(n - parseFloat(r._id)) < NUMERIC_MATCH_TOLERANCE)
          : selectedValues.has(r._id);
        return {
          value: displaySuffix ? `${r.display}${displaySuffix}` : r.display,
          count: r.count,
          selected,
        };
      });

      // The aggregation above sorts branches by `count desc` purely to keep
      // the $limit:500 cutoff meaningful — that's a frequency ordering, not
      // a display ordering, and it makes filters like WEIGHT/SIZE show
      // their values in an apparently random order (e.g. 1ct, 0.4ct, 2ct).
      // Numeric-ish filters (WEIGHT, SIZE, NUMBER OF STONES, ...) read far
      // better lowest→highest, so re-sort those here using the same
      // leading-number parse already used for numeric matching elsewhere.
      // Purely categorical filters (SHAPE, COLOR, CLARITY, ...) have no
      // natural numeric order, so they're left as-is.
      const parsed = options.map((o) => extractLeadingNumber(o.value));
      const isNumericDisplay = parsed.every((n) => n !== null);
      if (isNumericDisplay) {
        options.sort((a, b) => (extractLeadingNumber(a.value) as number) - (extractLeadingNumber(b.value) as number));
      }

      return { filterName: def.filterName, attributeId: def.attributeId, options };
    })
    .filter((g) => g.options.length > 0);
}