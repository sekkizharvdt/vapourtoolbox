/**
 * Module Integrations Seeding
 *
 * Populates the moduleIntegrations collection with all defined integration points
 * for the Accounting module. This is a one-time setup function that can be called
 * by super-admin users to initialize the integration registry.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Super Admin has all 27 permission bits set
 * This is calculated as: (1 << 27) - 1 = 134217727
 * Or: 0b111111111111111111111111111 (27 ones)
 */
const ALL_PERMISSIONS = 134217727;

interface IntegrationDefinition {
  sourceModule: string;
  targetModule: string;
  integrationType: 'incoming' | 'outgoing' | 'dependency' | 'reporting';
  dataType: string;
  description: string;
  status: 'active' | 'planned' | 'in-development';
  fieldMappings?: Array<{ source: string; target: string }>;
  triggerCondition?: string;
  implementationDate?: string;
  notes?: string;
}

/**
 * Accounting Module Integration Definitions
 */
const ACCOUNTING_INTEGRATIONS: IntegrationDefinition[] = [
  // INCOMING DATA (Data Accounting receives from other modules)
  {
    sourceModule: 'procurement',
    targetModule: 'accounting',
    integrationType: 'incoming',
    dataType: 'Vendor Invoices → Bills',
    description:
      'When a vendor invoice is approved in Procurement, create a corresponding bill in Accounting',
    status: 'planned',
    triggerCondition: 'vendorInvoice.status === "APPROVED"',
    fieldMappings: [
      { source: 'vendorInvoice.vendorId', target: 'bill.entityId' },
      { source: 'vendorInvoice.invoiceNumber', target: 'bill.vendorInvoiceNumber' },
      { source: 'vendorInvoice.invoiceDate', target: 'bill.billDate' },
      { source: 'vendorInvoice.dueDate', target: 'bill.dueDate' },
      { source: 'vendorInvoice.amount', target: 'bill.amount' },
      { source: 'vendorInvoice.lineItems', target: 'bill.lineItems' },
      { source: 'vendorInvoice.gstDetails', target: 'bill.gstDetails' },
    ],
    notes:
      'Reference fields added to VendorBill type: sourceModule, sourceDocumentId, sourceDocumentType',
  },
  {
    sourceModule: 'procurement',
    targetModule: 'accounting',
    integrationType: 'incoming',
    dataType: 'Purchase Orders → Commitments',
    description: 'When a PO is issued, create a financial commitment/encumbrance in Accounting',
    status: 'planned',
    triggerCondition: 'purchaseOrder.status === "ISSUED"',
    notes: 'Helps with budget tracking and cash flow forecasting',
  },
  {
    sourceModule: 'projects',
    targetModule: 'accounting',
    integrationType: 'incoming',
    dataType: 'Project Expenses → Transactions',
    description:
      'Project-related expenses are automatically posted to cost centres for project accounting',
    status: 'planned',
    triggerCondition: 'projectExpense.status === "APPROVED"',
    fieldMappings: [
      { source: 'projectExpense.projectId', target: 'transaction.costCentreId' },
      { source: 'projectExpense.amount', target: 'transaction.amount' },
      { source: 'projectExpense.description', target: 'transaction.description' },
    ],
  },
  {
    sourceModule: 'projects',
    targetModule: 'accounting',
    integrationType: 'incoming',
    dataType: 'Budget Allocations → Cost Centres',
    description: 'Project budgets are synced to cost centres for budget vs actual tracking',
    status: 'planned',
    triggerCondition: 'project.budget is created or updated',
    fieldMappings: [
      { source: 'project.id', target: 'costCentre.projectId' },
      { source: 'project.budget', target: 'costCentre.budget' },
    ],
  },
  {
    sourceModule: 'hr',
    targetModule: 'accounting',
    integrationType: 'incoming',
    dataType: 'Payroll → Journal Entries',
    description:
      'Monthly payroll data creates journal entries for salary expenses, deductions, and liabilities',
    status: 'planned',
    notes: 'When HR module is implemented with payroll functionality',
  },
  {
    sourceModule: 'inventory',
    targetModule: 'accounting',
    integrationType: 'incoming',
    dataType: 'Stock Valuations → Asset Accounts',
    description: 'Inventory valuations update asset accounts for stock on hand',
    status: 'planned',
    notes: 'When Inventory module is implemented',
  },

  // OUTGOING DATA (Data Accounting sends to other modules)
  {
    sourceModule: 'accounting',
    targetModule: 'procurement',
    integrationType: 'outgoing',
    dataType: 'Payment Confirmations → Invoice Status',
    description:
      'When a vendor payment is made, update the corresponding vendor invoice status in Procurement',
    status: 'planned',
    triggerCondition: 'vendorPayment.status === "POSTED"',
    fieldMappings: [
      { source: 'vendorPayment.billAllocations', target: 'vendorInvoice.paymentStatus' },
      { source: 'vendorPayment.paymentDate', target: 'vendorInvoice.paidDate' },
      { source: 'vendorPayment.totalAmount', target: 'vendorInvoice.paidAmount' },
    ],
    notes: 'Reference fields added to VendorPayment type: notifyModules, sourceReferences',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'projects',
    integrationType: 'outgoing',
    dataType: 'Actual Costs → Project Financials',
    description:
      'Real-time cost tracking - cost centre transactions update project financial summaries',
    status: 'active',
    triggerCondition: 'transaction.costCentreId is not null',
    notes: 'Currently active through costCentres collection',
    implementationDate: '2024-Q4',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'projects',
    integrationType: 'outgoing',
    dataType: 'Budget Utilization Alerts',
    description: 'Alert project managers when budget thresholds are reached (e.g., 75%, 90%, 100%)',
    status: 'planned',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'procurement',
    integrationType: 'outgoing',
    dataType: 'Vendor Payment History',
    description:
      'Payment history data for vendor performance evaluation and payment terms negotiation',
    status: 'planned',
    notes: 'Read-only integration for reporting purposes',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'management',
    integrationType: 'outgoing',
    dataType: 'Financial Reports',
    description:
      'Management dashboards display financial statements and key metrics from Accounting',
    status: 'active',
    notes: 'Financial reports (Trial Balance, P&L, Balance Sheet, Cash Flow) currently active',
    implementationDate: '2024-Q4',
  },

  // DATA DEPENDENCIES (Master data Accounting relies on)
  {
    sourceModule: 'entities',
    targetModule: 'accounting',
    integrationType: 'dependency',
    dataType: 'Vendor Master Data',
    description: 'Accounting transactions reference vendor data from the Entities module',
    status: 'active',
    notes: 'Vendor bills and payments require entityId from entities collection',
    implementationDate: '2024-Q4',
  },
  {
    sourceModule: 'entities',
    targetModule: 'accounting',
    integrationType: 'dependency',
    dataType: 'Customer Master Data',
    description:
      'Accounting invoices and receipts reference customer data from the Entities module',
    status: 'active',
    notes: 'Customer invoices and payments require entityId from entities collection',
    implementationDate: '2024-Q4',
  },
  {
    sourceModule: 'projects',
    targetModule: 'accounting',
    integrationType: 'dependency',
    dataType: 'Project List for Cost Centres',
    description: 'Cost centres map to projects for project-based accounting and cost tracking',
    status: 'planned',
    notes: 'Cost centres will reference active projects once Projects module is built',
  },

  // REPORTING DATA (Data Accounting provides to other modules)
  {
    sourceModule: 'accounting',
    targetModule: 'projects',
    integrationType: 'reporting',
    dataType: 'Project Cost Reports',
    description: 'Detailed cost breakdowns by project for project financial analysis',
    status: 'planned',
    notes: 'Cost centre reports showing expenses by category, vendor, time period',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'projects',
    integrationType: 'reporting',
    dataType: 'Budget vs Actual Reports',
    description: 'Comparison of budgeted vs actual costs for project financial control',
    status: 'planned',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'procurement',
    integrationType: 'reporting',
    dataType: 'Vendor Payment History Reports',
    description: 'Historical payment data for vendor evaluation and payment terms analysis',
    status: 'planned',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'procurement',
    integrationType: 'reporting',
    dataType: 'Outstanding Payables Report',
    description: 'Aging analysis of outstanding vendor bills for cash flow planning',
    status: 'planned',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'management',
    integrationType: 'reporting',
    dataType: 'Financial Statements',
    description: 'Trial Balance, Balance Sheet, Profit & Loss, Cash Flow statements',
    status: 'active',
    notes: 'Full suite of financial reports currently available',
    implementationDate: '2024-Q4',
  },
  {
    sourceModule: 'accounting',
    targetModule: 'management',
    integrationType: 'reporting',
    dataType: 'Cash Flow Analysis',
    description: 'Detailed cash flow projections and analysis for treasury management',
    status: 'active',
    implementationDate: '2024-Q4',
  },
];

