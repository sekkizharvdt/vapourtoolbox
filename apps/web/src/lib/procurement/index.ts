/**
 * Procurement Module
 *
 * Handles the complete procurement workflow from purchase requests
 * through three-way matching and goods receipt.
 *
 * Note: This module re-exports from submodules. Import directly from
 * submodules (e.g., './purchaseRequest') to avoid naming conflicts.
 */

// Submodule exports (preferred imports)
export * from './purchaseRequest';
export * from './rfq';
export * from './offer';
export * from './amendment';
export * from './threeWayMatch';

// Service exports
export * from './goodsReceiptService';
export * from './packingListService';
export * from './workCompletionService';
export * from './threeWayMatchService';

// Integration (internal use)
export * from './accountingIntegration';
