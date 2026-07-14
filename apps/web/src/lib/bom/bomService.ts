/**
 * BOM (Bill of Materials) Service
 *
 * Provides CRUD operations for BOMs and BOM items with automatic
 * cost calculation, hierarchical numbering, and summary aggregation.
 *
 * Week 1 Sprint - Core functionality only (DRAFT status, material cost only)
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  deleteField,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  BOM,
  BOMItem,
  BOMStatus,
  BOMCategory,
  CreateBOMInput,
  UpdateBOMItemInput,
  CreateBOMItemInput,
  BOMSummary,
  OverheadApplicability,
} from '@vapour/types';
import { getActiveCostConfiguration } from './costConfig';

const logger = createLogger({ context: 'bomService' });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate BOM code in format: EST-YYYY-NNNN
 */
export async function generateBOMCode(db: Firestore): Promise<string> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION
  const year = new Date().getFullYear();
  const yearStr = year.toString();

  // Counter doc that holds the highest sequence used this year. The
  // transaction guarantees no two concurrent BOM creations get the same
  // sequence — without it, both readers would see the same value and the
  // second writer would silently overwrite.
  const counterRef = doc(db, COLLECTIONS.COUNTERS || 'counters', `bom-${yearStr}`);

  try {
    const sequence = await runTransaction(db, async (tx) => {
      const counterDoc = await tx.get(counterRef);
      const next = ((counterDoc.exists() ? counterDoc.data()?.value : 0) || 0) + 1;
      tx.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return next;
    });

    return `EST-${yearStr}-${sequence.toString().padStart(4, '0')}`;
  } catch (error) {
    // BP-14: Fallback with UUID for guaranteed uniqueness
    logger.warn('Counter document failed, using UUID fallback', { error });
    return `EST-${yearStr}-${crypto.randomUUID().slice(0, 8)}`;
  }
}

/**
 * Generate hierarchical item number
 * Examples: "1", "1.1", "1.2", "1.2.1"
 */
async function generateItemNumber(
  db: Firestore,
  bomId: string,
  parentItemId?: string
): Promise<{ itemNumber: string; level: number; sortOrder: number }> {
  const itemsRef = collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS);

  if (!parentItemId) {
    // Root level item - find highest number
    const q = query(
      itemsRef,
      where('level', '==', 0),
      orderBy('sortOrder', 'desc'),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);
    const lastItemData = snapshot.empty ? null : snapshot.docs[0]?.data();
    const lastItem = lastItemData ? (lastItemData as BOMItem) : null;
    const nextNumber = lastItem ? (lastItem.sortOrder || 0) + 1 : 1;

    return {
      itemNumber: nextNumber.toString(),
      level: 0,
      sortOrder: nextNumber,
    };
  } else {
    // Child item - find parent and increment
    const parentDoc = await getDoc(doc(itemsRef, parentItemId));
    if (!parentDoc.exists()) {
      throw new Error('Parent item not found');
    }

    const parentData = parentDoc.data() as BOMItem;
    const parentNumber = parentData.itemNumber;
    const parentLevel = parentData.level;

    // Find siblings
    const q = query(
      itemsRef,
      where('parentItemId', '==', parentItemId),
      orderBy('sortOrder', 'desc'),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);
    const lastSiblingData = snapshot.empty ? null : snapshot.docs[0]?.data();
    const lastSibling = lastSiblingData ? (lastSiblingData as BOMItem) : null;
    const nextSibling = lastSibling ? (lastSibling.sortOrder || 0) + 1 : 1;

    return {
      itemNumber: `${parentNumber}.${nextSibling}`,
      level: parentLevel + 1,
      sortOrder: nextSibling,
    };
  }
}

// ============================================================================
// BOM CRUD Operations
// ============================================================================

/**
 * Create a new BOM
 */
