/**
 * Commercial Terms Default Templates
 *
 * Provides hardcoded default templates for different equipment categories.
 * These templates provide sensible defaults that can be overridden per-PO.
 */

import type {
  CommercialTermsTemplate,
  POCommercialTerms,
  PaymentMilestone,
} from '@vapour/types';

// ============================================================================
// FIXED TEXT CLAUSES (Common across templates)
// ============================================================================

const VDT_FIXED_TEXTS = {
  packingForwarding: `Included. The vendor must ensure that the materials are packed properly to avoid any damage during transit. Packing shall be suitable for the mode of transport and climate conditions. All packages shall be clearly marked with PO number, item description, and handling instructions.`,

  inspection: `Inspection shall be carried out by VDT / VDT Consultant / Third-Party Inspector at the vendor's works before dispatch. The vendor shall provide at least 7 days advance notice for inspection scheduling. Inspection clearance is mandatory before dispatch of materials.`,

  mdcc: `Before dispatch of any material, the vendor shall obtain formal dispatch clearance from VDT / VDT's authorized representative. The Material Dispatch Clearance Certificate (MDCC) shall be issued only after successful inspection and verification of all quality documents.`,

  forceMajeure: `Force Majeure shall be governed as per Indian Contract Act and standard industry practice. Neither party shall be liable for delay or failure in performance caused by events beyond reasonable control, including but not limited to: acts of God, war, terrorism, strikes, epidemics, or government actions. The affected party must notify the other party within 7 days of the occurrence of a Force Majeure event.`,

  rejectionClause: `Upon receipt of the items at the customer's premises, all supplied materials shall be subject to detailed inspection by VDT or their authorized representative. In case of any non-conformance to specifications, damage, or quality issues, the entire lot or affected items may be rejected at the vendor's risk and cost. The vendor shall arrange for replacement or rectification within 15 days of rejection notification.`,

  warranty: `The warranty period shall be {warrantyMonthsFromSupply} months from the date of supply or {warrantyMonthsFromCommissioning} months from the date of commissioning, whichever is later. During the warranty period, the vendor shall repair or replace, free of cost, any defects arising from faulty design, materials, or workmanship.`,
};

// ============================================================================
// VDT BILLING ADDRESS (Common across all POs)
// ============================================================================

const VDT_BILLING_ADDRESS = `Vapour Desal Technologies Pvt Ltd
No. 12, 2nd Cross Street
Nehru Nagar, Adyar
Chennai - 600 020
Tamil Nadu, India
GSTIN: 33AABCV1234A1Z5`;

// ============================================================================
// DEFAULT BUYER CONTACT
// ============================================================================

const DEFAULT_BUYER_CONTACT = {
  buyerContactName: 'Sekkizhar Prasanna',
  buyerContactPhone: '+91 9884033747',
  buyerContactEmail: 'sekkizhar@vapourdesal.com',
};

// ============================================================================
// BOUGHT-OUT ITEMS TEMPLATE
// ============================================================================

/**
 * Default payment schedule for Bought-Out Items
 * Standard 30-60-10 split
 */
const BO_PAYMENT_SCHEDULE: PaymentMilestone[] = [
  {
    id: 'milestone-1',
    serialNumber: 1,
    paymentType: 'Advance',
    percentage: 30,
    deliverables: 'On PO confirmation',
  },
  {
    id: 'milestone-2',
    serialNumber: 2,
    paymentType: 'Before Dispatch',
    percentage: 60,
    deliverables: 'On inspection clearance',
  },
  {
    id: 'milestone-3',
    serialNumber: 3,
    paymentType: 'On Receipt',
    percentage: 10,
    deliverables: 'On material receipt at site',
  },
];

/**
 * Default commercial terms for Bought-Out Items
 */
const BO_DEFAULT_TERMS: Partial<POCommercialTerms> = {
  priceBasis: 'FOR_SITE',
  paymentSchedule: BO_PAYMENT_SCHEDULE,
  currency: 'INR',
  deliveryPeriod: 8,
  deliveryUnit: 'WEEKS',
  deliveryTrigger: 'PO_DATE',
  packingForwardingIncluded: true,
  freightScope: 'VENDOR',
  transportScope: 'VENDOR',
  transitInsuranceScope: 'VENDOR',
  erectionScope: 'NA',
  billingAddress: VDT_BILLING_ADDRESS,
  deliveryAddress: '', // Will be set per-PO
  requiredDocuments: ['DRAWING', 'DATA_SHEET', 'QAP'],
  inspectorType: 'THIRD_PARTY',
  mdccRequired: true,
  ldPerWeekPercent: 0.5,
  ldMaxPercent: 5,
  warrantyMonthsFromSupply: 18,
  warrantyMonthsFromCommissioning: 12,
  ...DEFAULT_BUYER_CONTACT,
};

/**
 * Bought-Out Items Template
 * For procurement of standard equipment, components, and materials
 */
