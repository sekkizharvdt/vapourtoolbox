/**
 * RFQ (Request for Quotation) Service
 *
 * Handles all RFQ operations:
 * - Create RFQ from approved PRs
 * - Read (list, get by ID)
 * - Update
 * - Issue to vendors
 * - Track offers received
 * - Complete RFQ
 */

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
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { RFQ, RFQItem, RFQStatus, PurchaseRequest, PurchaseRequestItem } from '@vapour/types';

// ============================================================================
// RFQ NUMBER GENERATION
// ============================================================================

/**
 * Generate RFQ number in format: RFQ/YYYY/MM/XXXX
 */
async function generateRFQNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get count of RFQs in current month
  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.RFQS),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let sequence = 1;
  if (!snapshot.empty && snapshot.docs[0]) {
    const lastRFQ = snapshot.docs[0].data() as RFQ;
    const lastNumber = lastRFQ.number;
    const parts = lastNumber.split('/');
    const lastSequenceStr = parts[parts.length - 1];
    const lastSequence = parseInt(lastSequenceStr || '0', 10);
    sequence = lastSequence + 1;
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `RFQ/${year}/${month}/${sequenceStr}`;
}

// ============================================================================
// CREATE RFQ
// ============================================================================

export interface CreateRFQInput {
  // Source PRs
  purchaseRequestIds: string[];

  // Header
  title: string;
  description: string;

  // Vendors invited
  vendorIds: string[];
  vendorNames: string[];

  // Terms and conditions
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  otherTerms?: string[];

  // Timeline
  dueDate: Date;
  validityPeriod?: number; // Days
}

export interface CreateRFQItemInput {
  // Source PR item
  purchaseRequestId: string;
  purchaseRequestItemId: string;

  // Item details (from PR)
  description: string;
  specification?: string;
  quantity: number;
  unit: string;

  // Project and equipment
  projectId: string;
  equipmentId?: string;
  equipmentCode?: string;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery requirements
  requiredBy?: Date;
  deliveryLocation?: string;

  // Item-specific conditions
  conditions?: string;
}

/**
 * Create a new RFQ from approved Purchase Requests
 */
export async function createRFQ(
  input: CreateRFQInput,
  items: CreateRFQItemInput[],
  userId: string,
  userName: string
): Promise<string> {
  const { db } = getFirebase();

  // Validate inputs
  if (!input.title?.trim()) {
    throw new Error('RFQ title is required');
  }

  if (input.purchaseRequestIds.length === 0) {
    throw new Error('At least one Purchase Request is required');
  }

  if (input.vendorIds.length === 0) {
    throw new Error('At least one vendor must be selected');
  }

  if (input.vendorIds.length !== input.vendorNames.length) {
    throw new Error('Vendor IDs and names must match in length');
  }

  if (input.vendorIds.some((id) => !id?.trim())) {
    throw new Error('All vendor IDs must be non-empty');
  }

  if (!input.dueDate || input.dueDate < new Date()) {
    throw new Error('Due date must be in the future');
  }

  if (items.length === 0) {
    throw new Error('At least one item is required');
  }

  // Validate each item has required fields
  items.forEach((item, index) => {
    if (!item.description?.trim()) {
      throw new Error(`Item ${index + 1}: Description is required`);
    }
    if (!item.projectId?.trim()) {
      throw new Error(`Item ${index + 1}: Project ID is required`);
    }
    if (item.quantity <= 0) {
      throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
    }
  });

  // Generate RFQ number
  const rfqNumber = await generateRFQNumber();

  // Extract unique project IDs and names from items
  const projectMap = new Map<string, string>();
  items.forEach((item) => {
    projectMap.set(item.projectId, item.projectId);
  });
  const projectIds = Array.from(projectMap.keys());

  // Fetch project names from Firestore
  const projectNames: string[] = [];
  for (const projectId of projectIds) {
    try {
      const projectDoc = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
      if (projectDoc.exists()) {
        const projectData = projectDoc.data();
        projectNames.push(projectData.name || `Project ${projectId}`);
      } else {
        projectNames.push(`Project ${projectId}`);
      }
    } catch (err) {
      console.warn(`[rfqService] Failed to fetch project name for ${projectId}:`, err);
      projectNames.push(`Project ${projectId}`);
    }
  }

  const now = Timestamp.now();

  // Create RFQ document
  const rfqData: Omit<RFQ, 'id'> = {
    number: rfqNumber,
    purchaseRequestIds: input.purchaseRequestIds,
    projectIds,
    projectNames,
    title: input.title,
    description: input.description,
    vendorIds: input.vendorIds,
    vendorNames: input.vendorNames,
    paymentTerms: input.paymentTerms,
    deliveryTerms: input.deliveryTerms,
    warrantyTerms: input.warrantyTerms,
    otherTerms: input.otherTerms || [],
    dueDate: Timestamp.fromDate(input.dueDate),
    validityPeriod: input.validityPeriod,
    status: 'DRAFT',
    pdfVersion: 1,
    offersReceived: 0,
    offersEvaluated: 0,
    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  };

  const rfqRef = await addDoc(collection(db, COLLECTIONS.RFQS), rfqData);

  // Create RFQ items in batch
  const batch = writeBatch(db);

  items.forEach((item, index) => {
    const itemData: Omit<RFQItem, 'id'> = {
      rfqId: rfqRef.id,
      purchaseRequestId: item.purchaseRequestId,
      purchaseRequestItemId: item.purchaseRequestItemId,
      lineNumber: index + 1,
      description: item.description,
      specification: item.specification,
      quantity: item.quantity,
      unit: item.unit,
      projectId: item.projectId,
      equipmentId: item.equipmentId,
      equipmentCode: item.equipmentCode,
      technicalSpec: item.technicalSpec,
      drawingNumbers: item.drawingNumbers,
      makeModel: item.makeModel,
      requiredBy: item.requiredBy ? Timestamp.fromDate(item.requiredBy) : undefined,
      deliveryLocation: item.deliveryLocation,
      conditions: item.conditions,
      createdAt: now,
      updatedAt: now,
    };

    const itemRef = doc(collection(db, COLLECTIONS.RFQ_ITEMS));
    batch.set(itemRef, itemData);
  });

  await batch.commit();

  console.log('[rfqService] RFQ created:', rfqRef.id, rfqNumber);

  return rfqRef.id;
}

