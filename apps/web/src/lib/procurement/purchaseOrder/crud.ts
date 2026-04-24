/**
 * Purchase Order CRUD Operations
 *
 * Handles core PO operations:
 * - Create PO from offer
 * - Read PO by ID
 * - Read PO items
 * - List POs with filters
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
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  POCommercialTerms,
  CurrencyCode,
  VendorQuote,
  VendorQuoteItem,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { withIdempotency, generateIdempotencyKey } from '@/lib/utils/idempotencyService';
import { recordProcurementPrices } from '@/lib/materials/pricing';
import {
  generateProcurementNumber,
  PROCUREMENT_NUMBER_CONFIGS,
} from '../generateProcurementNumber';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { requirePermission } from '@/lib/auth';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { rfqStateMachine } from '@/lib/workflow/stateMachines';
import { removeUndefinedDeep } from '@/lib/firebase/typeHelpers';

const logger = createLogger({ context: 'purchaseOrder/crud' });

// ============================================================================
// PO NUMBER GENERATION (ATOMIC)
// ============================================================================

/**
 * Generate PO number using atomic transaction
 * Uses a counter document to prevent race conditions
 * Format: PO/YYYY/MM/XXXX
 */
export async function generatePONumber(): Promise<string> {
  return generateProcurementNumber(PROCUREMENT_NUMBER_CONFIGS.PURCHASE_ORDER);
}

// ============================================================================
// CREATE PO
// ============================================================================

export interface CreatePOFromOfferTerms {
  // Header
  /**
   * PO title shown on the detail page and PDF. If omitted, we derive one from
   * the source RFQ title (e.g. "RFQ for Valves" → "PO for Valves") so the title
   * stays item-oriented rather than vendor-oriented.
   */
  title?: string;

  // Legacy simple text fields (for backward compatibility)
  paymentTerms: string;
  deliveryTerms: string;
  warrantyTerms?: string;
  penaltyClause?: string;
  otherClauses?: string[];
  deliveryAddress: string;
  expectedDeliveryDate?: Date;
  advancePaymentRequired?: boolean;
  advancePercentage?: number;

  // New structured commercial terms (optional - for enhanced PO creation)
  commercialTermsTemplateId?: string;
  commercialTermsTemplateName?: string;
  commercialTerms?: POCommercialTerms;
}