export const BOUGHT_OUT_ITEMS_TEMPLATE: CommercialTermsTemplate = {
  id: 'template-bo-items',
  name: 'Bought-Out Items',
  code: 'BO',
  description:
    'Standard terms for procurement of equipment, components, and materials that are bought from external vendors.',
  defaultTerms: BO_DEFAULT_TERMS,
  fixedTexts: VDT_FIXED_TEXTS,
  isActive: true,
  isDefault: true,
  // Timestamps will be set when needed; for hardcoded template these are placeholders
  createdAt: null as unknown as import('firebase/firestore').Timestamp,
  updatedAt: null as unknown as import('firebase/firestore').Timestamp,
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * All available commercial terms templates
 * Currently only Bought-Out Items; more can be added later
 */
export const COMMERCIAL_TERMS_TEMPLATES: CommercialTermsTemplate[] = [BOUGHT_OUT_ITEMS_TEMPLATE];

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): CommercialTermsTemplate | undefined {
  return COMMERCIAL_TERMS_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * Get template by code
 */
export function getTemplateByCode(code: string): CommercialTermsTemplate | undefined {
  return COMMERCIAL_TERMS_TEMPLATES.find((t) => t.code === code);
}

/**
 * Get the default template
 */
export function getDefaultTemplate(): CommercialTermsTemplate {
  const defaultTemplate = COMMERCIAL_TERMS_TEMPLATES.find((t) => t.isDefault);
  return defaultTemplate || BOUGHT_OUT_ITEMS_TEMPLATE;
}

/**
 * Get all active templates
 */
export function getActiveTemplates(): CommercialTermsTemplate[] {
  return COMMERCIAL_TERMS_TEMPLATES.filter((t) => t.isActive);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a new empty payment milestone with default values
 */
export function createEmptyMilestone(serialNumber: number): PaymentMilestone {
  return {
    id: `milestone-${Date.now()}-${serialNumber}`,
    serialNumber,
    paymentType: '',
    percentage: 0,
    deliverables: '',
  };
}

/**
 * Validate that payment milestones sum to 100%
 */
export function validatePaymentSchedule(milestones: PaymentMilestone[]): {
  isValid: boolean;
  totalPercentage: number;
  error?: string;
} {
  const totalPercentage = milestones.reduce((sum, m) => sum + m.percentage, 0);

  if (totalPercentage !== 100) {
    return {
      isValid: false,
      totalPercentage,
      error: `Payment milestones must sum to 100%. Current total: ${totalPercentage}%`,
    };
  }

  if (milestones.some((m) => m.percentage < 0)) {
    return {
      isValid: false,
      totalPercentage,
      error: 'Payment percentages cannot be negative',
    };
  }

  return { isValid: true, totalPercentage };
}

/**
 * Create a complete POCommercialTerms object from a template and delivery address
 */
export function createCommercialTermsFromTemplate(
  template: CommercialTermsTemplate,
  deliveryAddress: string,
  overrides?: Partial<POCommercialTerms>
): POCommercialTerms {
  const defaults = template.defaultTerms;

  return {
    priceBasis: defaults.priceBasis || 'FOR_SITE',
    paymentSchedule: defaults.paymentSchedule || [...BO_PAYMENT_SCHEDULE],
    currency: defaults.currency || 'INR',
    deliveryPeriod: defaults.deliveryPeriod ?? defaults.deliveryWeeks ?? 8,
    deliveryUnit: defaults.deliveryUnit || 'WEEKS',
    deliveryTrigger: defaults.deliveryTrigger || 'PO_DATE',
    packingForwardingIncluded: defaults.packingForwardingIncluded ?? true,
    freightScope: defaults.freightScope || 'VENDOR',
    transportScope: defaults.transportScope || 'VENDOR',
    transitInsuranceScope: defaults.transitInsuranceScope || 'VENDOR',
    erectionScope: defaults.erectionScope || 'NA',
    erectionCustomText: defaults.erectionCustomText,
    billingAddress: defaults.billingAddress || VDT_BILLING_ADDRESS,
    deliveryAddress: deliveryAddress,
    requiredDocuments: defaults.requiredDocuments || ['DRAWING', 'DATA_SHEET', 'QAP'],
    otherDocuments: defaults.otherDocuments,
    inspectorType: defaults.inspectorType || 'THIRD_PARTY',
    mdccRequired: defaults.mdccRequired ?? true,
    ldPerWeekPercent: defaults.ldPerWeekPercent ?? 0.5,
    ldMaxPercent: defaults.ldMaxPercent ?? 5,
    warrantyMonthsFromSupply: defaults.warrantyMonthsFromSupply ?? 18,
    warrantyMonthsFromCommissioning: defaults.warrantyMonthsFromCommissioning ?? 12,
    buyerContactName: defaults.buyerContactName || DEFAULT_BUYER_CONTACT.buyerContactName,
    buyerContactPhone: defaults.buyerContactPhone || DEFAULT_BUYER_CONTACT.buyerContactPhone,
    buyerContactEmail: defaults.buyerContactEmail || DEFAULT_BUYER_CONTACT.buyerContactEmail,
    ...overrides,
  };
}

/**
 * Get the fixed text for warranty with actual values substituted
 */
export function getWarrantyText(
  template: CommercialTermsTemplate,
  terms: POCommercialTerms
): string {
  return template.fixedTexts.warranty
    .replace('{warrantyMonthsFromSupply}', String(terms.warrantyMonthsFromSupply))
    .replace('{warrantyMonthsFromCommissioning}', String(terms.warrantyMonthsFromCommissioning));
}
