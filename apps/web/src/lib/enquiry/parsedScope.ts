/**
 * Helpers for the AI parser's scope output.
 *
 * Turns the parser's `scope: ParsedScopeCategory[]` array into a full
 * `UnifiedScopeMatrix` (the shape used on enquiries and proposals), with
 * every item tagged `source: 'AI_PARSED'` and `included: true`.
 *
 * Also merges fresh parses into an existing matrix without losing manual
 * edits (used by the "Read with AI" re-parse flow on existing enquiries).
 */

import type {
  ScopeCategoryEntry,
  ScopeCategoryKey,
  ScopeItemClassification,
  UnifiedScopeItem,
  UnifiedScopeMatrix,
} from '@vapour/types';
import { SCOPE_CATEGORY_DEFAULTS } from '@vapour/types';

export interface ParsedScopeItem {
  name: string;
  description?: string;
  classification: ScopeItemClassification;
  quantity?: number;
  unit?: string;
}

export interface ParsedScopeCategory {
  categoryKey: ScopeCategoryKey;
  items: ParsedScopeItem[];
}

const newId = (): string => Math.random().toString(36).slice(2, 11);

/**
 * Convert a parser response into a fresh UnifiedScopeMatrix.
 * Categories appear in the order the parser returned them.
 */
export function parsedScopeToMatrix(scope: ParsedScopeCategory[]): UnifiedScopeMatrix {
  const categories: ScopeCategoryEntry[] = scope.map((c, catIdx) => {
    const defaults = SCOPE_CATEGORY_DEFAULTS[c.categoryKey];
    const items: UnifiedScopeItem[] = c.items.map((it, idx) => ({
      id: newId(),
      itemNumber: `${catIdx + 1}.${idx + 1}`,
      name: it.name,
      ...(it.description && { description: it.description }),
      classification: it.classification,
      included: true,
      source: 'AI_PARSED' as const,
      ...(it.quantity !== undefined && { quantity: it.quantity }),
      ...(it.unit && { unit: it.unit }),
      order: idx,
    }));
    return {
      id: newId(),
      categoryKey: c.categoryKey,
      label: defaults.label,
      displayType: defaults.displayType,
      ...(defaults.activityTemplate && { activityTemplate: defaults.activityTemplate }),
      items,
      order: catIdx,
    };
  });
  return { categories };
}

/**
 * Merge a fresh parse into an existing matrix.
 *
 * Rules:
 *  - Any item the user has manually added (source !== 'AI_PARSED') stays untouched.
 *  - For AI-parsed items: dedupe by lowercase trimmed name within the same
 *    category. Items already present keep whatever included/exclusionReason
 *    state the user has set; new items are appended as included.
 *  - New AI-parsed categories are appended after existing ones.
 */
export function mergeParsedScopeIntoMatrix(
  existing: UnifiedScopeMatrix | undefined,
  fresh: ParsedScopeCategory[]
): { matrix: UnifiedScopeMatrix; addedItems: number; addedCategories: number } {
  if (!existing || existing.categories.length === 0) {
    const matrix = parsedScopeToMatrix(fresh);
    return {
      matrix,
      addedItems: matrix.categories.reduce((s, c) => s + c.items.length, 0),
      addedCategories: matrix.categories.length,
    };
  }

  const next: ScopeCategoryEntry[] = existing.categories.map((c) => ({
    ...c,
    items: [...c.items],
  }));
  let addedItems = 0;
  let addedCategories = 0;

  for (const fc of fresh) {
    let cat = next.find((c) => c.categoryKey === fc.categoryKey);
    if (!cat) {
      const defaults = SCOPE_CATEGORY_DEFAULTS[fc.categoryKey];
      cat = {
        id: newId(),
        categoryKey: fc.categoryKey,
        label: defaults.label,
        displayType: defaults.displayType,
        ...(defaults.activityTemplate && { activityTemplate: defaults.activityTemplate }),
        items: [],
        order: next.length,
      };
      next.push(cat);
      addedCategories += 1;
    }

    const seen = new Set(cat.items.map((i) => i.name.trim().toLowerCase()));
    for (const it of fc.items) {
      const key = it.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      cat.items.push({
        id: newId(),
        itemNumber: `${(cat.order ?? 0) + 1}.${cat.items.length + 1}`,
        name: it.name,
        ...(it.description && { description: it.description }),
        classification: it.classification,
        included: true,
        source: 'AI_PARSED',
        ...(it.quantity !== undefined && { quantity: it.quantity }),
        ...(it.unit && { unit: it.unit }),
        order: cat.items.length,
      });
      addedItems += 1;
    }
  }

  return { matrix: { categories: next }, addedItems, addedCategories };
}
