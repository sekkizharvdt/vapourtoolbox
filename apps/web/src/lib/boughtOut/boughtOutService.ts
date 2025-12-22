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
  PermissionFlag,
} from '@vapour/types';
import { requirePermission } from '@/lib/auth';

const COLLECTIONS = {
  BOUGHT_OUT_ITEMS: 'bought_out_items',
};

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

  const now = Timestamp.now();

  // Build item data with only defined fields to prevent Firestore errors
  // Firestore throws "Unsupported field value: undefined" if any field is undefined
  const item: Record<string, unknown> = {
    // Required fields
    itemCode,
    name: input.name,
    category: input.category,
    entityId: input.entityId,
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
    where('entityId', '==', options.entityId)
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
  // Authorization: Require MANAGE_ENTITIES permission
  requirePermission(
    userPermissions,
    PermissionFlag.MANAGE_ENTITIES,
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
