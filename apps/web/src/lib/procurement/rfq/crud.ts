/**
 * RFQ CRUD Operations
 *
 * Create, read, and update operations for RFQs
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
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { RFQ, RFQItem, PurchaseRequest, PurchaseRequestItem } from '@vapour/types';
import type { CreateRFQInput, CreateRFQItemInput, UpdateRFQInput } from './types';
import { generateRFQNumber } from './utils';

const logger = createLogger({ context: 'rfqService' });

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
      logger.warn('Failed to fetch project name', { projectId, error: err });
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

  logger.info('RFQ created', { rfqId: rfqRef.id, rfqNumber });

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
 * Update RFQ
 */
export async function updateRFQ(
  rfqId: string,
  input: UpdateRFQInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  const updateData: Record<string, unknown> = {
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

  logger.info('RFQ updated', { rfqId });
}

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

  logger.info('RFQ PDF version generated', { rfqId, pdfVersion: newVersion });
}
