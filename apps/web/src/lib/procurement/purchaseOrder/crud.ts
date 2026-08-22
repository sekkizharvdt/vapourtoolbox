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
  arrayUnion,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  CatalogLineDimensions,
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
import { roundToPaisa } from '@/lib/accounting/amountHelpers';
import { calculateGST } from '@/lib/accounting/gstCalculator';
import { calculatePOTotals, getTaxableValue, sumLineItems } from './totals';

const logger = createLogger({ context: 'purchaseOrder/crud' });

// ============================================================================
// ADVANCE AMOUNT
// ============================================================================

/**
 * Resolve the advance milestone from a payment schedule.
 *
 * `paymentType` is free text (the editor only offers "e.g., Advance" as a
 * placeholder), so substring matching is the only signal available. This is
 * the same predicate the PO create/edit pages use to derive
 * `advancePercentage`, kept identical so the percentage and the amount can
 * never be read off different milestones.
 */
function findAdvanceMilestone(commercialTerms?: POCommercialTerms) {
  return commercialTerms?.paymentSchedule?.find((m) =>
    (m.paymentType ?? '').toLowerCase().includes('advance')
  );
}

/**
 * Compute the advance payment amount.
 *
 * The percentage applies to the tax-INCLUSIVE grand total only when the
 * advance milestone actually carries the GST portion. Buyers normally settle
 * the full tax with the dispatch/main payment, so an advance with
 * `carriesTax: false` must be computed on the pre-tax taxable value —
 * otherwise the buyer is asked to advance GST they haven't agreed to pay yet.
 *
 * This figure is not display-only: `createAdvancePaymentRequest` posts it as a
 * real accounting transaction, so an inflated advance reaches the ledger.
 * (Feedback jRO7w8mg: a 30% advance with tax unselected was billed on the
 * ₹44,91,953.20 grand total instead of the ₹38,06,740 taxable value —
 * ₹2,05,563.96 too high.)
 *
 * `carriesTax` is treated as opt-IN: only an explicit `true` puts the advance on
 * the grand total. It used to require an explicit `false` to go pre-tax, which
 * never happened in practice — the editor's checkbox renders `carriesTax ?? false`
 * and Firestore drops the key when it is undefined, so a box the user never
 * ticked is stored as absent, not false. Every other consumer already reads it as
 * falsy-means-no (POPDFDocument, POTermsSection, the new-PO summary), so the
 * strict check made the pre-tax branch dead code: all 4 affected POs still
 * carried a grand-total advance after the first fix shipped, PO/2026/010 among
 * them — the very PO cited below.
 *
 * (Feedback jRO7w8mg: a 30% advance with tax unticked was billed on the
 * ₹44,91,953.20 grand total instead of ₹11,42,022 pre-tax, and a 20% advance on
 * PO/2026/011 showed ₹23,600 instead of ₹20,000.)
 *
 * Defaults to tax-inclusive when no advance milestone is found, preserving the
 * prior behaviour for POs created without a structured payment schedule — there
 * is no checkbox in that case, so there is no user expectation to honour.
 */
export function calculateAdvanceAmount(params: {
  grandTotal: number;
  taxableValue: number;
  advancePaymentRequired?: boolean;
  advancePercentage?: number;
  commercialTerms?: POCommercialTerms;
}): number {
  const { grandTotal, taxableValue, advancePaymentRequired, advancePercentage, commercialTerms } =
    params;

  if (!advancePaymentRequired || !advancePercentage) return 0;

  const advanceMilestone = findAdvanceMilestone(commercialTerms);
  const base = advanceMilestone && advanceMilestone.carriesTax !== true ? taxableValue : grandTotal;

  return roundToPaisa((base * advancePercentage) / 100);
}

// ============================================================================
// BUDGETARY GUARD
// ============================================================================

/**
 * Refuse to build a PO on an RFQ that came from a budgetary purchase request.
 *
 * The source PRs are the authority, not the RFQ's denormalised `isBudgetary`
 * flag: RFQs created before that field existed do not carry it, and there were
 * four such RFQs when this shipped. Checking the PRs makes those blocked too,
 * with no backfill and no `(field ?? legacyField)` fallback (rule 31).
 *
 * Silent on failure to read: a transient Firestore error must not block a
 * legitimate PO, and the flag is a policy guard rather than a safety interlock.
 */