export async function createPOFromOffer(
  offerId: string,
  terms: CreatePOFromOfferTerms,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<string> {
  const { db } = getFirebase();

  // Authorization: Require MANAGE_PROCUREMENT permission
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'create purchase order'
  );

  // Generate idempotency key based on offer ID and user
  // This prevents duplicate PO creation from double-clicks or network retries
  const idempotencyKey = generateIdempotencyKey('create-po-from-offer', offerId, userId);

  return withIdempotency(
    db,
    idempotencyKey,
    'create-po-from-offer',
    async () => {
      // Read the source vendor quote (unified collection — see Stage 2 migration).
      const offerDoc = await getDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, offerId));
      if (!offerDoc.exists()) {
        throw new Error('Quote not found');
      }

      const offer: VendorQuote = {
        id: offerDoc.id,
        ...(offerDoc.data() as Omit<VendorQuote, 'id'>),
      };

      // Prevent duplicate PO creation from the same quote
      if (offer.status === 'PO_CREATED') {
        throw new Error('A Purchase Order has already been created from this quote');
      }
      if (!offer.vendorId) {
        throw new Error('Quote has no linked vendor — PO creation requires a registered vendor');
      }

      const offerItemsQuery = query(
        collection(db, COLLECTIONS.VENDOR_QUOTE_ITEMS),
        where('quoteId', '==', offerId),
        orderBy('lineNumber', 'asc')
      );
      const offerItemsSnapshot = await getDocs(offerItemsQuery);
      const offerItems: VendorQuoteItem[] = offerItemsSnapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VendorQuoteItem, 'id'>),
      }));

      // Fetch vendor entity for credit terms and contact info
      let vendorCreditDays: number | undefined;
      let vendorContact: { name: string; email: string; phone: string } | undefined;
      try {
        const vendorDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, offer.vendorId));
        if (vendorDoc.exists()) {
          const vendorData = vendorDoc.data();
          if (vendorData.creditTerms?.creditDays) {
            vendorCreditDays = vendorData.creditTerms.creditDays;
          }
          // Capture primary contact info for PO
          vendorContact = {
            name: vendorData.contactPerson || '',
            email: vendorData.email || '',
            phone: vendorData.phone || vendorData.mobile || '',
          };
        }
      } catch (err) {
        logger.warn('Failed to fetch vendor entity', { vendorId: offer.vendorId, error: err });
      }

      const poNumber = await generatePONumber();
      const now = Timestamp.now();

      // Calculate totals
      const subtotal = offer.subtotal;
      const totalTax = offer.taxAmount;

      // For now, split tax equally into CGST and SGST (intra-state)
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;
      const igst = 0; // Inter-state

      const grandTotal = offer.totalAmount;

      // Calculate advance amount if required
      let advanceAmount = 0;
      if (terms.advancePaymentRequired && terms.advancePercentage) {
        advanceAmount = (grandTotal * terms.advancePercentage) / 100;
      }

      // Create PO - build with only defined fields to prevent Firestore errors
      // Firestore throws "Unsupported field value: undefined" if any field is undefined
      // Derive a default title from the source RFQ so the PO is item-oriented
      // rather than vendor-oriented. Example: "RFQ for Valves" → "PO for Valves".
      // Users can override via the `terms.title` input.
      let defaultTitle = `Purchase Order for ${offer.vendorName}`;
      if (offer.rfqId) {
        try {
          const rfqSnap = await getDoc(doc(db, COLLECTIONS.RFQS, offer.rfqId));
          if (rfqSnap.exists()) {
            const rfqTitle = (rfqSnap.data() as { title?: string }).title?.trim();
            if (rfqTitle) {
              const match = rfqTitle.match(/^RFQ\s*(?:for|[-–])\s*(.+)$/i);
              defaultTitle = match && match[1] ? `PO for ${match[1].trim()}` : `PO - ${rfqTitle}`;
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch RFQ title for PO default', {
            rfqId: offer.rfqId,
            error: err,
          });
        }
      }
      const poTitle = terms.title?.trim() || defaultTitle;

      const poData: Record<string, unknown> = {
        // Required fields
        number: poNumber,
        rfqId: offer.rfqId,
        ...(offer.rfqNumber && { rfqNumber: offer.rfqNumber }),
        offerId: offer.id,
        selectedOfferNumber: offer.number,
        vendorId: offer.vendorId,
        vendorName: offer.vendorName,
        projectIds: [], // Will be populated from items
        projectNames: [],
        title: poTitle,
        description: `PO created from offer ${offer.number}`,
        subtotal,
        cgst,
        sgst,
        igst,
        totalTax,
        grandTotal,
        currency: offer.currency,
        paymentTerms: terms.paymentTerms,
        deliveryTerms: terms.deliveryTerms,
        otherClauses: terms.otherClauses || [],
        deliveryAddress: terms.deliveryAddress,
        pdfVersion: 1,
        status: 'DRAFT',
        advancePaymentRequired: terms.advancePaymentRequired || false,
        deliveryProgress: 0,
        paymentProgress: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      // Add optional fields only if they have values
      if (terms.warrantyTerms) poData.warrantyTerms = terms.warrantyTerms;
      if (terms.penaltyClause) poData.penaltyClause = terms.penaltyClause;
      if (terms.expectedDeliveryDate) {
        poData.expectedDeliveryDate = Timestamp.fromDate(terms.expectedDeliveryDate);
      }

      // Propagate vendor offer reference from the selected offer so the PO carries
      // the vendor's own quotation number (distinct from our system-generated offer number).
      if (offer.vendorOfferNumber) poData.vendorOfferNumber = offer.vendorOfferNumber;
      if (offer.vendorOfferDate) poData.vendorOfferDate = offer.vendorOfferDate;

      // Propagate the offer's discount so the PO PDF can show it as a separate
      // line in the financial summary (review #28). Grand total stays at the
      // vendor's quoted total for audit reconciliation.
      if (offer.discount !== undefined && offer.discount > 0) {
        poData.discount = offer.discount;
      }
      if (terms.advancePercentage !== undefined) {
        poData.advancePercentage = terms.advancePercentage;
      }
      if (advanceAmount) poData.advanceAmount = advanceAmount;
      if (terms.advancePaymentRequired) poData.advancePaymentStatus = 'PENDING';

      // Vendor contact info from entity master
      if (vendorContact?.name) poData.vendorContactPerson = vendorContact.name;
      if (vendorContact?.email) poData.vendorEmail = vendorContact.email;
      if (vendorContact?.phone) poData.vendorPhone = vendorContact.phone;

      // Auto-populate payment terms from vendor credit terms if not explicitly provided
      if (!terms.paymentTerms && vendorCreditDays) {
        poData.paymentTerms = `Net ${vendorCreditDays} days`;
      }

      // Multi-tenancy: inherit tenantId from offer
      if (offer.tenantId) poData.tenantId = offer.tenantId;

      // Add structured commercial terms if provided
      if (terms.commercialTermsTemplateId) {
        poData.commercialTermsTemplateId = terms.commercialTermsTemplateId;
      }
      if (terms.commercialTermsTemplateName) {
        poData.commercialTermsTemplateName = terms.commercialTermsTemplateName;
      }
      if (terms.commercialTerms) {
        // Remove undefined values from commercialTerms - Firestore doesn't accept undefined
        poData.commercialTerms = removeUndefinedDeep(
          terms.commercialTerms as unknown as Record<string, unknown>
        );
      }

      const poRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), poData);

      // Create PO items from offer items
      // Batch fetch RFQ items to get projectId for each item (avoid N+1 query)
      const rfqItemMap = new Map<
        string,
        {
          projectId: string;
          equipmentId?: string;
          equipmentCode?: string;
          materialId?: string;
          materialCode?: string;
          materialName?: string;
          itemType?: string;
          serviceId?: string;
          serviceCode?: string;
          serviceName?: string;
          serviceCategory?: string;
        }
      >();

      // Get unique RFQ item IDs. rfqItemId is optional on VendorQuoteItem
      // (offline / standing quotes have no RFQ linkage) — filter undefined here
      // so the batched lookup only hits real RFQ items.
      const uniqueRfqItemIds = [
        ...new Set(offerItems.map((item) => item.rfqItemId).filter((id): id is string => !!id)),
      ];

      // Batch fetch all RFQ items in parallel
      const rfqItemPromises = uniqueRfqItemIds.map(async (rfqItemId) => {
        try {
          const rfqItemDoc = await getDoc(doc(db, COLLECTIONS.RFQ_ITEMS, rfqItemId));
          if (rfqItemDoc.exists()) {
            const rfqItemData = rfqItemDoc.data();
            return {
              id: rfqItemId,
              data: {
                projectId: rfqItemData.projectId || '',
                equipmentId: rfqItemData.equipmentId,
                equipmentCode: rfqItemData.equipmentCode,
                materialId: rfqItemData.materialId,
                materialCode: rfqItemData.materialCode,
                materialName: rfqItemData.materialName,
                itemType: rfqItemData.itemType,
                serviceId: rfqItemData.serviceId,
                serviceCode: rfqItemData.serviceCode,
                serviceName: rfqItemData.serviceName,
                serviceCategory: rfqItemData.serviceCategory,
              },
            };
          } else {
            logger.warn('RFQ item not found', { rfqItemId });
            return { id: rfqItemId, data: { projectId: '' } };
          }
        } catch (err) {
          logger.error('Error fetching RFQ item', { rfqItemId, error: err });
          return { id: rfqItemId, data: { projectId: '' } };
        }
      });

      const rfqItemResults = await Promise.all(rfqItemPromises);
      rfqItemResults.forEach(({ id, data }) => {
        rfqItemMap.set(id, data);
      });

      // Collect unique project IDs from RFQ items and fetch project names
      const uniqueProjectIds = [
        ...new Set(
          Array.from(rfqItemMap.values())
            .map((info) => info.projectId)
            .filter(Boolean)
        ),
      ];

      const projectNameMap = new Map<string, string>();
      if (uniqueProjectIds.length > 0) {
        const projectFetches = await Promise.all(
          uniqueProjectIds.map(async (projectId) => {
            try {
              const projectDoc = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
              if (projectDoc.exists()) {
                return { id: projectId, name: (projectDoc.data().name as string) || '' };
              }
            } catch (err) {
              logger.warn('Failed to fetch project name', { projectId, error: err });
            }
            return null;
          })
        );
        for (const result of projectFetches) {
          if (result) projectNameMap.set(result.id, result.name);
        }
      }

      // Update PO with project IDs and names
      await updateDoc(poRef, {
        projectIds: uniqueProjectIds,
        projectNames: uniqueProjectIds.map((id) => projectNameMap.get(id) || ''),
      });

      const batch = writeBatch(db);

      offerItems.forEach((item) => {
        const rfqItemInfo = (item.rfqItemId ? rfqItemMap.get(item.rfqItemId) : null) || {
          projectId: '',
        };

        // Build PO item with only defined fields to prevent Firestore errors
        const poItemData: Record<string, unknown> = {
          purchaseOrderId: poRef.id,
          ...(offer.tenantId && { tenantId: offer.tenantId }),
          offerItemId: item.id,
          rfqItemId: item.rfqItemId,
          lineNumber: item.lineNumber,
          description: item.description,
          projectId: rfqItemInfo.projectId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          amount: item.amount,
          gstRate: item.gstRate || 0,
          gstAmount: item.gstAmount || 0,
          quantityDelivered: 0,
          quantityAccepted: 0,
          quantityRejected: 0,
          deliveryStatus: 'PENDING',
          createdAt: now,
          updatedAt: now,
        };

        // Add optional fields only if they have values
        if (rfqItemInfo.equipmentId) poItemData.equipmentId = rfqItemInfo.equipmentId;
        if (rfqItemInfo.equipmentCode) poItemData.equipmentCode = rfqItemInfo.equipmentCode;
        if (item.makeModel) poItemData.makeModel = item.makeModel;
        if (item.deliveryDate) poItemData.deliveryDate = item.deliveryDate;

        // Material database linkage (prefer offer item, fallback to RFQ item)
        const matId = item.materialId || rfqItemInfo.materialId;
        const matCode = item.materialCode || rfqItemInfo.materialCode;
        const matName = item.materialName || rfqItemInfo.materialName;
        if (matId) poItemData.materialId = matId;
        if (matCode) poItemData.materialCode = matCode;
        if (matName) poItemData.materialName = matName;

        // Service catalog linkage (from RFQ item)
        if (rfqItemInfo.itemType) poItemData.itemType = rfqItemInfo.itemType;
        if (rfqItemInfo.serviceId) poItemData.serviceId = rfqItemInfo.serviceId;
        if (rfqItemInfo.serviceCode) poItemData.serviceCode = rfqItemInfo.serviceCode;
        if (rfqItemInfo.serviceName) poItemData.serviceName = rfqItemInfo.serviceName;
        if (rfqItemInfo.serviceCategory) poItemData.serviceCategory = rfqItemInfo.serviceCategory;

        const itemRef = doc(collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS));
        batch.set(itemRef, poItemData);
      });

      // Mark the quote as PO_CREATED to prevent duplicate POs
      batch.update(doc(db, COLLECTIONS.VENDOR_QUOTES, offerId), {
        status: 'PO_CREATED',
        updatedAt: now,
      });

      // Mark RFQ as PO_PROCESSED — validate transition first
      if (offer.rfqId) {
        const rfqDoc = await getDoc(doc(db, COLLECTIONS.RFQS, offer.rfqId));
        if (rfqDoc.exists()) {
          const rfqStatus = rfqDoc.data().status as import('@vapour/types').RFQStatus;
          requireValidTransition(rfqStateMachine, rfqStatus, 'PO_PROCESSED', 'RFQ');
        }
        batch.update(doc(db, COLLECTIONS.RFQS, offer.rfqId), {
          status: 'PO_PROCESSED',
          selectedOfferId: offerId,
          completedAt: now,
          updatedAt: now,
          updatedBy: userId,
        });
      }

      await batch.commit();

      // Record confirmed prices to material database (fire-and-forget)
      recordProcurementPrices(
        db,
        offerItems.map((i) => ({ materialId: i.materialId, unitPrice: i.unitPrice, unit: i.unit })),
        offer.vendorId,
        offer.vendorName,
        poNumber,
        (offer.currency as CurrencyCode) || 'INR',
        'confirmed',
        userId
      ).catch((err) => logger.error('Failed to record confirmed prices', { poNumber, error: err }));

      // Audit log: PO created
      const auditContext = createAuditContext(userId, '', userName);
      await logAuditEvent(
        db,
        auditContext,
        'PO_CREATED',
        'PURCHASE_ORDER',
        poRef.id,
        `Created Purchase Order ${poNumber} for ${offer.vendorName}`,
        {
          entityName: poNumber,
          metadata: {
            vendorId: offer.vendorId,
            vendorName: offer.vendorName,
            offerId: offer.id,
            offerNumber: offer.number,
            grandTotal: grandTotal,
            currency: offer.currency,
            itemCount: offerItems.length,
          },
        }
      );

      logger.info('PO created', { poId: poRef.id, poNumber });

      return poRef.id;
    },
    { userId, metadata: { offerId, userName } }
  );
}