export async function createBOM(
  db: Firestore,
  input: CreateBOMInput,
  userId: string
): Promise<BOM> {
  // rule8-exempt: sets the initial status on a brand-new document (no prior state to transition from) — state-machine validation only applies to transitions, not first-write
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    logger.info('Creating BOM', { name: input.name, category: input.category });

    const bomCode = await generateBOMCode(db);
    const now = Timestamp.now();

    const bomData: Omit<BOM, 'id'> = {
      bomCode,
      name: input.name,
      description: input.description,
      category: input.category,
      tenantId: input.tenantId,
      projectId: input.projectId,
      projectName: input.projectName,
      // Proposal/Enquiry linkage for traceability
      proposalId: input.proposalId,
      proposalNumber: input.proposalNumber,
      enquiryId: input.enquiryId,
      enquiryNumber: input.enquiryNumber,
      summary: {
        totalWeight: 0,
        totalMaterialCost: { amount: 0, currency: 'INR' },
        totalFabricationCost: { amount: 0, currency: 'INR' },
        totalServiceCost: { amount: 0, currency: 'INR' }, // Phase 3
        totalDirectCost: { amount: 0, currency: 'INR' }, // Phase 4
        overhead: { amount: 0, currency: 'INR' }, // Phase 4
        contingency: { amount: 0, currency: 'INR' }, // Phase 4
        profit: { amount: 0, currency: 'INR' }, // Phase 4
        totalCost: { amount: 0, currency: 'INR' },
        itemCount: 0,
        currency: 'INR',
      },
      status: 'DRAFT' as BOMStatus,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    // Remove undefined values before sending to Firestore
    const cleanedBomData = Object.fromEntries(
      Object.entries(bomData).filter(([, value]) => value !== undefined)
    ) as Omit<BOM, 'id'>;

    const docRef = await addDoc(collection(db, COLLECTIONS.BOMS), cleanedBomData);

    logger.info('BOM created successfully', { id: docRef.id, bomCode });

    return {
      id: docRef.id,
      ...bomData,
    };
  } catch (error) {
    logger.error('Error creating BOM', { error });
    throw error;
  }
}

/**
 * Get BOM by ID
 */
export async function getBOMById(db: Firestore, bomId: string): Promise<BOM | null> {
  try {
    const bomRef = doc(db, COLLECTIONS.BOMS, bomId);
    const bomDoc = await getDoc(bomRef);

    if (!bomDoc.exists()) {
      return null;
    }

    return docToTyped<BOM>(bomDoc.id, bomDoc.data());
  } catch (error) {
    logger.error('Error getting BOM', { bomId, error });
    throw error;
  }
}

/**
 * Update BOM
 */
export async function updateBOM(
  db: Firestore,
  bomId: string,
  updates: Partial<Omit<BOM, 'id' | 'bomCode' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<void> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    logger.info('Updating BOM', { bomId, updates });

    const bomRef = doc(db, COLLECTIONS.BOMS, bomId);

    await updateDoc(bomRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('BOM updated successfully', { bomId });
  } catch (error) {
    logger.error('Error updating BOM', { bomId, error });
    throw error;
  }
}

/**
 * Delete BOM (and all items)
 */
export async function deleteBOM(db: Firestore, bomId: string): Promise<void> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    logger.info('Deleting BOM', { bomId });

    // Delete all items first
    const itemsRef = collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS);
    const itemsSnapshot = await getDocs(itemsRef);

    const batch = writeBatch(db);

    // Delete all items
    itemsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete BOM document
    batch.delete(doc(db, COLLECTIONS.BOMS, bomId));

    await batch.commit();

    logger.info('BOM deleted successfully', { bomId });
  } catch (error) {
    logger.error('Error deleting BOM', { bomId, error });
    throw error;
  }
}

/**
 * List BOMs with filters
 */
