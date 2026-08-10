/**
 * Vendor suggestion by category (feedback A9uW3WWI).
 *
 * Pure matching logic, kept separate from the Firestore reads in
 * `suggestions.ts` so it can be tested without mocking the database.
 *
 * ## What this can and cannot do
 *
 * The request asked for matching down to a bought-out SUB-category — "a Gear
 * Pump should suggest vendors categorised Bought Out Items → Gear Pump/Pump".
 * That is not buildable against the current data: entities carry
 * `vendorCategories` only, with no sub-category field anywhere, and 70 of the
 * 104 categorised vendors are simply "Bought Out Items". Matching a gear pump
 * would therefore return all 70 — no better than the manual list it replaces.
 *
 * So this matches at the level the data actually supports: the PR line's item
 * type narrows the vendor list to the right category, and free-text terms from
 * the line description are matched against `servicesOffered` and the vendor
 * name to rank within it. Sub-category matching becomes possible the moment a
 * sub-category field exists on the entity — the shape here does not need to
 * change, only ITEM_TYPE_CATEGORIES and the term matching.
 */

/** Vendor-side categories, as stored on `entities.vendorCategories`. */
export const VENDOR_CATEGORY = {
  RAW_MATERIALS: 'Raw Materials',
  BOUGHT_OUT: 'Bought Out Items',
} as const;

/**
 * PR line item type -> the vendor categories worth suggesting.
 *
 * SERVICE has no single matching category: the service-ish values in use are
 * Lab Testing, Fabrication, Engineering, Consulting, Inspection, Erection,
 * Maintenance, Transportation and IT Services. All are offered, and the
 * free-text term match below ranks between them.
 */
const ITEM_TYPE_CATEGORIES: Record<string, string[]> = {
  MATERIAL: [VENDOR_CATEGORY.RAW_MATERIALS],
  BOUGHT_OUT: [VENDOR_CATEGORY.BOUGHT_OUT],
  SERVICE: [
    'Lab Testing',
    'Fabrication',
    'Engineering',
    'Consulting',
    'Inspection',
    'Erection',
    'Maintenance',
    'Transportation',
    'IT Services',
  ],
};

export interface CategoryMatchVendor {
  id: string;
  name: string;
  vendorCategories?: string[];
  servicesOffered?: string[];
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface CategoryMatchItem {
  itemType?: string;
  description?: string;
}

export interface CategoryMatch {
  vendorId: string;
  vendorName: string;
  /** Categories that caused the match, for showing the user why. */
  matchedCategories: string[];
  /** Terms from the line descriptions that hit servicesOffered or the name. */
  matchedTerms: string[];
  /** Higher is a better match. Category hits score 1, term hits 2. */
  score: number;
}

/** Words too generic to be worth matching on. */
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'type',
  'size',
  'set',
  'nos',
  'no',
  'of',
  'in',
  'to',
  'as',
  'at',
  'on',
  'material',
  'item',
  'items',
  'supply',
  'required',
  'make',
  'model',
  'grade',
  'class',
  'new',
  'per',
  'mm',
]);

/** Meaningful terms from a line description, lowercased. */
function extractTerms(description: string): string[] {
  return [
    ...new Set(
      description
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    ),
  ];
}

/**
 * Rank vendors against a set of PR line items.
 *
 * Returns only vendors that matched, best first. An empty result means nothing
 * matched — the caller should fall back to the full vendor list rather than
 * showing an empty picker.
 */
export function matchVendorsByCategory(
  vendors: CategoryMatchVendor[],
  items: CategoryMatchItem[]
): CategoryMatch[] {
  const wantedCategories = new Set(
    items.flatMap((item) => ITEM_TYPE_CATEGORIES[item.itemType ?? ''] ?? [])
  );
  const terms = [...new Set(items.flatMap((i) => extractTerms(i.description ?? '')))];

  if (wantedCategories.size === 0 && terms.length === 0) return [];

  const matches: CategoryMatch[] = [];

  for (const vendor of vendors) {
    // Rule 3 / active-only: a deleted or inactive vendor must never be suggested.
    if (vendor.isDeleted || vendor.isActive === false) continue;

    const matchedCategories = (vendor.vendorCategories ?? []).filter((c) =>
      wantedCategories.has(c)
    );

    const haystack = [vendor.name, ...(vendor.servicesOffered ?? [])].join(' ').toLowerCase();
    const matchedTerms = terms.filter((t) => haystack.includes(t));

    if (matchedCategories.length === 0 && matchedTerms.length === 0) continue;

    matches.push({
      vendorId: vendor.id,
      vendorName: vendor.name,
      matchedCategories,
      matchedTerms,
      // Term hits are the more specific signal, so they weigh double.
      score: matchedCategories.length + matchedTerms.length * 2,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.vendorName.localeCompare(b.vendorName));
  return matches;
}

/** One-line explanation of why a vendor was suggested. */
export function describeMatch(match: CategoryMatch): string {
  const parts: string[] = [];
  if (match.matchedCategories.length) parts.push(match.matchedCategories.join(', '));
  if (match.matchedTerms.length) parts.push(`matches "${match.matchedTerms.join('", "')}"`);
  return parts.join(' · ');
}
