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

  const match: Record<string, unknown> = scope.subcategoryId
    ? { subcategory: scope.subcategoryId }
    : { category: scope.categoryId, subcategory: { $exists: false } };

  const docs = await CategoryFilter.aggregate([
    { $match: match },
    { $match: { isSectionHeader: false } },
    { $group: { _id: { filterName: '$filterName', attributeId: '$attributeId' } } },
    { $sort: { '_id.attributeId': 1 } },
  ]);

  return docs
    .map((d) => ({ filterName: d._id.filterName as string, attributeId: d._id.attributeId as number }))
    .filter((d) => getFieldMapping(d.filterName) !== null);
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

  const branches: Record<string, object[]> = {};
  const branchMeta: Record<string, FilterFieldMapping> = {};

  for (const def of definitions) {
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

    branchMeta[def.filterName] = mapping;
    branches[def.filterName] = [
      { $match: scopedQuery },
      { $match: { [path]: { $exists: true, $nin: [null, ''] } } },
      // Group case/whitespace-insensitively so "SI" and "si " count as one
      // option, while keeping the most common original casing for display.
      {
        $group: {
          _id: { $toLower: { $trim: { input: `$${path}` } } },
          count: { $sum: 1 },
          display: { $first: `$${path}` },
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
      const rows: { _id: string; count: number; display: string }[] = result[def.filterName] || [];
      const selectedValues = new Set(
        (selection[def.filterName] || []).map((v) => v.trim().toLowerCase())
      );
      const options: CategoryFilterOption[] = rows.map((r) => ({
        value: r.display,
        count: r.count,
        selected: selectedValues.has(r._id),
      }));
      return { filterName: def.filterName, attributeId: def.attributeId, options };
    })
    .filter((g) => g.options.length > 0);
}