export async function listBOMs(
  db: Firestore,
  options: {
    tenantId: string;
    projectId?: string;
    category?: BOMCategory;
    status?: BOMStatus;
    limit?: number;
  }
): Promise<BOM[]> {
  if (!options.tenantId) {
    throw new Error('tenantId is required to list BOMs');
  }

  try {
    logger.info('Listing BOMs', options);

    const bomsRef = collection(db, COLLECTIONS.BOMS);
    let q = query(bomsRef, where('tenantId', '==', options.tenantId));

    if (options.projectId) {
      q = query(q, where('projectId', '==', options.projectId));
    }

    if (options.category) {
      q = query(q, where('category', '==', options.category));
    }

    if (options.status) {
      q = query(q, where('status', '==', options.status));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    if (options.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BOM[];
  } catch (error) {
    logger.error('Error listing BOMs', { options, error });
    throw error;
  }
}

/**
 * Stamp the proposal back-link on a BOM (rule 26 denormalization — the BOM
 * editor shows "Linked to proposal <number>" from these fields).
 * Idempotent: re-linking simply rewrites the same values.
 */
export async function setBOMProposalLink(
  db: Firestore,
  bomId: string,
  link: { proposalId: string; proposalNumber?: string },
  userId: string
): Promise<void> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    const bomRef = doc(db, COLLECTIONS.BOMS, bomId);
    await updateDoc(bomRef, {
      proposalId: link.proposalId,
      // Conditional value — Firestore rejects `undefined` (rule 12).
      proposalNumber: link.proposalNumber ?? deleteField(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    logger.info('BOM proposal link set', { bomId, proposalId: link.proposalId });
  } catch (error) {
    logger.error('Error setting BOM proposal link', { bomId, error });
    throw error;
  }
}

/**
 * Clear the proposal back-link on a BOM, but only if it still points at
 * `proposalId` — a BOM re-linked to a different proposal in the meantime is
 * left untouched. Transaction per rule 19 (conditional read-modify-write).
 */
export async function clearBOMProposalLink(
  db: Firestore,
  bomId: string,
  proposalId: string,
  userId: string
): Promise<void> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    const bomRef = doc(db, COLLECTIONS.BOMS, bomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(bomRef);
      if (!snap.exists()) return; // BOM deleted — nothing to clear
      if ((snap.data() as BOM).proposalId !== proposalId) return; // points elsewhere — leave it
      tx.update(bomRef, {
        proposalId: deleteField(),
        proposalNumber: deleteField(),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    });
    logger.info('BOM proposal link cleared', { bomId, proposalId });
  } catch (error) {
    logger.error('Error clearing BOM proposal link', { bomId, error });
    throw error;
  }
}

/**
 * Create a BOM together with a flat list of items in one call (thermal → BOM
 * export and future bulk imports). Items get sequential root-level numbers
 * ("1", "2", ...) in input order; batches are chunked at 500 ops (rule 20).
 * The summary is recalculated once at the end (costs are computed separately
 * via calculateAllItemCosts — same as the editor's flow).
 */
export async function createBOMWithItems(
  db: Firestore,
  input: CreateBOMInput,
  itemInputs: CreateBOMItemInput[],
  userId: string
): Promise<{ bom: BOM; itemIds: string[] }> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    logger.info('Creating BOM with items', { name: input.name, itemCount: itemInputs.length });

    const bom = await createBOM(db, input, userId);
    const itemsRef = collection(db, COLLECTIONS.BOMS, bom.id, COLLECTIONS.BOM_ITEMS);
    const now = Timestamp.now();
    const itemIds: string[] = [];

    // Chunk batches at 500 operations (rule 20).
    for (let start = 0; start < itemInputs.length; start += 500) {
      const batch = writeBatch(db);
      const slice = itemInputs.slice(start, start + 500);

      slice.forEach((item, offset) => {
        const index = start + offset;
        const itemRef = doc(itemsRef);
        itemIds.push(itemRef.id);

        // Same document shape as addBOMItem (single source of conventions).
        const itemData: Omit<BOMItem, 'id'> = {
          bomId: bom.id,
          itemNumber: (index + 1).toString(),
          itemType: item.itemType,
          level: 0,
          sortOrder: index + 1,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          component:
            item.shapeId || item.materialId || item.boughtOutItemId || item.componentType
              ? {
                  type: item.componentType || 'SHAPE',
                  // Conditional spreads — Firestore rejects nested `undefined` (rule 12).
                  ...(item.shapeId !== undefined && { shapeId: item.shapeId }),
                  ...(item.materialId !== undefined && { materialId: item.materialId }),
                  ...(item.parameters !== undefined && { parameters: item.parameters }),
                  ...(item.boughtOutItemId !== undefined && {
                    boughtOutItemId: item.boughtOutItemId,
                  }),
                  ...(item.catalogRef !== undefined && { catalogRef: item.catalogRef }),
                }
              : undefined,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        };

        const cleanedItemData = Object.fromEntries(
          Object.entries(itemData).filter(([, value]) => value !== undefined)
        );

        batch.set(itemRef, cleanedItemData);
      });

      await batch.commit();
    }

    // One summary pass for the whole import (itemCount, weights; costs land
    // after calculateAllItemCosts).
    await recalculateBOMSummary(db, bom.id, userId);

    logger.info('BOM with items created', { bomId: bom.id, itemCount: itemIds.length });
    return { bom, itemIds };
  } catch (error) {
    logger.error('Error creating BOM with items', { name: input.name, error });
    throw error;
  }
}