/**
 * Create RFQ from approved Purchase Requests with automatic item extraction
 */
export async function createRFQFromPRs(
  prIds: string[],
  vendorIds: string[],
  vendorNames: string[],
  terms: {
    title: string;
    description: string;
    paymentTerms?: string;
    deliveryTerms?: string;
    warrantyTerms?: string;
    otherTerms?: string[];
    dueDate: Date;
    validityPeriod?: number;
  },
  userId: string,
  userName: string
): Promise<string> {
  const { db } = getFirebase();

  // Fetch all PRs
  const prs: PurchaseRequest[] = [];
  for (const prId of prIds) {
    const prDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId));
    if (prDoc.exists()) {
      prs.push({ id: prDoc.id, ...prDoc.data() } as PurchaseRequest);
    }
  }

  if (prs.length === 0) {
    throw new Error('No valid Purchase Requests found');
  }

  // Fetch all PR items for these PRs
  const allItems: CreateRFQItemInput[] = [];

  for (const pr of prs) {
    const itemsQuery = query(
      collection(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS),
      where('purchaseRequestId', '==', pr.id),
      where('status', '==', 'APPROVED')
    );

    const itemsSnapshot = await getDocs(itemsQuery);

    itemsSnapshot.forEach((itemDoc) => {
      const prItem = { id: itemDoc.id, ...itemDoc.data() } as PurchaseRequestItem;

      allItems.push({
        purchaseRequestId: pr.id,
        purchaseRequestItemId: prItem.id,
        description: prItem.description,
        specification: prItem.specification,
        quantity: prItem.quantity,
        unit: prItem.unit,
        projectId: pr.projectId,
        equipmentId: prItem.equipmentId,
        equipmentCode: prItem.equipmentCode,
        technicalSpec: prItem.technicalSpec,
        drawingNumbers: prItem.drawingNumbers,
        makeModel: prItem.makeModel,
        requiredBy: prItem.requiredBy?.toDate(),
        deliveryLocation: prItem.deliveryLocation,
      });
    });
  }

  if (allItems.length === 0) {
    throw new Error('No approved items found in the selected Purchase Requests');
  }

  // Create RFQ
  const rfqInput: CreateRFQInput = {
    purchaseRequestIds: prIds,
    title: terms.title,
    description: terms.description,
    vendorIds,
    vendorNames,
    paymentTerms: terms.paymentTerms,
    deliveryTerms: terms.deliveryTerms,
    warrantyTerms: terms.warrantyTerms,
    otherTerms: terms.otherTerms,
    dueDate: terms.dueDate,
    validityPeriod: terms.validityPeriod,
  };

  const rfqId = await createRFQ(rfqInput, allItems, userId, userName);

  // Update PRs status to CONVERTED_TO_RFQ
  const batch = writeBatch(db);
  for (const prId of prIds) {
    batch.update(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      status: 'CONVERTED_TO_RFQ',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }
  await batch.commit();

  return rfqId;
}

// ============================================================================
// READ RFQ
// ============================================================================

/**
 * Get RFQ by ID
 */
