/**
 * Material resolver for the AI PR document parser.
 *
 * The PR PDF gets parsed by Claude into description + qty + unit. We try to
 * match each line against an existing `materials` doc by exact name; on a
 * miss we auto-create a stub record flagged `needsReview: true` so the
 * material reviewer can normalize the spec before the data spreads.
 *
 * Mirrors functions/src/offerParsing/boughtOutResolver.ts in shape and
 * intent. The materials master has more required fields than bought-outs,
 * so the auto-created stub uses placeholder category/grade values that the
 * reviewer must fix.
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export interface ResolveMaterialArgs {
  /** Parsed description from the PDF — used as both name and description. */
  name: string;
  /** Free-text spec/grade/standard from the PDF, if Claude extracted any. */
  specification?: string;
  /** Parsed base unit (NOS, KG, MTR, …). Defaults to NOS on auto-create. */
  baseUnit?: string;
  userId: string;
  tenantId?: string;
}

export type ResolveMaterialResult =
  | { status: 'linked' | 'auto-created'; materialId: string; materialCode: string }
  | { status: 'manual-needed'; reason: string };

const MATERIALS_COLLECTION = 'materials';

/**
 * Find an existing active material by exact (case-insensitive) name.
 * Returns the first hit or null. We keep the query on `name` only — adding
 * isActive/isDeleted as Firestore where-clauses would force a composite
 * index per filter combo — so we filter in memory after a small fetch.
 */
async function findMaterialByName(
  db: admin.firestore.Firestore,
  name: string
): Promise<{ id: string; materialCode: string } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const snap = await db
    .collection(MATERIALS_COLLECTION)
    .where('name', '==', trimmed)
    .limit(5)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data() as {
      isActive?: boolean;
      isMigrated?: boolean;
      isDeleted?: boolean;
      materialCode?: string;
    };
    if (data.isActive === false) continue;
    if (data.isMigrated === true) continue;
    if (data.isDeleted === true) continue;
    return { id: doc.id, materialCode: data.materialCode ?? '' };
  }

  // Fallback to case-insensitive scan over a small window. Useful when the
  // master has "Bolts" and the PDF says "bolts" — exact-match would miss.
  if (snap.empty) {
    const lcSnap = await db
      .collection(MATERIALS_COLLECTION)
      .where('isActive', '==', true)
      .limit(200)
      .get();
    const target = trimmed.toLowerCase();
    for (const doc of lcSnap.docs) {
      const data = doc.data() as {
        name?: string;
        isMigrated?: boolean;
        isDeleted?: boolean;
        materialCode?: string;
      };
      if (data.isMigrated === true || data.isDeleted === true) continue;
      if ((data.name ?? '').trim().toLowerCase() === target) {
        return { id: doc.id, materialCode: data.materialCode ?? '' };
      }
    }
  }

  return null;
}

/**
 * Generate a placeholder material code for auto-created records. Real
 * codes are produced from category + grade by the materials service, but
 * the reviewer will rename when they fill in the spec. `RV-` prefix keeps
 * these visually distinct in lists and pickers until reviewed.
 */
function generateReviewCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RV-${stamp}-${rand}`;
}

export async function resolveMaterial(
  db: admin.firestore.Firestore,
  args: ResolveMaterialArgs
): Promise<ResolveMaterialResult> {
  if (!args.name?.trim()) {
    return { status: 'manual-needed', reason: 'Empty material description' };
  }

  // Try to link to an existing record by name first.
  try {
    const existing = await findMaterialByName(db, args.name);
    if (existing) {
      return { status: 'linked', materialId: existing.id, materialCode: existing.materialCode };
    }
  } catch (err) {
    logger.warn('[materialResolver] Name lookup failed; will auto-create', {
      error: err instanceof Error ? err.message : String(err),
      name: args.name,
    });
  }

  // No match — mint a stub flagged needsReview. The materials reviewer
  // opens the queue (/materials?review=true), normalizes category / grade /
  // baseUnit / specification, and clears the flag.
  const now = admin.firestore.Timestamp.now();
  const code = generateReviewCode();
  const baseUnit = (args.baseUnit ?? 'NOS').trim().toUpperCase() || 'NOS';

  const stub = {
    materialCode: code,
    name: args.name.trim(),
    description: args.name.trim(),
    category: 'OTHER',
    materialType: 'RAW_MATERIAL',
    specification: {
      grade: '',
      ...(args.specification?.trim() ? { standard: args.specification.trim() } : {}),
    },
    properties: {},
    hasVariants: false,
    baseUnit,
    preferredVendors: [],
    priceHistory: [],
    trackInventory: false,
    tags: ['ai-auto-created'],
    isActive: true,
    isStandard: false,
    needsReview: true,
    createdAt: now,
    createdBy: args.userId,
    createdByName: 'AI PR Parser',
    updatedAt: now,
    updatedBy: args.userId,
    ...(args.tenantId && { tenantId: args.tenantId }),
  };

  const newDoc = await db.collection(MATERIALS_COLLECTION).add(stub);
  logger.info('[materialResolver] Auto-created material', {
    materialId: newDoc.id,
    materialCode: code,
    name: args.name,
  });

  return { status: 'auto-created', materialId: newDoc.id, materialCode: code };
}