// ============================================================================
// BOM Item CRUD Operations
// ============================================================================

/**
 * Add item to BOM
 */
export async function addBOMItem(
  db: Firestore,
  bomId: string,
  input: CreateBOMItemInput,
  userId: string
): Promise<BOMItem> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    logger.info('Adding BOM item', { bomId, name: input.name });

    // Generate hierarchical item number
    const { itemNumber, level, sortOrder } = await generateItemNumber(
      db,
      bomId,
      input.parentItemId
    );

    const now = Timestamp.now();

    const itemData: Omit<BOMItem, 'id'> = {
      bomId,
      itemNumber,
      itemType: input.itemType,
      parentItemId: input.parentItemId,
      level,
      sortOrder,
      name: input.name,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      component:
        input.shapeId || input.materialId || input.boughtOutItemId || input.componentType
          ? {
              type: input.componentType || 'SHAPE', // Default to SHAPE for backward compatibility
              // Conditional spreads — Firestore rejects nested `undefined` (rule 12).
              ...(input.shapeId !== undefined && { shapeId: input.shapeId }),
              ...(input.materialId !== undefined && { materialId: input.materialId }),
              ...(input.parameters !== undefined && { parameters: input.parameters }),
              ...(input.boughtOutItemId !== undefined && {
                boughtOutItemId: input.boughtOutItemId,
              }),
              ...(input.catalogRef !== undefined && { catalogRef: input.catalogRef }),
            }
          : undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    // Remove undefined values before sending to Firestore
    const cleanedItemData = Object.fromEntries(
      Object.entries(itemData).filter(([, value]) => value !== undefined)
    );

    const itemsRef = collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS);
    const docRef = await addDoc(itemsRef, cleanedItemData);

    logger.info('BOM item added successfully', { id: docRef.id, itemNumber });

    // Recalculate BOM summary
    await recalculateBOMSummary(db, bomId, userId);

    return {
      id: docRef.id,
      ...itemData,
    };
  } catch (error) {
    logger.error('Error adding BOM item', { bomId, error });
    throw error;
  }
}

/**
 * Update BOM item
 */
export async function updateBOMItem(
  db: Firestore,
  bomId: string,
  itemId: string,
  updates: UpdateBOMItemInput,
  userId: string
): Promise<void> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  // rule19-exempt: edit form on a single BOM item — read fetches current values for diffing/audit; last-write-wins acceptable for user-driven edits
  try {
    logger.info('Updating BOM item', { bomId, itemId, updates });

    const itemRef = doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, itemId);

    const updateData: Partial<BOMItem> = {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Handle component updates
    if (
      updates.componentType !== undefined ||
      updates.shapeId !== undefined ||
      updates.materialId !== undefined ||
      updates.parameters !== undefined
    ) {
      const currentDoc = await getDoc(itemRef);
      const currentData = currentDoc.data() as BOMItem;

      updateData.component = {
        ...currentData.component,
        type: updates.componentType ?? currentData.component?.type ?? 'SHAPE',
        shapeId: updates.shapeId ?? currentData.component?.shapeId,
        materialId: updates.materialId ?? currentData.component?.materialId,
        parameters: updates.parameters ?? currentData.component?.parameters,
      };
    }

    await updateDoc(itemRef, updateData);

    logger.info('BOM item updated successfully', { bomId, itemId });

    // Recalculate BOM summary
    await recalculateBOMSummary(db, bomId, userId);
  } catch (error) {
    logger.error('Error updating BOM item', { bomId, itemId, error });
    throw error;
  }
}

