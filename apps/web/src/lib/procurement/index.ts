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
// Note: vendor offers / quotations live in @/lib/vendorQuotes — the procurement
// `offer` submodule was retired when the collection was unified.
export * from './purchaseRequest';
export * from './rfq';
export * from './amendment';
export * from './threeWayMatch';

// Service exports
export * from './goodsReceiptService';
export * from './packingListService';
export * from './workCompletionService';
export * from './threeWayMatchService';

// Integration (internal use)
export * from './accountingIntegration';
