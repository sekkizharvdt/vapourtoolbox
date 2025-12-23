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
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import {
  validateString,
  validateNumber,
  validateArray,
  validateFields,
  assertValid,
  MAX_LENGTHS,
  sanitizeString,
} from '@/lib/utils/inputValidation';

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

  // Validate inputs with proper length limits and sanitization
  const validationResult = validateFields({
    title: {
      value: input.title,
      validator: (v) =>
        validateString(v, 'Title', { required: true, maxLength: MAX_LENGTHS.SHORT_TEXT }),
    },
    description: {
      value: input.description,
      validator: (v) =>
        validateString(v, 'Description', { required: false, maxLength: MAX_LENGTHS.LONG_TEXT }),
    },
    paymentTerms: {
      value: input.paymentTerms,
      validator: (v) =>
        validateString(v, 'Payment Terms', { required: false, maxLength: MAX_LENGTHS.MEDIUM_TEXT }),
    },
    deliveryTerms: {
      value: input.deliveryTerms,
      validator: (v) =>
        validateString(v, 'Delivery Terms', {
          required: false,
          maxLength: MAX_LENGTHS.MEDIUM_TEXT,
        }),
    },
  });

  assertValid(validationResult);

  // Sanitize text fields
  const sanitizedInput = {
    ...input,
    title: sanitizeString(input.title),
    description: sanitizeString(input.description),
    paymentTerms: input.paymentTerms ? sanitizeString(input.paymentTerms) : undefined,
    deliveryTerms: input.deliveryTerms ? sanitizeString(input.deliveryTerms) : undefined,
  };

  // Validate array fields
  const prValidation = validateArray(input.purchaseRequestIds, 'Purchase Requests', {
    required: true,
    minLength: 1,
    maxLength: 50,
  });
  assertValid(prValidation);

  const vendorValidation = validateArray(input.vendorIds, 'Vendors', {
    required: true,
    minLength: 1,
    maxLength: 20,
  });
  assertValid(vendorValidation);

  if (input.vendorIds.length !== input.vendorNames.length) {
    throw new Error('Vendor IDs and names must match in length');
  }

  if (input.vendorIds.some((id) => !id?.trim())) {
    throw new Error('All vendor IDs must be non-empty');
  }

  if (!input.dueDate || input.dueDate < new Date()) {
    throw new Error('Due date must be in the future');
  }

  // Validate items array
  const itemsValidation = validateArray(items, 'Items', {
    required: true,
    minLength: 1,
    maxLength: 500,
  });
  assertValid(itemsValidation);

  // Validate each item has required fields with length limits
  items.forEach((item, index) => {
    const itemResult = validateFields({
      description: {
        value: item.description,
        validator: (v) =>
          validateString(v, `Item ${index + 1} Description`, {
            required: true,
            maxLength: MAX_LENGTHS.MEDIUM_TEXT,
          }),
      },
      quantity: {
        value: item.quantity,
        validator: (v) =>
          validateNumber(v, `Item ${index + 1} Quantity`, {
            required: true,
            positive: true,
            min: 0.001,
            max: 999999999,
          }),
      },
    });
    assertValid(itemResult);
  });

  // Generate RFQ number
  const rfqNumber = await generateRFQNumber();

  // Extract unique project IDs and names from items
  const projectMap = new Map<string, string>();
  items.forEach((item) => {
    if (item.projectId) {
      projectMap.set(item.projectId, item.projectId);
    }
  });
  const projectIds = Array.from(projectMap.keys());

  // Fetch project names from Firestore in parallel (avoid N+1 queries)
  const projectNames: string[] = await Promise.all(
    projectIds.map(async (projectId) => {
      try {
        const projectDoc = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
        if (projectDoc.exists()) {
          const projectData = projectDoc.data();
          return projectData.name || `Project ${projectId}`;
        }
        return `Project ${projectId}`;
      } catch (err) {
        logger.warn('Failed to fetch project name', { projectId, error: err });
        return `Project ${projectId}`;
      }
    })
  );

  const now = Timestamp.now();

  // Create RFQ document using sanitized input
  const rfqData: Omit<RFQ, 'id'> = {
    number: rfqNumber,
    purchaseRequestIds: input.purchaseRequestIds,
    projectIds,
    projectNames,
    title: sanitizedInput.title,
    description: sanitizedInput.description,
    vendorIds: input.vendorIds,
    vendorNames: input.vendorNames,
    paymentTerms: sanitizedInput.paymentTerms,
    deliveryTerms: sanitizedInput.deliveryTerms,
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
    // Build item data with only defined fields to prevent Firestore errors
    // Firestore throws "Unsupported field value: undefined" if any field is undefined
    const itemData: Record<string, unknown> = {
      rfqId: rfqRef.id,
      purchaseRequestId: item.purchaseRequestId,
      purchaseRequestItemId: item.purchaseRequestItemId,
      lineNumber: index + 1,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      createdAt: now,
      updatedAt: now,
    };

    // Add optional fields only if they have values
    if (item.specification) itemData.specification = item.specification;
    if (item.projectId) itemData.projectId = item.projectId;
    if (item.equipmentId) itemData.equipmentId = item.equipmentId;
    if (item.equipmentCode) itemData.equipmentCode = item.equipmentCode;
    if (item.technicalSpec) itemData.technicalSpec = item.technicalSpec;
    if (item.drawingNumbers) itemData.drawingNumbers = item.drawingNumbers;
    if (item.makeModel) itemData.makeModel = item.makeModel;
    if (item.requiredBy) itemData.requiredBy = Timestamp.fromDate(item.requiredBy);
    if (item.deliveryLocation) itemData.deliveryLocation = item.deliveryLocation;
    if (item.conditions) itemData.conditions = item.conditions;

    const itemRef = doc(collection(db, COLLECTIONS.RFQ_ITEMS));
    batch.set(itemRef, itemData);
  });

  await batch.commit();

  // Audit log: RFQ created
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'RFQ_CREATED',
    'RFQ',
    rfqRef.id,
    `Created RFQ ${rfqNumber}: ${input.title}`,
    {
      entityName: rfqNumber,
      metadata: {
        title: input.title,
        itemCount: items.length,
        vendorCount: input.vendorIds.length,
        vendorNames: input.vendorNames,
        purchaseRequestIds: input.purchaseRequestIds,
        projectIds,
      },
    }
  );

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

  // Fetch all PRs in parallel (avoid N+1 queries)
  const prDocs = await Promise.all(
    prIds.map((prId) => getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId)))
  );
  const prs: PurchaseRequest[] = prDocs
    .filter((prDoc) => prDoc.exists())
    .map((prDoc) => ({ id: prDoc.id, ...prDoc.data() }) as PurchaseRequest);

  if (prs.length === 0) {
    throw new Error('No valid Purchase Requests found');
  }

  // Fetch all PR items for these PRs in parallel (avoid N+1 queries)
  // Accept both APPROVED and PENDING items - the PR itself is already approved,
  // so items are valid even if their individual status wasn't updated.
  // Exclude REJECTED and CONVERTED items.
  const itemSnapshots = await Promise.all(
    prs.map((pr) =>
      getDocs(
        query(
          collection(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS),
          where('purchaseRequestId', '==', pr.id),
          where('status', 'in', ['APPROVED', 'PENDING'])
        )
      )
    )
  );

  const allItems: CreateRFQItemInput[] = [];
  prs.forEach((pr, prIndex) => {
    const itemsSnapshot = itemSnapshots[prIndex];
    if (!itemsSnapshot) return;

    itemsSnapshot.forEach((itemDoc) => {
      const prItem = { id: itemDoc.id, ...itemDoc.data() } as PurchaseRequestItem;

      // Build item object, filtering out undefined optional fields to prevent Firestore errors
      const rfqItem: CreateRFQItemInput = {
        purchaseRequestId: pr.id,
        purchaseRequestItemId: prItem.id,
        description: prItem.description,
        quantity: prItem.quantity,
        unit: prItem.unit,
      };

      // Add optional fields only if they have values
      if (pr.projectId) rfqItem.projectId = pr.projectId;
      if (prItem.specification) rfqItem.specification = prItem.specification;
      if (prItem.equipmentId) rfqItem.equipmentId = prItem.equipmentId;
      if (prItem.equipmentCode) rfqItem.equipmentCode = prItem.equipmentCode;
      if (prItem.technicalSpec) rfqItem.technicalSpec = prItem.technicalSpec;
      if (prItem.drawingNumbers) rfqItem.drawingNumbers = prItem.drawingNumbers;
      if (prItem.makeModel) rfqItem.makeModel = prItem.makeModel;
      if (prItem.requiredBy) rfqItem.requiredBy = prItem.requiredBy.toDate();
      if (prItem.deliveryLocation) rfqItem.deliveryLocation = prItem.deliveryLocation;

      allItems.push(rfqItem);
    });
  });

  if (allItems.length === 0) {
    throw new Error(
      'No items found in the selected Purchase Requests. Ensure PRs have items that are not rejected or already converted.'
    );
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
  // This is a non-critical operation - RFQ is already created successfully
  // If this fails, log the error but don't fail the entire operation
  try {
    const batch = writeBatch(db);
    for (const prId of prIds) {
      batch.update(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
        status: 'CONVERTED_TO_RFQ',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    }
    await batch.commit();
  } catch (err) {
    // Log but don't throw - RFQ was created successfully
    logger.error('Failed to update PR statuses after RFQ creation', {
      rfqId,
      prIds,
      error: err,
    });
  }

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
  userId: string,
  userName?: string
): Promise<void> {
  const { db } = getFirebase();

  // Get existing RFQ for audit log
  const existingRFQ = await getRFQById(rfqId);

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

  // Audit log: RFQ updated
  if (existingRFQ) {
    const auditContext = createAuditContext(userId, '', userName || userId);
    await logAuditEvent(
      db,
      auditContext,
      'RFQ_UPDATED',
      'RFQ',
      rfqId,
      `Updated RFQ ${existingRFQ.number}`,
      {
        entityName: existingRFQ.number,
        metadata: {
          updatedFields: Object.keys(input).filter(
            (key) => input[key as keyof UpdateRFQInput] !== undefined
          ),
        },
      }
    );
  }

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
