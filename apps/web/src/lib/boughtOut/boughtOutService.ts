import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import {
  BoughtOutItem,
  CreateBoughtOutItemInput,
  UpdateBoughtOutItemInput,
  ListBoughtOutItemsOptions,
  ValveSpecs,
  PumpSpecs,
  InstrumentSpecs,
} from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { requirePermission } from '@/lib/auth';
import {
  buildValveSpecCode,
  buildPumpSpecCode,
  nextInstrumentSpecCode,
  BOUGHT_OUT_COLLECTION,
} from './specCode';

const COLLECTIONS = {
  BOUGHT_OUT_ITEMS: BOUGHT_OUT_COLLECTION,
};

/**
 * Build the deterministic spec code for a bought-out item from its
 * structured spec, when the spec is complete enough. Returns undefined
 * if any required attribute is missing — the record is still created
 * (without specCode), but the AI parser won't be able to match against
 * it until a future update fills in the missing fields.
 *
 * Categories without a deterministic format (MOTOR, SAFETY, GAUGE, etc.)
 * also return undefined here.
 */
async function tryBuildSpecCode(
  db: Firestore,
  category: BoughtOutItem['category'],
  specifications: BoughtOutItem['specifications']
): Promise<string | undefined> {
  if (category === 'VALVE') {
    const r = buildValveSpecCode(specifications as ValveSpecs);
    return r.ok ? r.code : undefined;
  }
  if (category === 'PUMP') {
    const r = buildPumpSpecCode(specifications as PumpSpecs);
    return r.ok ? r.code : undefined;
  }
  if (category === 'INSTRUMENT') {
    const inst = specifications as InstrumentSpecs;
    if (!inst.variable || !inst.instrumentType) return undefined;
    return await nextInstrumentSpecCode(db, inst);
  }
  return undefined;
}

/**
 * Create a new bought-out item
 */
export async function createBoughtOutItem(
  db: Firestore,
  input: CreateBoughtOutItemInput,
  userId: string
): Promise<BoughtOutItem> {
  // Generate itemCode: BO-YYYY-NNNN
  const itemCode = await generateBoughtOutItemCode(db);

  // Try to build a deterministic spec code from the structured spec. If
  // the spec is complete enough, the AI quote parser will be able to
  // match this record by code (no duplicates). Manual entries with full
  // specs participate in the same dedup scheme as parser-created ones.
  const specCode = await tryBuildSpecCode(db, input.category, input.specifications);

  const now = Timestamp.now();

  // Build item data with only defined fields to prevent Firestore errors
  // Firestore throws "Unsupported field value: undefined" if any field is undefined
  const item: Record<string, unknown> = {
    // Required fields
    itemCode,
    ...(specCode && { specCode }),
    name: input.name,
    category: input.category,
    tenantId: input.tenantId,
    specifications: input.specifications,
    isActive: true,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,

    // Pricing with lastUpdated - build carefully to avoid undefined values
    pricing: {
      listPrice: input.pricing.listPrice,
      currency: input.pricing.currency,
      lastUpdated: now,
      ...(input.pricing.leadTime !== undefined && { leadTime: input.pricing.leadTime }),
      ...(input.pricing.moq !== undefined && { moq: input.pricing.moq }),
      ...(input.pricing.vendorId && { vendorId: input.pricing.vendorId }),
    },
  };

  // Add optional fields only if they have values
  if (input.description) item.description = input.description;
  if (input.tags && input.tags.length > 0) item.tags = input.tags;
  if (input.attachments) item.attachments = input.attachments;

  const docRef = await addDoc(collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS), item);

  // Re-fetch to get properly typed result
  const createdDoc = await getDoc(docRef);
  return { id: createdDoc.id, ...(createdDoc.data() as Omit<BoughtOutItem, 'id'>) };
}

/**
 * Find an existing bought-out item by spec code, or create a new one.
 * Mirrors the server-side resolver used by the AI quote parser so manual
 * entry shares the same find-or-create behaviour: a 2" SS316 gate valve
 * created here will be matched by the parser the next time the same valve
 * appears on a quote (and vice versa).
 */
export async function findOrCreateBoughtOutBySpec(
  db: Firestore,
  input: CreateBoughtOutItemInput,
  userId: string
): Promise<{ item: BoughtOutItem; created: boolean }> {
  const specCode = await tryBuildSpecCode(db, input.category, input.specifications);
  if (specCode) {
    const existing = await getDocs(
      query(
        collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS),
        where('specCode', '==', specCode),
        limit(1)
      )
    );
    const existingDoc = existing.docs[0];
    if (existingDoc) {
      return {
        item: { id: existingDoc.id, ...(existingDoc.data() as Omit<BoughtOutItem, 'id'>) },
        created: false,
      };
    }
  }
  const item = await createBoughtOutItem(db, input, userId);
  return { item, created: true };
}