/**
 * Delete BOM item
 */
export async function deleteBOMItem(
  db: Firestore,
  bomId: string,
  itemId: string,
  userId: string
): Promise<void> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    logger.info('Deleting BOM item', { bomId, itemId });

    // Delete item and all children
    const itemsRef = collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS);
    const childrenQuery = query(itemsRef, where('parentItemId', '==', itemId));
    const childrenSnapshot = await getDocs(childrenQuery);

    // rule20-exempt: each recursive call has its own batch with a single delete;
    // the `for` loop does not write to this batch.
    const batch = writeBatch(db);

    // Delete children recursively
    for (const child of childrenSnapshot.docs) {
      await deleteBOMItem(db, bomId, child.id, userId);
    }

    // Delete the item itself
    batch.delete(doc(itemsRef, itemId));

    await batch.commit();

    logger.info('BOM item deleted successfully', { bomId, itemId });

    // Recalculate BOM summary
    await recalculateBOMSummary(db, bomId, userId);
  } catch (error) {
    logger.error('Error deleting BOM item', { bomId, itemId, error });
    throw error;
  }
}

/**
 * Get all items for a BOM
 */
export async function getBOMItems(db: Firestore, bomId: string): Promise<BOMItem[]> {
  try {
    const itemsRef = collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS);
    const q = query(itemsRef, orderBy('itemNumber', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BOMItem[];
  } catch (error) {
    logger.error('Error getting BOM items', { bomId, error });
    throw error;
  }
}

// ============================================================================
// Summary Calculation
// ============================================================================

/**
 * Recalculate BOM summary from all items
 */
export async function recalculateBOMSummary(
  db: Firestore,
  bomId: string,
  userId: string
): Promise<BOMSummary> {
  try {
    logger.info('Recalculating BOM summary', { bomId });

    // Get BOM to retrieve tenantId for cost configuration
    const bom = await getBOMById(db, bomId);
    if (!bom) {
      throw new Error(`BOM not found: ${bomId}`);
    }

    const items = await getBOMItems(db, bomId);

    // Determine currency from first item with cost, default to INR
    let currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD' | 'AED' = 'INR';
    const firstItemWithCost = items.find((item) => item.cost?.totalMaterialCost);
    if (firstItemWithCost?.cost?.totalMaterialCost) {
      currency = firstItemWithCost.cost.totalMaterialCost.currency;
    }

    const summary: BOMSummary = {
      totalWeight: 0,
      totalMaterialCost: { amount: 0, currency },
      totalFabricationCost: { amount: 0, currency },
      totalServiceCost: { amount: 0, currency }, // Phase 3: Service costs
      totalDirectCost: { amount: 0, currency }, // Phase 4: Direct costs
      overhead: { amount: 0, currency }, // Phase 4: Overhead
      contingency: { amount: 0, currency }, // Phase 4: Contingency
      profit: { amount: 0, currency }, // Phase 4: Profit
      totalCost: { amount: 0, currency },
      itemCount: items.length,
      currency,
    };

    // Sum up all items
    for (const item of items) {
      if (item.calculatedProperties?.totalWeight) {
        summary.totalWeight += item.calculatedProperties.totalWeight;
      }
      if (item.cost?.totalMaterialCost) {
        summary.totalMaterialCost.amount += item.cost.totalMaterialCost.amount;
      }
      if (item.cost?.totalFabricationCost) {
        summary.totalFabricationCost.amount += item.cost.totalFabricationCost.amount;
      }
      // Phase 3: Aggregate service costs
      if (item.cost?.totalServiceCost) {
        summary.totalServiceCost.amount += item.cost.totalServiceCost.amount;
      }
    }

    // Phase 4: Calculate Direct Cost (Material + Fabrication + Service)
    summary.totalDirectCost.amount =
      summary.totalMaterialCost.amount +
      summary.totalFabricationCost.amount +
      summary.totalServiceCost.amount;

    // Phase 4: Fetch active cost configuration and apply indirect costs
    const costConfig = await getActiveCostConfiguration(db, bom.tenantId);

    if (costConfig) {
      // Store cost config reference for audit trail
      summary.costConfigId = costConfig.id;
      summary.lastCalculated = Timestamp.now();

      // BP-12: Validate rate percentages before calculations
      const rates = [
        { name: 'overhead', value: costConfig.overhead.ratePercent },
        { name: 'contingency', value: costConfig.contingency.ratePercent },
        { name: 'profit', value: costConfig.profit.ratePercent },
      ];
      for (const rate of rates) {
        if (!Number.isFinite(rate.value) || rate.value < 0 || rate.value > 100) {
          throw new Error(`Invalid ${rate.name} rate: ${rate.value}%. Must be 0-100.`);
        }
      }

      // Step 1: Calculate Overhead
      if (costConfig.overhead.enabled && costConfig.overhead.ratePercent > 0) {
        let overheadBaseCost = 0;

        switch (costConfig.overhead.applicableTo as OverheadApplicability) {
          case 'MATERIAL':
            overheadBaseCost = summary.totalMaterialCost.amount;
            break;
          case 'FABRICATION':
            overheadBaseCost = summary.totalFabricationCost.amount;
            break;
          case 'SERVICE':
            overheadBaseCost = summary.totalServiceCost.amount;
            break;
          case 'ALL':
          default:
            overheadBaseCost = summary.totalDirectCost.amount;
            break;
        }

        summary.overhead.amount = (overheadBaseCost * costConfig.overhead.ratePercent) / 100;
        // BP-12: Validate calculation result
        if (!Number.isFinite(summary.overhead.amount) || summary.overhead.amount < 0) {
          throw new Error(`Invalid overhead calculation: ${summary.overhead.amount}`);
        }
      }

      // Step 2: Calculate Contingency (applied to Direct + Overhead)
      if (costConfig.contingency.enabled && costConfig.contingency.ratePercent > 0) {
        const contingencyBaseCost = summary.totalDirectCost.amount + summary.overhead.amount;
        summary.contingency.amount =
          (contingencyBaseCost * costConfig.contingency.ratePercent) / 100;
        // BP-12: Validate calculation result
        if (!Number.isFinite(summary.contingency.amount) || summary.contingency.amount < 0) {
          throw new Error(`Invalid contingency calculation: ${summary.contingency.amount}`);
        }
      }

      // Calculate subtotal (Direct + Overhead + Contingency)
      const subtotal =
        summary.totalDirectCost.amount + summary.overhead.amount + summary.contingency.amount;

      // Step 3: Calculate Profit (applied to subtotal)
      if (costConfig.profit.enabled && costConfig.profit.ratePercent > 0) {
        summary.profit.amount = (subtotal * costConfig.profit.ratePercent) / 100;
        // BP-12: Validate calculation result
        if (!Number.isFinite(summary.profit.amount) || summary.profit.amount < 0) {
          throw new Error(`Invalid profit calculation: ${summary.profit.amount}`);
        }
      }

      // Final Total Cost
      summary.totalCost.amount = subtotal + summary.profit.amount;
      // BP-12: Validate final total
      if (!Number.isFinite(summary.totalCost.amount) || summary.totalCost.amount < 0) {
        throw new Error(`Invalid total cost calculation: ${summary.totalCost.amount}`);
      }
    } else {
      // No cost configuration - total cost is just direct costs
      summary.totalCost.amount = summary.totalDirectCost.amount;
      logger.warn('No active cost configuration found for entity', {
        tenantId: bom.tenantId,
        bomId,
      });
    }

    // Update BOM document
    await updateBOM(db, bomId, { summary }, userId);

    logger.info('BOM summary recalculated', { bomId, summary });

    return summary;
  } catch (error) {
    logger.error('Error recalculating BOM summary', { bomId, error });
    throw error;
  }
}