// ============================================================================
// READ PO
// ============================================================================

export async function getPOById(poId: string): Promise<PurchaseOrder | null> {
  const { db } = getFirebase();

  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));

  if (!poDoc.exists()) {
    return null;
  }

  return { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;
}

export async function getPOItems(poId: string): Promise<PurchaseOrderItem[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where('purchaseOrderId', '==', poId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PurchaseOrderItem[];
}

export async function listPOs(
  filters: {
    status?: PurchaseOrderStatus;
    projectId?: string;
    vendorId?: string;
    limit?: number;
  } = {}
): Promise<PurchaseOrder[]> {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.vendorId) {
    constraints.push(where('vendorId', '==', filters.vendorId));
  }

  if (filters.projectId) {
    constraints.push(where('projectIds', 'array-contains', filters.projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.PURCHASE_ORDERS), ...constraints);
  const snapshot = await getDocs(q);

  // Client-side soft-delete filter (CLAUDE.md rule #3)
  return snapshot.docs
    .filter((doc) => !doc.data().isDeleted)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PurchaseOrder[];
}

// ============================================================================
// UPDATE DRAFT PO
// ============================================================================

export interface UpdateDraftPOTerms {
  paymentTerms: string;
  deliveryTerms: string;
  warrantyTerms?: string;
  penaltyClause?: string;
  deliveryAddress: string;
  expectedDeliveryDate?: Date;
  advancePaymentRequired: boolean;
  advancePercentage?: number;
  commercialTermsTemplateId?: string;
  commercialTermsTemplateName?: string;
  commercialTerms?: POCommercialTerms;
}

/**
 * Update a DRAFT PO's commercial terms.
 * Only DRAFT POs can be edited.
 */
export async function updateDraftPO(
  poId: string,
  terms: UpdateDraftPOTerms,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require MANAGE_PROCUREMENT permission
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'update purchase order'
  );

  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!poDoc.exists()) {
    throw new Error('Purchase Order not found');
  }

  const po = poDoc.data();
  if (po.status !== 'DRAFT') {
    throw new Error('Only DRAFT Purchase Orders can be edited');
  }

  const now = Timestamp.now();

  // Calculate advance amount if required
  let advanceAmount = 0;
  const grandTotal = po.grandTotal as number;
  if (terms.advancePaymentRequired && terms.advancePercentage) {
    advanceAmount = (grandTotal * terms.advancePercentage) / 100;
  }

  const updateData: Record<string, unknown> = {
    paymentTerms: terms.paymentTerms,
    deliveryTerms: terms.deliveryTerms,
    deliveryAddress: terms.deliveryAddress,
    advancePaymentRequired: terms.advancePaymentRequired,
    updatedAt: now,
    updatedBy: userId,
  };

  if (terms.warrantyTerms) updateData.warrantyTerms = terms.warrantyTerms;
  if (terms.penaltyClause) updateData.penaltyClause = terms.penaltyClause;
  if (terms.expectedDeliveryDate) {
    updateData.expectedDeliveryDate = Timestamp.fromDate(terms.expectedDeliveryDate);
  }
  if (terms.advancePercentage !== undefined) {
    updateData.advancePercentage = terms.advancePercentage;
  }
  if (advanceAmount) updateData.advanceAmount = advanceAmount;
  if (terms.advancePaymentRequired) updateData.advancePaymentStatus = 'PENDING';
  if (terms.commercialTermsTemplateId) {
    updateData.commercialTermsTemplateId = terms.commercialTermsTemplateId;
  }
  if (terms.commercialTermsTemplateName) {
    updateData.commercialTermsTemplateName = terms.commercialTermsTemplateName;
  }
  if (terms.commercialTerms) {
    updateData.commercialTerms = removeUndefinedDeep(
      terms.commercialTerms as unknown as Record<string, unknown>
    );
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), updateData);

  // Audit log
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'PO_UPDATED',
    'PURCHASE_ORDER',
    poId,
    `Updated Draft Purchase Order ${po.number}`,
    {
      entityName: po.number as string,
      metadata: {
        fields: Object.keys(updateData).filter((k) => k !== 'updatedAt' && k !== 'updatedBy'),
      },
    }
  );

  logger.info('Draft PO updated', { poId, poNumber: po.number });
}
