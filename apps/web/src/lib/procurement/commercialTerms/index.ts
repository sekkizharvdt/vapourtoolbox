/**
 * Commercial Terms Service
 *
 * Provides templates and utilities for PO commercial terms.
 * Templates define standard terms by equipment category (BO Items, Services, etc.)
 */

// Re-export all defaults and utilities
export {
  // Templates
  BOUGHT_OUT_ITEMS_TEMPLATE,
  COMMERCIAL_TERMS_TEMPLATES,
  // Template lookup
  getTemplateById,
  getTemplateByCode,
  getDefaultTemplate,
  getActiveTemplates,
  // Milestone utilities
  createEmptyMilestone,
  validatePaymentSchedule,
  // Terms creation
  createCommercialTermsFromTemplate,
  getWarrantyText,
  // Billing address utility
  buildBillingAddressFromCompany,
} from './defaults';

// Re-export types from @vapour/types for convenience
export type {
  POCommercialTerms,
  CommercialTermsTemplate,
  PaymentMilestone,
  POPriceBasis,
  PODeliveryTrigger,
  POScopeAssignment,
  POErectionScope,
  PORequiredDocument,
  POInspectorType,
} from '@vapour/types';
