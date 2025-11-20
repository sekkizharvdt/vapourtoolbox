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
} from '@vapour/types';

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
  const item: Omit<BoughtOutItem, 'id'> = {
    ...input,
    itemCode,
    pricing: {
      ...input.pricing,
      lastUpdated: now,
    },
    isActive: true,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS), item);
  return { id: docRef.id, ...item };
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

  const updates: Record<string, any> = {
    ...input,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (input.pricing) {
    updates.pricing = {
      ...input.pricing,
      lastUpdated: Timestamp.now(),
    };
  }

  await updateDoc(docRef, updates);
}

/**
 * Soft delete a bought-out item
 */
export async function deleteBoughtOutItem(
  db: Firestore,
  itemId: string,
  userId: string
): Promise<void> {
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