/**
 * Seed Accounting Module Integrations
 *
 * Populates the moduleIntegrations collection with all defined integration points.
 * This is a one-time setup that can be run by super-admin users.
 *
 * Usage from client:
 *   const functions = getFunctions();
 *   const seedIntegrations = httpsCallable(functions, 'seedAccountingIntegrations');
 *   const result = await seedIntegrations();
 */
export const seedAccountingIntegrations = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
  },
  async (request) => {
    // Check authentication and super-admin permission
    if (!request.auth || !request.auth.token.permissions) {
      throw new HttpsError('permission-denied', 'Authentication required');
    }

    const userPermissions = request.auth.token.permissions as number;

    // Only super-admin (has all permissions) can seed integrations
    if (userPermissions !== ALL_PERMISSIONS) {
      throw new HttpsError(
        'permission-denied',
        'Super Admin privileges required to seed integration data'
      );
    }

    logger.info('Seeding Accounting module integrations', {
      userId: request.auth.uid,
      email: request.auth.token.email,
    });

    try {
      const db = admin.firestore();

      // Check if integrations already exist
      const existingQuery = db
        .collection('moduleIntegrations')
        .where('sourceModule', '==', 'accounting');
      const existingQuery2 = db
        .collection('moduleIntegrations')
        .where('targetModule', '==', 'accounting');

      const [existingSnapshot1, existingSnapshot2] = await Promise.all([
        existingQuery.get(),
        existingQuery2.get(),
      ]);

      const existingCount = existingSnapshot1.size + existingSnapshot2.size;

      if (existingCount > 0) {
        throw new HttpsError(
          'already-exists',
          `Accounting integrations already exist (${existingCount} documents found). Delete existing integrations first if you want to re-seed.`
        );
      }

      // Seed all integrations
      const batch = db.batch();
      const timestamp = admin.firestore.Timestamp.now();

      for (const integration of ACCOUNTING_INTEGRATIONS) {
        const docRef = db.collection('moduleIntegrations').doc();
        batch.set(docRef, {
          ...integration,
          createdBy: request.auth.uid,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      await batch.commit();

      logger.info('Successfully seeded Accounting module integrations', {
        count: ACCOUNTING_INTEGRATIONS.length,
        triggeredBy: request.auth.uid,
      });

      // Count by type
      const byType = ACCOUNTING_INTEGRATIONS.reduce(
        (acc, integration) => {
          acc[integration.integrationType] = (acc[integration.integrationType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const byStatus = ACCOUNTING_INTEGRATIONS.reduce(
        (acc, integration) => {
          acc[integration.status] = (acc[integration.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        success: true,
        integrationsCreated: ACCOUNTING_INTEGRATIONS.length,
        breakdown: {
          byType,
          byStatus,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Error seeding Accounting integrations:', error);
      throw new HttpsError('internal', 'Failed to seed integration data');
    }
  }
);