async function requireNonBudgetaryRFQ(
  db: ReturnType<typeof getFirebase>['db'],
  rfqId: string | undefined
): Promise<void> {
  if (!rfqId) return;

  try {
    const rfqSnap = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));
    if (!rfqSnap.exists()) return;

    const rfq = rfqSnap.data();
    let budgetary = rfq.isBudgetary === true;

    if (!budgetary) {
      const prIds = (rfq.purchaseRequestIds as string[] | undefined) ?? [];
      const prSnaps = await Promise.all(
        prIds.map((prId) => getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId)))
      );
      budgetary = prSnaps.some((snap) => snap.exists() && snap.data()?.isBudgetary === true);
    }

    if (budgetary) {
      throw new BudgetaryRFQError(
        `${rfq.number ?? 'This RFQ'} came from a budgetary purchase request, so it cannot be turned into a Purchase Order. ` +
          `The quotations stay available for estimating and future procurement — raise a project purchase request to order against.`
      );
    }
  } catch (error) {
    if (error instanceof BudgetaryRFQError) throw error;
    logger.warn('Could not verify whether the RFQ is budgetary; allowing PO creation', {
      rfqId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Distinguishes the policy refusal from a read failure inside the guard. */
class BudgetaryRFQError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetaryRFQError';
  }
}

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
  // rule19-exempt: reads source offer + RFQ for denormalisation; writes a new PO doc — different documents, the read does not mutate
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

      // Rule 23: a budgetary enquiry must not become a commitment. Quotations
      // are deliberately still collected against budgetary RFQs — they price
      // future work and stay available for later procurement — but converting
      // one into a Purchase Order is what the user is asking us to prevent
      // (feedback A2gvtjZB). Two RFQs sourced from budgetary PRs had already
      // reached PO_PROCESSED before this guard existed.
      await requireNonBudgetaryRFQ(db, offer.rfqId);

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

      // Fetch vendor entity for credit terms, contact info, and state (for GST calculation)
      let vendorCreditDays: number | undefined;
      let vendorContact: { name: string; email: string; phone: string } | undefined;
      let vendorState: string | undefined;
      try {
        const vendorDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, offer.vendorId));
        if (vendorDoc.exists()) {
          const vendorData = vendorDoc.data();
          if (vendorData.creditTerms?.creditDays) {
            vendorCreditDays = vendorData.creditTerms.creditDays;
          }
          // Capture vendor state for GST calculation
          vendorState = vendorData.billingAddress?.state;
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

      // Fetch company settings for state (needed for GST type determination)
      let companyState: string | undefined;
      try {
        const companyDoc = await getDoc(doc(db, 'company', 'settings'));
        if (companyDoc.exists()) {
          const companyData = companyDoc.data();
          companyState = companyData.address?.state;
        }
      } catch (err) {
        logger.warn('Failed to fetch company settings for state', { error: err });
      }

      const poNumber = await generatePONumber();
      const now = Timestamp.now();

      // Calculate totals (rule 21 — round at every step).
      //
      // Basic price (pre-discount, pre-P&F) from the vendor's quote.
      const subtotal = roundToPaisa(offer.subtotal);

      // Header discount reduces the taxable value (pre-tax — review decision 2.2a).
      const discount = offer.discount && offer.discount > 0 ? roundToPaisa(offer.discount) : 0;

      // Packing & forwarding, when charged separately, is part of the taxable
      // value (GST applies to it). When included in the line prices it is 0.
      const ct = terms.commercialTerms;
      let packingForwardingAmount = 0;
      if (ct && !ct.packingForwardingIncluded && ct.pfChargeValue && ct.pfChargeValue > 0) {
        packingForwardingAmount =
          ct.pfChargeType === 'PERCENTAGE'
            ? roundToPaisa((subtotal * ct.pfChargeValue) / 100)
            : roundToPaisa(ct.pfChargeValue);
      }

      // Taxable value, then recompute GST on it using the quote's blended
      // effective rate (handles mixed line-item rates; exact for single-rate POs).
      const taxableValue = roundToPaisa(subtotal - discount + packingForwardingAmount);
      const effectiveTaxRate = offer.subtotal > 0 ? offer.taxAmount / offer.subtotal : 0;
      const totalTax = roundToPaisa(taxableValue * effectiveTaxRate);

      // Determine GST type based on vendor state vs company state (rule: GST Display bug fix)
      // Default to CGST+SGST if states are unavailable (backward compatibility)
      let cgst = roundToPaisa(totalTax / 2);
      let sgst = roundToPaisa(totalTax - cgst);
      let igst = 0;

      if (vendorState && companyState) {
        // Use state-aware GST calculation
        const gstRate = effectiveTaxRate * 100;
        const gstDetails = calculateGST({
          taxableAmount: taxableValue,
          gstRate,
          sourceState: companyState,
          destinationState: vendorState,
        });

        if (gstDetails.gstType === 'IGST') {
          cgst = 0;
          sgst = 0;
          igst = roundToPaisa(gstDetails.igstAmount ?? 0);
        } else {
          cgst = roundToPaisa(gstDetails.cgstAmount ?? 0);
          sgst = roundToPaisa(gstDetails.sgstAmount ?? 0);
          igst = 0;
        }
      }

      const grandTotal = roundToPaisa(taxableValue + totalTax);

      // Calculate advance amount if required (tax-exclusive unless the advance
      // milestone carries GST — see calculateAdvanceAmount)
      const advanceAmount = calculateAdvanceAmount({
        grandTotal,
        taxableValue,
        advancePaymentRequired: terms.advancePaymentRequired,
        advancePercentage: terms.advancePercentage,
        commercialTerms: terms.commercialTerms,
      });

      // Create PO - build with only defined fields to prevent Firestore errors
      // Firestore throws "Unsupported field value: undefined" if any field is undefined
      // Derive a default title from the source RFQ so the PO is item-oriented
      // rather than vendor-oriented. Example: "RFQ for Valves" → "PO for Valves".
      // Users can override via the `terms.title` input.
      let defaultTitle = `Purchase Order for ${offer.vendorName}`;
      // Requester of the primary source PR — denormalised so the submit flow can
      // pre-fill the first approver (review 2.3). Best-effort; never blocks PO creation.
      let requestedBy: string | undefined;
      let requestedByName: string | undefined;
      if (offer.rfqId) {
        try {
          const rfqSnap = await getDoc(doc(db, COLLECTIONS.RFQS, offer.rfqId));
          if (rfqSnap.exists()) {
            const rfqData = rfqSnap.data() as {
              title?: string;
              purchaseRequestIds?: string[];
            };
            const rfqTitle = rfqData.title?.trim();
            if (rfqTitle) {
              const match = rfqTitle.match(/^RFQ\s*(?:for|[-–])\s*(.+)$/i);
              defaultTitle = match && match[1] ? `PO for ${match[1].trim()}` : `PO - ${rfqTitle}`;
            }
            // Resolve the requester from the primary source PR.
            const primaryPrId = rfqData.purchaseRequestIds?.[0];
            if (primaryPrId) {
              try {
                const prSnap = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, primaryPrId));
                if (prSnap.exists()) {
                  const prData = prSnap.data() as { createdBy?: string; submittedByName?: string };
                  requestedBy = prData.createdBy;
                  requestedByName = prData.submittedByName;
                }
              } catch (prErr) {
                logger.warn('Failed to resolve PR requester for PO default approver', {
                  primaryPrId,
                  error: prErr,
                });
              }
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
        taxableValue,
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

      // Discount and P&F are baked into the taxable value / grand total above
      // (review 2.2a/2.2b); store the amounts so the financial summary and PDF
      // can show them as explicit rows.
      if (discount > 0) {
        poData.discount = discount;
      }
      if (packingForwardingAmount > 0) {
        poData.packingForwardingAmount = packingForwardingAmount;
      }
      if (requestedBy) {
        poData.requestedBy = requestedBy;
      }
      if (requestedByName) {
        poData.requestedByName = requestedByName;
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
          specification?: string;
          dimensions?: CatalogLineDimensions;
          equipmentId?: string;
          equipmentCode?: string;
          materialId?: string;
          materialCode?: string;
          materialName?: string;
          boughtOutItemId?: string;
          catalogRef?: unknown;
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
                specification: rfqItemData.specification,
                dimensions: rfqItemData.dimensions,
                equipmentId: rfqItemData.equipmentId,
                equipmentCode: rfqItemData.equipmentCode,
                materialId: rfqItemData.materialId,
                materialCode: rfqItemData.materialCode,
                materialName: rfqItemData.materialName,
                boughtOutItemId: rfqItemData.boughtOutItemId,
                catalogRef: rfqItemData.catalogRef,
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

      // Collect unique project IDs from RFQ items and fetch project names.
      // For online RFQ responses every line carries an rfqItemId so the
      // per-item projectIds populate fully. For OFFLINE_RFQ quotes with
      // manual line items (no rfqItemId), this set comes back empty —
      // fall back to the quote's own denormalized `projectIds` (written
      // from the linked RFQ at quote-save time, per CLAUDE.md rule #26).
      let uniqueProjectIds = [
        ...new Set(
          Array.from(rfqItemMap.values())
            .map((info) => info.projectId)
            .filter(Boolean)
        ),
      ];
      let uniqueProjectNames: string[] = [];

      if (uniqueProjectIds.length === 0 && offer.projectIds && offer.projectIds.length > 0) {
        uniqueProjectIds = [...offer.projectIds];
        uniqueProjectNames =
          offer.projectNames && offer.projectNames.length === uniqueProjectIds.length
            ? [...offer.projectNames]
            : uniqueProjectIds.map(() => '');
      }

      if (uniqueProjectNames.length === 0 && uniqueProjectIds.length > 0) {
        const projectNameMap = new Map<string, string>();
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
        uniqueProjectNames = uniqueProjectIds.map((id) => projectNameMap.get(id) || '');
      }

      // Update PO with project IDs and names
      await updateDoc(poRef, {
        projectIds: uniqueProjectIds,
        projectNames: uniqueProjectNames,
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

        // Specification: prefer the vendor quote's text, fall back to the RFQ
        // item's — previously never copied, so the PO view/PDF showed blanks
        // until a buyer re-typed it on the edit page (feedback Mqj9wmh96ui3mlBtWNOF).
        const spec = item.specification || rfqItemInfo.specification;
        if (spec) poItemData.specification = spec;

        // Structured plate size — prefer the quoted line (a vendor may have
        // been asked to re-size), fall back to what the enquiry stated.
        const dimensions = item.dimensions || rfqItemInfo.dimensions;
        if (dimensions) poItemData.dimensions = dimensions;

        // Per-line discount travels with the line (same feedback): `amount` is
        // already net, these fields make the discount visible on view/PDF.
        if (item.discountAmount) {
          poItemData.discountAmount = item.discountAmount;
          if (item.discountType) poItemData.discountType = item.discountType;
          if (item.discountValue != null) poItemData.discountValue = item.discountValue;
        }

        // Material database linkage (prefer offer item, fallback to RFQ item)
        const matId = item.materialId || rfqItemInfo.materialId;
        const matCode = item.materialCode || rfqItemInfo.materialCode;
        const matName = item.materialName || rfqItemInfo.materialName;
        if (matId) poItemData.materialId = matId;
        if (matCode) poItemData.materialCode = matCode;
        if (matName) poItemData.materialName = matName;

        // Bought-out catalog linkage (prefer offer item, fallback to RFQ item)
        // — feeds the bought_out_prices loop on PO creation and GR→bill (A2)
        const boughtOutId = item.boughtOutItemId || rfqItemInfo.boughtOutItemId;
        if (boughtOutId) poItemData.boughtOutItemId = boughtOutId;
        const catalogRef = item.catalogRef || rfqItemInfo.catalogRef;
        if (catalogRef) poItemData.catalogRef = catalogRef;

        // Service catalog linkage (from RFQ item)
        if (rfqItemInfo.itemType) poItemData.itemType = rfqItemInfo.itemType;
        if (rfqItemInfo.serviceId) poItemData.serviceId = rfqItemInfo.serviceId;
        if (rfqItemInfo.serviceCode) poItemData.serviceCode = rfqItemInfo.serviceCode;
        if (rfqItemInfo.serviceName) poItemData.serviceName = rfqItemInfo.serviceName;
        if (rfqItemInfo.serviceCategory) poItemData.serviceCategory = rfqItemInfo.serviceCategory;

        const itemRef = doc(collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS));
        batch.set(itemRef, poItemData);
      }); // rule20-exempt: bounded by single offer's line items (typical < 100)

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

      // Record confirmed prices to the material / bought-out catalogs
      // (fire-and-forget). Unlinked lines are counted + warned inside; the
      // PO-create UI shows the nudge from its own item fetch.
      recordProcurementPrices(
        db,
        offerItems
          .filter((i) => i.itemType !== 'NOTE')
          .map((i) => ({
            materialId: i.materialId,
            boughtOutItemId: i.boughtOutItemId,
            serviceId: i.serviceId,
            unitPrice: i.unitPrice,
            unit: i.unit,
          })),
        offer.vendorId,
        offer.vendorName,
        poNumber,
        (offer.currency as CurrencyCode) || 'INR',
        'confirmed',
        userId,
        offer.tenantId || 'default-entity'
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

/**
 * Update the HSN/SAC tax-classification code on a single PO line item.
 * HSN (goods) / SAC (services) is not carried up the offer→PO chain, so it
 * is captured directly on the PO. Allowed while the PO is not in a terminal
 * state (the caller passes a non-terminal PO).
 */
export async function updatePOItemHsnSac(
  poItemId: string,
  hsnSacCode: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require MANAGE_PROCUREMENT permission (rule 5)
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'update PO line item HSN/SAC'
  );

  const trimmed = hsnSacCode.trim();
  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, poItemId), {
    // Empty string clears the code; Firestore rejects undefined so store ''.
    hsnSacCode: trimmed,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}

/**
 * Update the editable fields of a PO line item (specification + HSN/SAC) from
 * the PO edit form. Lets users correct auto-populated specs and set HSN/SAC
 * during editing rather than only in the view (feedback iZqGG).
 */
export async function updatePOItemFields(
  poItemId: string,
  fields: { specification?: string; hsnSacCode?: string; description?: string },
  userId: string,
  userPermissions: number
): Promise<void> {
  const { db } = getFirebase();

  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'update PO line item'
  );

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };
  // Empty string clears the field; Firestore rejects undefined so store ''.
  if (fields.specification !== undefined) updateData.specification = fields.specification.trim();
  if (fields.hsnSacCode !== undefined) updateData.hsnSacCode = fields.hsnSacCode.trim();
  // Description is required on the item — only overwrite when a non-empty
  // correction is given (auto-populated descriptions can be fixed here per
  // feedback kPmvFXbiYDMrtyZK5VEn; don't allow clearing it to blank).
  if (fields.description !== undefined && fields.description.trim()) {
    updateData.description = fields.description.trim();
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, poItemId), updateData);
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
  /** PO header description — editable to correct auto-population (feedback iZqGG). */
  description?: string;
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
  // rule8-exempt: status comparison filters / branches on existing state to compute a derived value (no write to the status field) — not a state-machine transition
  // rule19-exempt: edit form on a draft PO — read fetches current values for permission/audit; last-write-wins acceptable for user-driven edits
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

  // Calculate advance amount if required (tax-exclusive unless the advance
  // milestone carries GST — see calculateAdvanceAmount)
  const grandTotal = po.grandTotal as number;
  // Persisted on the PO since the taxableValue field landed; getTaxableValue
  // falls back to grandTotal - totalTax for records written before that.
  const taxableValue = getTaxableValue(
    po as { taxableValue?: number; grandTotal?: number; totalTax?: number }
  );
  const advanceAmount = calculateAdvanceAmount({
    grandTotal,
    taxableValue,
    advancePaymentRequired: terms.advancePaymentRequired,
    advancePercentage: terms.advancePercentage,
    commercialTerms: terms.commercialTerms,
  });

  const updateData: Record<string, unknown> = {
    paymentTerms: terms.paymentTerms,
    deliveryTerms: terms.deliveryTerms,
    deliveryAddress: terms.deliveryAddress,
    advancePaymentRequired: terms.advancePaymentRequired,
    // Backfills the field on any PO edited before it existed. The totals
    // themselves are not recomputed here — this path edits terms, not lines.
    taxableValue,
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
  // Written unconditionally, matching advancePaymentRequired above: skipping the
  // write when the advance is removed left the previous advanceAmount on the
  // document, and it still posts to accounting via createAdvancePaymentRequest.
  updateData.advanceAmount = advanceAmount;
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
  if (terms.description !== undefined) {
    updateData.description = terms.description;
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

/**
 * Record a downstream quantity change back on the originating PR line.
 *
 * The PR stays terminal — this is a note, not a reopening. The trail is
 * PO item -> rfqItemId -> RFQ item -> purchaseRequestItemId, which is intact on
 * every record (28/28 PO lines and 47/47 RFQ lines carry their link).
 *
 * Best-effort: the quantity change is already committed by the time this runs,
 * and losing the note must not fail the edit or leave the PO half-updated. A
 * failure is warned about, not thrown (rule 27).
 */
async function noteQuantityChangeOnPR(
  db: ReturnType<typeof getFirebase>['db'],
  params: {
    rfqItemId?: string;
    poId: string;
    poNumber: string;
    previousQuantity: number;
    newQuantity: number;
    reason: string;
    changedByName: string;
  }
): Promise<void> {
  // rule19-exempt: the getDoc is a lookup of a DIFFERENT, immutable document
  // (the RFQ line, to find which PR line it came from) — it is never the thing
  // written. The write itself is an atomic arrayUnion on the PR line, so there
  // is no read-modify-write and no update to lose.
  if (!params.rfqItemId) return;

  try {
    const rfqItemSnap = await getDoc(doc(db, COLLECTIONS.RFQ_ITEMS, params.rfqItemId));
    if (!rfqItemSnap.exists()) return;

    const prItemId = rfqItemSnap.data().purchaseRequestItemId as string | undefined;
    if (!prItemId) return;

    // arrayUnion rather than read-append-write: two lines of the same PO can
    // trace back to one PR line, and reading the array to rebuild it would let
    // concurrent changes drop an entry (rule 19). The append is atomic
    // server-side, so no read is needed and none can be lost.
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, prItemId), {
      quantityChanges: arrayUnion({
        documentNumber: params.poNumber,
        documentId: params.poId,
        previousQuantity: params.previousQuantity,
        newQuantity: params.newQuantity,
        reason: params.reason,
        changedByName: params.changedByName,
        changedAt: Timestamp.now(),
      }),
    });

    logger.info('Recorded quantity change on the originating PR line', { prItemId });
  } catch (error) {
    logger.warn('Could not record the quantity change on the PR line', {
      rfqItemId: params.rfqItemId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Change the ordered quantity on a DRAFT purchase order line.
 *
 * Fills the gap between a PR being approved and a PO being issued: until now
 * quantity was immutable from the moment the PO was created, so a late change
 * — a spare requirement noticed during PO preparation — left only two bad
 * options, cancelling the PO (terminal, and the source quote is already marked
 * PO_CREATED so it cannot be rebuilt) or raising an amendment on a PO the
 * vendor has never seen (feedback MesC9vYA).
 *
 * DRAFT only, deliberately. A PO sitting in PENDING_APPROVAL is being read by
 * an approver, and changing the value underneath them would have them approve
 * figures they never saw. Use returnPO to bring it back to DRAFT first — that
 * already clears the prior approvals so the new quantity is approved afresh.
 *
 * A reason is required: "60 -> 80" tells the requesting engineer that something
 * changed, "60 -> 80, spares" tells them whether to care.
 */
export async function updatePOItemQuantity(
  poId: string,
  poItemId: string,
  newQuantity: number,
  reason: string,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<{ previousQuantity: number; newQuantity: number }> {
  // rule19-exempt: reads the PO + its items to recompute totals, then writes the
  // line and the header — an edit on a DRAFT document with no concurrent actor
  // (a PO in approval cannot reach here).
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'change purchase order quantity'
  );

  if (!reason.trim()) {
    throw new Error('A reason is required when changing the ordered quantity');
  }
  if (!Number.isFinite(newQuantity) || newQuantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  const { db } = getFirebase();

  const poSnap = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
  if (!poSnap.exists()) {
    throw new Error('Purchase Order not found');
  }
  const po = poSnap.data();

  if (po.status !== 'DRAFT') {
    throw new Error(
      `Quantity can only be changed while the purchase order is a draft (this one is ${String(po.status).replace(/_/g, ' ').toLowerCase()}). ` +
        `Return it for revision first, or raise an amendment if it has already been issued.`
    );
  }

  const itemsSnap = await getDocs(
    query(collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS), where('purchaseOrderId', '==', poId))
  );
  const items = itemsSnap.docs.map((d) => ({ ...(d.data() as PurchaseOrderItem), id: d.id }));

  const target = items.find((i) => i.id === poItemId);
  if (!target) {
    throw new Error('Line item not found on this purchase order');
  }

  const previousQuantity = target.quantity;
  if (Math.abs(previousQuantity - newQuantity) < 0.0001) {
    return { previousQuantity, newQuantity };
  }

  // Keep the per-line discount proportional to the new quantity — the vendor
  // quoted a rate, not a flat sum, so scaling it is what preserves the agreed
  // price. `amount` stays net of discount, as everything downstream assumes.
  const gross = roundToPaisa(newQuantity * target.unitPrice);
  const scaledDiscount =
    target.discountAmount && previousQuantity > 0
      ? roundToPaisa((target.discountAmount / previousQuantity) * newQuantity)
      : 0;
  const newAmount = roundToPaisa(gross - scaledDiscount);

  const updatedItems = items.map((i) =>
    i.id === poItemId ? { ...i, quantity: newQuantity, amount: newAmount } : i
  );

  // Recompute the header from the line items. The effective tax rate is
  // preserved from the PO as issued rather than re-derived, so a quantity
  // change never silently reprices the tax.
  const previousTaxable = roundToPaisa((po.grandTotal as number) - ((po.totalTax as number) ?? 0));
  const effectiveTaxRate =
    previousTaxable > 0 ? ((po.totalTax as number) ?? 0) / previousTaxable : 0;

  const totals = calculatePOTotals({
    subtotal: sumLineItems(updatedItems),
    discount: (po.discount as number) ?? 0,
    effectiveTaxRate,
    commercialTerms: po.commercialTerms as POCommercialTerms | undefined,
    vendorState: po.vendorState as string | undefined,
    companyState: po.companyState as string | undefined,
  });

  const advanceAmount = calculateAdvanceAmount({
    grandTotal: totals.grandTotal,
    taxableValue: totals.taxableValue,
    advancePaymentRequired: po.advancePaymentRequired as boolean | undefined,
    advancePercentage: po.advancePercentage as number | undefined,
    commercialTerms: po.commercialTerms as POCommercialTerms | undefined,
  });

  const now = Timestamp.now();
  const batch = writeBatch(db);

  batch.update(doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, poItemId), {
    quantity: newQuantity,
    amount: newAmount,
    ...(target.discountAmount !== undefined && { discountAmount: scaledDiscount }),
    updatedAt: now,
    updatedBy: userId,
  });

  batch.update(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    subtotal: totals.subtotal,
    taxableValue: totals.taxableValue,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    totalTax: totals.totalTax,
    grandTotal: totals.grandTotal,
    advanceAmount,
    updatedAt: now,
    updatedBy: userId,
  });

  await batch.commit();

  try {
    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PO_UPDATED',
      'PURCHASE_ORDER',
      poId,
      `Quantity on "${target.description}" changed from ${previousQuantity} to ${newQuantity} on ${po.number}. Reason: ${reason.trim()}`,
      {
        entityName: po.number as string,
        severity: 'CRITICAL',
        metadata: {
          poItemId,
          previousQuantity,
          newQuantity,
          reason: reason.trim(),
          previousGrandTotal: po.grandTotal,
          newGrandTotal: totals.grandTotal,
        },
      }
    );
  } catch (auditError) {
    logger.warn('Failed to write audit log for PO quantity change', { poId, poItemId, auditError });
  }

  // Tell the engineer who raised the PR what was actually ordered (MesC9vYA).
  await noteQuantityChangeOnPR(db, {
    rfqItemId: target.rfqItemId,
    poId,
    poNumber: (po.number as string) ?? poId,
    previousQuantity,
    newQuantity,
    reason: reason.trim(),
    changedByName: userName,
  });

  logger.info('PO line quantity changed', { poId, poItemId, previousQuantity, newQuantity });

  return { previousQuantity, newQuantity };
}