export async function getRFQById(rfqId: string): Promise<RFQ | null> {
  const { db } = getFirebase();

  const rfqDoc = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));

  if (!rfqDoc.exists()) {
    return null;
  }

  return { id: rfqDoc.id, ...rfqDoc.data() } as RFQ;
}

/**
 * Get RFQ items
 */
export async function getRFQItems(rfqId: string): Promise<RFQItem[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.RFQ_ITEMS),
    where('rfqId', '==', rfqId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RFQItem[];
}

/**
 * List RFQs with optional filters
 */
export interface ListRFQsFilters {
  status?: RFQStatus;
  projectId?: string;
  vendorId?: string;
  createdBy?: string;
  limit?: number;
}

export async function listRFQs(filters: ListRFQsFilters = {}): Promise<RFQ[]> {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.projectId) {
    constraints.push(where('projectIds', 'array-contains', filters.projectId));
  }

  if (filters.vendorId) {
    constraints.push(where('vendorIds', 'array-contains', filters.vendorId));
  }

  if (filters.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.RFQS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RFQ[];
}

// ============================================================================
// UPDATE RFQ
// ============================================================================

export interface UpdateRFQInput {
  title?: string;
  description?: string;
  vendorIds?: string[];
  vendorNames?: string[];
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  otherTerms?: string[];
  dueDate?: Date;
  validityPeriod?: number;
}

/**
 * Update RFQ
 */
export async function updateRFQ(
  rfqId: string,
  input: UpdateRFQInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  const updateData: any = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.vendorIds !== undefined) updateData.vendorIds = input.vendorIds;
  if (input.vendorNames !== undefined) updateData.vendorNames = input.vendorNames;
  if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms;
  if (input.deliveryTerms !== undefined) updateData.deliveryTerms = input.deliveryTerms;
  if (input.warrantyTerms !== undefined) updateData.warrantyTerms = input.warrantyTerms;
  if (input.otherTerms !== undefined) updateData.otherTerms = input.otherTerms;
  if (input.dueDate !== undefined) updateData.dueDate = Timestamp.fromDate(input.dueDate);
  if (input.validityPeriod !== undefined) updateData.validityPeriod = input.validityPeriod;

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), updateData);

  console.log('[rfqService] RFQ updated:', rfqId);
}

// ============================================================================
// RFQ WORKFLOW
// ============================================================================

/**
 * Issue RFQ to vendors
 */
export async function issueRFQ(rfqId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    status: 'ISSUED',
    issueDate: now,
    sentToVendorsAt: now,
    sentBy: userId,
    updatedAt: now,
    updatedBy: userId,
  });

  // TODO: Generate PDF and store URL
  // TODO: Send notifications to procurement manager

  console.log('[rfqService] RFQ issued:', rfqId);
}

/**
 * Update RFQ status when offer is received
 */
export async function incrementOffersReceived(rfqId: string): Promise<void> {
  const { db } = getFirebase();

  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  const newCount = rfq.offersReceived + 1;

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    offersReceived: newCount,
    status: 'OFFERS_RECEIVED',
    updatedAt: Timestamp.now(),
  });

  console.log('[rfqService] Offer received count updated:', rfqId, newCount);
}

/**
 * Update RFQ status when offer is evaluated
 */
export async function incrementOffersEvaluated(rfqId: string): Promise<void> {
  const { db } = getFirebase();

  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  const newCount = rfq.offersEvaluated + 1;
  const status = newCount === rfq.offersReceived ? 'UNDER_EVALUATION' : 'OFFERS_RECEIVED';

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    offersEvaluated: newCount,
    status,
    updatedAt: Timestamp.now(),
  });

  console.log('[rfqService] Offer evaluated count updated:', rfqId, newCount);
}

/**
 * Complete RFQ with selected offer
 */
export async function completeRFQ(
  rfqId: string,
  selectedOfferId: string,
  completionNotes: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    status: 'COMPLETED',
    selectedOfferId,
    completionNotes,
    completedAt: now,
    updatedAt: now,
    updatedBy: userId,
  });

  console.log('[rfqService] RFQ completed:', rfqId, selectedOfferId);
}

/**
 * Cancel RFQ
 */
export async function cancelRFQ(rfqId: string, reason: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    status: 'CANCELLED',
    completionNotes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  console.log('[rfqService] RFQ cancelled:', rfqId);
}

// ============================================================================
// GENERATE PDF VERSION
// ============================================================================

/**
 * Generate new PDF version for RFQ (for revisions)
 */
export async function generateRFQPDFVersion(rfqId: string, pdfUrl: string): Promise<void> {
  const { db } = getFirebase();

  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  const newVersion = rfq.pdfVersion + 1;

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    pdfVersion: newVersion,
    latestPdfUrl: pdfUrl,
    updatedAt: Timestamp.now(),
  });

  console.log('[rfqService] RFQ PDF version generated:', rfqId, newVersion);
}
