/**
 * Accounting Module
 *
 * Handles financial operations including transactions, payments,
 * tax calculations, and reporting.
 *
 * Note: This module re-exports from submodules. Import directly from
 * submodules to avoid potential naming conflicts.
 */

// Core services
export * from './fiscalYearService';
export * from './paymentHelpers';
export * from './transactionHelpers';
export * from './transactionNumberGenerator';
export * from './systemAccountResolver';
export * from './ledgerValidator';
export * from './auditLogger';

// Tax calculators
export * from './gstCalculator';

// Bank operations
export * from './bankStatementParser';
export * from './bankReconciliationService';
export * from './seedExchangeRates';

// Generators
export * from './glEntryGenerator';
export * from './gstReportGenerator';

// Approval workflows
export * from './billApprovalService';
export * from './invoiceApprovalService';

// Cost management
export * from './costCentreService';
export * from './vendorBillIntegrationService';

// Matching engine
export * from './autoMatchingEngine';

// Submodule exports (these have their own index.ts files)
export * from './autoMatching';
export * from './bankReconciliation';
export * from './glEntry';
export * from './gstReports';

// Note: tdsCalculator and tdsReportGenerator excluded to avoid duplicate exports with gstReports
// Import directly: import { calculateTDS } from './tdsCalculator'
