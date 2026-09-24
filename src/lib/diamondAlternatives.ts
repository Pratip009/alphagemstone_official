/**
 * diamondAlternatives.ts — one shared rule for telling diamond
 * alternatives, simulants and lab-created stones apart from natural
 * diamonds and natural gemstones.
 *
 * Why this matters: moissanite (silicon carbide), cubic zirconia and other
 * simulants are not diamonds, and synthetic/simulated colored stones are not
 * natural "semi-precious" gems. Presenting them as such is misleading
 * (see the FTC Jewelry Guides, 16 CFR Part 23). Every place that decides a
 * product's type or category — the importer, the product page, product
 * cards, the compare tool — uses this file so they can never disagree.
 *
 * Keep scripts/fix-diamond-alternatives.mjs in sync with these patterns
 * (it is plain Node and cannot import this file).
 */

export const DIAMOND_ALTERNATIVES_CATEGORY = "Diamond Alternatives";

export const ALTERNATIVE_SUBCATEGORIES = {
  moissanite: "Moissanite",
  cz: "Cubic Zirconia (CZ)",
  simulated: "Simulated Stones",
  labCreated: "Lab-Created Stones",
} as const;

export type AlternativeKind = keyof typeof ALTERNATIVE_SUBCATEGORIES;

const MOISSANITE = /moissanite/i;
const CZ = /\bcz\b|cubic\s+zirconi/i;
const SIMULATED = /simulat|imitation/i;
const LAB_CREATED = /synthetic|lab[-\s]?(created|grown)|\bcreated\b|man[-\s]?made/i;
const DIAMOND = /diamond/i;

/**
 * Classifies free text (product name, gemstone name, category names…).
 * Returns null for natural stones — and for lab-grown DIAMONDS, which are
 * real diamonds (chemically carbon) and belong with diamonds, clearly
 * labeled "lab-grown".
 */
export function classifyAlternative(...texts: (string | null | undefined)[]): AlternativeKind | null {
  const t = texts.filter(Boolean).join(" ");
  if (!t) return null;
  if (MOISSANITE.test(t)) return "moissanite";
  if (CZ.test(t)) return "cz";
  if (SIMULATED.test(t)) return "simulated";
  if (LAB_CREATED.test(t)) return DIAMOND.test(t) ? null : "labCreated";
  return null;
}

/** True for moissanite, CZ, simulated and lab-created (non-diamond) stones. */
export function isDiamondAlternative(...texts: (string | null | undefined)[]): boolean {
  return classifyAlternative(...texts) !== null;
}

/** True when a category name is the Diamond Alternatives category itself. */
export function isAlternativesCategoryName(name?: string | null): boolean {
  return !!name && /alternative|simulant|simulated|moissanite|\bcz\b/i.test(name);
}