/**
 * Get a bought-out item by ID
 */
export async function getBoughtOutItemById(
  db: Firestore,
  itemId: string
): Promise<BoughtOutItem | null> {
  const docRef = doc(db, COLLECTIONS.BOUGHT_OUT_ITEMS, itemId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return { id: docSnap.id, ...(docSnap.data() as Omit<BoughtOutItem, 'id'>) };
}

/**
 * List bought-out items with filtering
 */
export async function listBoughtOutItems(
  db: Firestore,
  options: ListBoughtOutItemsOptions
): Promise<BoughtOutItem[]> {
  let q = query(
    collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS),
    where('tenantId', '==', options.tenantId)
  );

  if (options.category) {
    q = query(q, where('category', '==', options.category));
  }

  if (options.isActive !== undefined) {
    q = query(q, where('isActive', '==', options.isActive));
  }

  // Order by createdAt desc by default
  q = query(q, orderBy('createdAt', 'desc'));

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<BoughtOutItem, 'id'>) }));
}

/**
 * Update a bought-out item
 */
export async function updateBoughtOutItem(
  db: Firestore,
  itemId: string,
  input: UpdateBoughtOutItemInput,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.BOUGHT_OUT_ITEMS, itemId);

  // Build updates object with only defined fields to prevent Firestore errors
  const updates: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  // Add optional fields only if they are defined
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.specifications !== undefined) updates.specifications = input.specifications;
  if (input.attachments !== undefined) updates.attachments = input.attachments;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  // Recompute specCode whenever category or specifications change. A record
  // that gains complete spec data later picks up a code so the AI parser
  // can match against it on subsequent quotes.
  if (input.category !== undefined || input.specifications !== undefined) {
    const existing = await getDoc(docRef);
    const cur = existing.data() as Pick<BoughtOutItem, 'category' | 'specifications'> | undefined;
    if (cur) {
      const newCategory = input.category ?? cur.category;
      const newSpecs = input.specifications ?? cur.specifications;
      const newSpecCode = await tryBuildSpecCode(db, newCategory, newSpecs);
      if (newSpecCode) updates.specCode = newSpecCode;
    }
  }

  if (input.pricing) {
    // Build pricing object carefully to avoid undefined values
    const pricingUpdate: Record<string, unknown> = {
      lastUpdated: Timestamp.now(),
    };
    if (input.pricing.listPrice !== undefined) pricingUpdate.listPrice = input.pricing.listPrice;
    if (input.pricing.currency !== undefined) pricingUpdate.currency = input.pricing.currency;
    if (input.pricing.leadTime !== undefined) pricingUpdate.leadTime = input.pricing.leadTime;
    if (input.pricing.moq !== undefined) pricingUpdate.moq = input.pricing.moq;
    if (input.pricing.vendorId !== undefined) pricingUpdate.vendorId = input.pricing.vendorId;

    updates.pricing = pricingUpdate;
  }

  await updateDoc(docRef, updates);
}

/**
 * Soft delete a bought-out item
 *
 * @param db - Firestore instance
 * @param itemId - Item ID to delete
 * @param userId - User performing the deletion
 * @param userPermissions - User's permission flags
 */
export async function deleteBoughtOutItem(
  db: Firestore,
  itemId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  // rule18-exempt: catalog edit — audit pending Phase 0 audit expansion
  // Authorization: Require MANAGE_ENTITIES permission
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.EDIT_ENTITIES,
    userId,
    'delete bought-out item'
  );

  // Soft delete by setting isActive = false
  await updateDoc(doc(db, COLLECTIONS.BOUGHT_OUT_ITEMS, itemId), {
    isActive: false,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}

/**
 * Generate next item code (BO-YYYY-NNNN)
 */
async function generateBoughtOutItemCode(db: Firestore): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BO-${year}-`;

  // Query for highest number in current year
  const q = query(
    collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS),
    where('itemCode', '>=', prefix),
    where('itemCode', '<', `BO-${year + 1}-`),
    orderBy('itemCode', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let nextNumber = 1;
  if (!snapshot.empty) {
    const docData = snapshot.docs[0]?.data();
    if (docData && typeof docData.itemCode === 'string') {
      const lastCode = docData.itemCode;
      const parts = lastCode.split('-');
      if (parts.length >= 3) {
        const lastNumber = parseInt(parts[2] || '0', 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}
