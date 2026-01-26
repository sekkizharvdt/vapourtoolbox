#!/usr/bin/env node

/**
 * Accounting Audit MCP Server
 *
 * Provides tools for analyzing accounting data integrity,
 * finding missing details, and identifying issues that need attention.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Collection names matching the app's COLLECTIONS constants
const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  VENDORS: 'vendors',
  CUSTOMERS: 'customers',
  PROJECTS: 'projects',
};

// Initialize Firebase Admin
let db;

function initializeFirebase() {
  const possiblePaths = [
    resolve(__dirname, 'service-account-key.json'),
    resolve(__dirname, '../../service-account-key.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].filter(Boolean);

  let serviceAccountPath = null;
  for (const path of possiblePaths) {
    if (path && existsSync(path)) {
      serviceAccountPath = path;
      break;
    }
  }

  if (!serviceAccountPath) {
    throw new Error(
      'Service account key not found. Please create service-account-key.json in the mcp-servers/accounting-audit directory.'
    );
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
}

// Helper to format dates
function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString().split('T')[0];
}

// Helper to check if GL entries are balanced
function isBalanced(entries) {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return false;
  }

  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

  // Allow small floating point differences
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

// Create MCP server
const server = new Server(
  {
    name: 'accounting-audit',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'audit_data_integrity',
        description:
          'Run a comprehensive audit of accounting data integrity. Checks for unbalanced GL entries, missing required fields, orphaned references, and other data quality issues.',
        inputSchema: {
          type: 'object',
          properties: {
            transactionTypes: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Filter to specific transaction types (e.g., CUSTOMER_INVOICE, VENDOR_BILL). Leave empty for all types.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of issues to return per category. Default: 50',
            },
          },
        },
      },
      {
        name: 'find_incomplete_transactions',
        description:
          'Find transactions with missing or incomplete data such as missing GL entries, missing entity references, or missing descriptions.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'CUSTOMER_INVOICE',
                'CUSTOMER_PAYMENT',
                'VENDOR_BILL',
                'VENDOR_PAYMENT',
                'JOURNAL_ENTRY',
                'DIRECT_PAYMENT',
                'all',
              ],
              description: 'Filter by transaction type. Default: all',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to return. Default: 50',
            },
          },
        },
      },
      {
        name: 'find_overdue_items',
        description:
          'Find overdue invoices and bills that need attention. Returns items past their due date that are not fully paid.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['invoices', 'bills', 'all'],
              description: 'Filter to invoices (receivables) or bills (payables). Default: all',
            },
            daysOverdue: {
              type: 'number',
              description: 'Minimum days overdue to include. Default: 1',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to return. Default: 50',
            },
          },
        },
      },
      {
        name: 'find_unapplied_payments',
        description:
          'Find payments that have not been applied to any invoice or bill, which may indicate incomplete data entry.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['customer', 'vendor', 'all'],
              description: 'Filter by payment type. Default: all',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to return. Default: 50',
            },
          },
        },
      },
      {
        name: 'find_draft_transactions',
        description:
          'Find transactions in DRAFT status that may need to be reviewed and posted.',
        inputSchema: {
          type: 'object',
          properties: {
            olderThanDays: {
              type: 'number',
              description: 'Only show drafts older than this many days. Default: 0 (all drafts)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to return. Default: 50',
            },
          },
        },
      },
      {
        name: 'check_gl_balance',
        description:
          'Verify that the general ledger is balanced (total debits equal total credits) and identify any discrepancies.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format. Default: beginning of current year',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format. Default: today',
            },
          },
        },
      },
      {
        name: 'find_orphaned_entities',
        description:
          'Find transactions that reference non-existent vendors, customers, or accounts.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of items to return. Default: 50',
            },
          },
        },
      },
      {
        name: 'get_audit_summary',
        description:
          'Get a high-level summary of accounting data health with counts of issues by category.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'find_duplicate_numbers',
        description:
          'Find transactions with duplicate transaction numbers, which may indicate data issues.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'CUSTOMER_INVOICE',
                'CUSTOMER_PAYMENT',
                'VENDOR_BILL',
                'VENDOR_PAYMENT',
                'JOURNAL_ENTRY',
                'DIRECT_PAYMENT',
                'all',
              ],
              description: 'Filter by transaction type. Default: all',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'audit_data_integrity': {
        const limit = args?.limit || 50;
        const typeFilter = args?.transactionTypes;

        let query = db.collection(COLLECTIONS.TRANSACTIONS);
        if (typeFilter && typeFilter.length > 0) {
          query = query.where('type', 'in', typeFilter);
        }

        const snapshot = await query.limit(500).get();

        const issues = {
          unbalancedEntries: [],
          missingGLEntries: [],
          missingEntityId: [],
          missingAmount: [],
          invalidStatus: [],
        };

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const txn = {
            id: doc.id,
            type: data.type,
            transactionNumber: data.transactionNumber,
            date: formatDate(data.date || data.transactionDate),
          };

          // Check for missing GL entries
          if (!data.entries || !Array.isArray(data.entries) || data.entries.length === 0) {
            if (data.status === 'POSTED') {
              issues.missingGLEntries.push({
                ...txn,
                issue: 'Posted transaction has no GL entries',
              });
            }
          } else if (!isBalanced(data.entries)) {
            const totalDebit = data.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
            const totalCredit = data.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
            issues.unbalancedEntries.push({
              ...txn,
              totalDebit,
              totalCredit,
              difference: Math.abs(totalDebit - totalCredit),
            });
          }

          // Check for missing entity ID on relevant transactions
          if (['CUSTOMER_INVOICE', 'CUSTOMER_PAYMENT'].includes(data.type)) {
            if (!data.customerId && !data.entityId) {
              issues.missingEntityId.push({
                ...txn,
                issue: 'Customer transaction missing customerId',
              });
            }
          } else if (['VENDOR_BILL', 'VENDOR_PAYMENT'].includes(data.type)) {
            if (!data.vendorId && !data.entityId) {
              issues.missingEntityId.push({
                ...txn,
                issue: 'Vendor transaction missing vendorId',
              });
            }
          }

          // Check for missing amounts
          if (!data.totalAmount && data.totalAmount !== 0) {
            issues.missingAmount.push({
              ...txn,
              issue: 'Transaction missing totalAmount',
            });
          }

          // Check for invalid status
          const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'POSTED', 'VOID', 'CANCELLED'];
          if (data.status && !validStatuses.includes(data.status)) {
            issues.invalidStatus.push({
              ...txn,
              status: data.status,
              issue: `Invalid status: ${data.status}`,
            });
          }
        });

        // Trim to limit
        Object.keys(issues).forEach((key) => {
          issues[key] = issues[key].slice(0, limit);
        });

        const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  summary: {
                    totalTransactionsScanned: snapshot.size,
                    totalIssuesFound: totalIssues,
                    issuesByCategory: Object.fromEntries(
                      Object.entries(issues).map(([k, v]) => [k, v.length])
                    ),
                  },
                  issues,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'find_incomplete_transactions': {
        const type = args?.type || 'all';
        const limit = args?.limit || 50;

        let query = db.collection(COLLECTIONS.TRANSACTIONS);
        if (type !== 'all') {
          query = query.where('type', '==', type);
        }

        const snapshot = await query.limit(200).get();
        const incompleteItems = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const issues = [];

          // Check for various incomplete data scenarios
          if (!data.description && !data.memo && !data.notes) {
            issues.push('Missing description');
          }

          if (!data.transactionNumber) {
            issues.push('Missing transaction number');
          }

          if (!data.date && !data.transactionDate && !data.paymentDate) {
            issues.push('Missing date');
          }

          if (data.status === 'POSTED' && (!data.entries || data.entries.length === 0)) {
            issues.push('Posted without GL entries');
          }

          // Line items without account mapping
          if (data.lineItems && Array.isArray(data.lineItems)) {
            const itemsWithoutAccount = data.lineItems.filter((item) => !item.accountId);
            if (itemsWithoutAccount.length > 0) {
              issues.push(`${itemsWithoutAccount.length} line items without account mapping`);
            }
          }

          if (issues.length > 0) {
            incompleteItems.push({
              id: doc.id,
              type: data.type,
              transactionNumber: data.transactionNumber || 'N/A',
              date: formatDate(data.date || data.transactionDate),
              status: data.status,
              totalAmount: data.totalAmount,
              issues,
            });
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: incompleteItems.length,
                  filter: { type },
                  items: incompleteItems.slice(0, limit),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'find_overdue_items': {
        const type = args?.type || 'all';
        const daysOverdue = args?.daysOverdue || 1;
        const limit = args?.limit || 50;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

        const overdueItems = [];

        // Check invoices (receivables)
        if (type === 'all' || type === 'invoices') {
          const invoicesQuery = db
            .collection(COLLECTIONS.TRANSACTIONS)
            .where('type', '==', 'CUSTOMER_INVOICE')
            .where('paymentStatus', 'in', ['UNPAID', 'PARTIALLY_PAID']);

          const invoicesSnapshot = await invoicesQuery.get();

          invoicesSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : null;

            if (dueDate && dueDate < cutoffDate) {
              const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
              overdueItems.push({
                id: doc.id,
                category: 'invoice',
                transactionNumber: data.transactionNumber,
                entityName: data.customerName || data.entityName,
                entityId: data.customerId || data.entityId,
                totalAmount: data.totalAmount,
                amountDue: data.amountDue || data.totalAmount,
                dueDate: formatDate(data.dueDate),
                daysPastDue,
                paymentStatus: data.paymentStatus,
              });
            }
          });
        }

        // Check bills (payables)
        if (type === 'all' || type === 'bills') {
          const billsQuery = db
            .collection(COLLECTIONS.TRANSACTIONS)
            .where('type', '==', 'VENDOR_BILL')
            .where('paymentStatus', 'in', ['UNPAID', 'PARTIALLY_PAID']);

          const billsSnapshot = await billsQuery.get();

          billsSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : null;

            if (dueDate && dueDate < cutoffDate) {
              const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
              overdueItems.push({
                id: doc.id,
                category: 'bill',
                transactionNumber: data.transactionNumber,
                entityName: data.vendorName || data.entityName,
                entityId: data.vendorId || data.entityId,
                totalAmount: data.totalAmount,
                amountDue: data.amountDue || data.totalAmount,
                dueDate: formatDate(data.dueDate),
                daysPastDue,
                paymentStatus: data.paymentStatus,
              });
            }
          });
        }

        // Sort by days past due (most overdue first)
        overdueItems.sort((a, b) => b.daysPastDue - a.daysPastDue);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: overdueItems.length,
                  filter: { type, daysOverdue },
                  totalOverdueAmount: overdueItems.reduce((sum, item) => sum + (item.amountDue || 0), 0),
                  items: overdueItems.slice(0, limit),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'find_unapplied_payments': {
        const type = args?.type || 'all';
        const limit = args?.limit || 50;

        const unappliedPayments = [];
        const paymentTypes = [];

        if (type === 'all' || type === 'customer') {
          paymentTypes.push('CUSTOMER_PAYMENT');
        }
        if (type === 'all' || type === 'vendor') {
          paymentTypes.push('VENDOR_PAYMENT');
        }

        for (const paymentType of paymentTypes) {
          const query = db.collection(COLLECTIONS.TRANSACTIONS).where('type', '==', paymentType);

          const snapshot = await query.get();

          snapshot.docs.forEach((doc) => {
            const data = doc.data();

            // Check if payment has no allocations or empty allocations
            const hasAllocations =
              data.allocations && Array.isArray(data.allocations) && data.allocations.length > 0;
            const hasLinkedInvoice = data.invoiceId || data.billId;

            if (!hasAllocations && !hasLinkedInvoice) {
              unappliedPayments.push({
                id: doc.id,
                type: data.type,
                transactionNumber: data.transactionNumber,
                date: formatDate(data.paymentDate || data.date),
                entityName: data.entityName || data.customerName || data.vendorName,
                entityId: data.entityId || data.customerId || data.vendorId,
                totalAmount: data.totalAmount,
                paymentMethod: data.paymentMethod,
                status: data.status,
                issue: 'Payment not applied to any invoice/bill',
              });
            }
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: unappliedPayments.length,
                  filter: { type },
                  totalUnappliedAmount: unappliedPayments.reduce(
                    (sum, p) => sum + (p.totalAmount || 0),
                    0
                  ),
                  items: unappliedPayments.slice(0, limit),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'find_draft_transactions': {
        const olderThanDays = args?.olderThanDays || 0;
        const limit = args?.limit || 50;

        const query = db
          .collection(COLLECTIONS.TRANSACTIONS)
          .where('status', '==', 'DRAFT')
          .orderBy('createdAt', 'desc');

        const snapshot = await query.get();

        const today = new Date();
        const cutoffDate = new Date(today);
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const drafts = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;

          if (!olderThanDays || (createdAt && createdAt < cutoffDate)) {
            const daysOld = createdAt
              ? Math.floor((today - createdAt) / (1000 * 60 * 60 * 24))
              : null;

            drafts.push({
              id: doc.id,
              type: data.type,
              transactionNumber: data.transactionNumber || 'N/A',
              date: formatDate(data.date || data.transactionDate),
              createdAt: formatDate(data.createdAt),
              daysOld,
              entityName: data.entityName || data.customerName || data.vendorName,
              totalAmount: data.totalAmount,
              createdBy: data.createdBy,
            });
          }
        });

        // Sort by oldest first
        drafts.sort((a, b) => (b.daysOld || 0) - (a.daysOld || 0));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: drafts.length,
                  filter: { olderThanDays },
                  items: drafts.slice(0, limit),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'check_gl_balance': {
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1);

        const startDate = args?.startDate ? new Date(args.startDate) : startOfYear;
        const endDate = args?.endDate ? new Date(args.endDate) : today;

        const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
        const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);

        const query = db
          .collection(COLLECTIONS.TRANSACTIONS)
          .where('date', '>=', startTimestamp)
          .where('date', '<=', endTimestamp)
          .where('status', '==', 'POSTED');

        const snapshot = await query.get();

        let totalDebit = 0;
        let totalCredit = 0;
        const unbalancedTransactions = [];
        const accountTotals = new Map();

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const entries = data.entries || [];

          let txnDebit = 0;
          let txnCredit = 0;

          entries.forEach((entry) => {
            const debit = entry.debit || 0;
            const credit = entry.credit || 0;

            txnDebit += debit;
            txnCredit += credit;
            totalDebit += debit;
            totalCredit += credit;

            // Track by account
            if (entry.accountId) {
              const current = accountTotals.get(entry.accountId) || {
                accountId: entry.accountId,
                accountName: entry.accountName || 'Unknown',
                debit: 0,
                credit: 0,
              };
              current.debit += debit;
              current.credit += credit;
              accountTotals.set(entry.accountId, current);
            }
          });

          // Check if transaction is balanced
          if (Math.abs(txnDebit - txnCredit) > 0.01) {
            unbalancedTransactions.push({
              id: doc.id,
              type: data.type,
              transactionNumber: data.transactionNumber,
              date: formatDate(data.date),
              totalDebit: txnDebit,
              totalCredit: txnCredit,
              difference: Math.abs(txnDebit - txnCredit),
            });
          }
        });

        const isGLBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  period: {
                    startDate: formatDate(startTimestamp),
                    endDate: formatDate(endTimestamp),
                  },
                  summary: {
                    transactionsAnalyzed: snapshot.size,
                    totalDebit,
                    totalCredit,
                    difference: Math.abs(totalDebit - totalCredit),
                    isBalanced: isGLBalanced,
                  },
                  unbalancedTransactions:
                    unbalancedTransactions.length > 0
                      ? unbalancedTransactions.slice(0, 20)
                      : 'None found',
                  unbalancedCount: unbalancedTransactions.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'find_orphaned_entities': {
        const limit = args?.limit || 50;

        // Get all valid entity IDs
        const [vendorsSnapshot, customersSnapshot, accountsSnapshot] = await Promise.all([
          db.collection(COLLECTIONS.VENDORS).get(),
          db.collection(COLLECTIONS.CUSTOMERS).get(),
          db.collection(COLLECTIONS.ACCOUNTS).get(),
        ]);

        const validVendorIds = new Set(vendorsSnapshot.docs.map((d) => d.id));
        const validCustomerIds = new Set(customersSnapshot.docs.map((d) => d.id));
        const validAccountIds = new Set(accountsSnapshot.docs.map((d) => d.id));

        const orphanedItems = [];

        // Check transactions
        const transactionsSnapshot = await db.collection(COLLECTIONS.TRANSACTIONS).limit(500).get();

        transactionsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const issues = [];

          // Check vendor references
          if (data.vendorId && !validVendorIds.has(data.vendorId)) {
            issues.push(`References non-existent vendor: ${data.vendorId}`);
          }

          // Check customer references
          if (data.customerId && !validCustomerIds.has(data.customerId)) {
            issues.push(`References non-existent customer: ${data.customerId}`);
          }

          // Check account references in GL entries
          if (data.entries && Array.isArray(data.entries)) {
            data.entries.forEach((entry, index) => {
              if (entry.accountId && !validAccountIds.has(entry.accountId)) {
                issues.push(`GL entry ${index + 1} references non-existent account: ${entry.accountId}`);
              }
            });
          }

          // Check bank account reference
          if (data.bankAccountId && !validAccountIds.has(data.bankAccountId)) {
            issues.push(`References non-existent bank account: ${data.bankAccountId}`);
          }

          if (issues.length > 0) {
            orphanedItems.push({
              id: doc.id,
              type: data.type,
              transactionNumber: data.transactionNumber,
              date: formatDate(data.date || data.transactionDate),
              issues,
            });
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: orphanedItems.length,
                  entityCounts: {
                    vendors: validVendorIds.size,
                    customers: validCustomerIds.size,
                    accounts: validAccountIds.size,
                  },
                  items: orphanedItems.slice(0, limit),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_audit_summary': {
        // Run quick checks on all categories
        const transactionsSnapshot = await db.collection(COLLECTIONS.TRANSACTIONS).get();

        const summary = {
          totalTransactions: transactionsSnapshot.size,
          byStatus: {},
          byType: {},
          dataQualityIssues: {
            unbalancedGLEntries: 0,
            missingGLEntries: 0,
            missingEntityReference: 0,
            draftsOlderThan7Days: 0,
          },
          actionRequired: {
            overdueInvoices: 0,
            overdueBills: 0,
            unappliedPayments: 0,
            pendingApproval: 0,
          },
        };

        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        transactionsSnapshot.docs.forEach((doc) => {
          const data = doc.data();

          // Count by status
          summary.byStatus[data.status] = (summary.byStatus[data.status] || 0) + 1;

          // Count by type
          summary.byType[data.type] = (summary.byType[data.type] || 0) + 1;

          // Check data quality
          if (data.status === 'POSTED') {
            if (!data.entries || data.entries.length === 0) {
              summary.dataQualityIssues.missingGLEntries++;
            } else if (!isBalanced(data.entries)) {
              summary.dataQualityIssues.unbalancedGLEntries++;
            }
          }

          // Check for missing entity references
          if (
            ['CUSTOMER_INVOICE', 'CUSTOMER_PAYMENT'].includes(data.type) &&
            !data.customerId &&
            !data.entityId
          ) {
            summary.dataQualityIssues.missingEntityReference++;
          } else if (
            ['VENDOR_BILL', 'VENDOR_PAYMENT'].includes(data.type) &&
            !data.vendorId &&
            !data.entityId
          ) {
            summary.dataQualityIssues.missingEntityReference++;
          }

          // Check for old drafts
          if (data.status === 'DRAFT') {
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
            if (createdAt && createdAt < sevenDaysAgo) {
              summary.dataQualityIssues.draftsOlderThan7Days++;
            }
          }

          // Check overdue items
          if (data.type === 'CUSTOMER_INVOICE' && ['UNPAID', 'PARTIALLY_PAID'].includes(data.paymentStatus)) {
            const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : null;
            if (dueDate && dueDate < today) {
              summary.actionRequired.overdueInvoices++;
            }
          }

          if (data.type === 'VENDOR_BILL' && ['UNPAID', 'PARTIALLY_PAID'].includes(data.paymentStatus)) {
            const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : null;
            if (dueDate && dueDate < today) {
              summary.actionRequired.overdueBills++;
            }
          }

          // Check pending approval
          if (data.status === 'PENDING') {
            summary.actionRequired.pendingApproval++;
          }

          // Check unapplied payments
          if (['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT'].includes(data.type)) {
            const hasAllocations =
              data.allocations && Array.isArray(data.allocations) && data.allocations.length > 0;
            const hasLinkedDoc = data.invoiceId || data.billId;
            if (!hasAllocations && !hasLinkedDoc) {
              summary.actionRequired.unappliedPayments++;
            }
          }
        });

        // Calculate health score (0-100)
        const totalIssues =
          Object.values(summary.dataQualityIssues).reduce((a, b) => a + b, 0) +
          Object.values(summary.actionRequired).reduce((a, b) => a + b, 0);

        const healthScore = Math.max(
          0,
          Math.round(100 - (totalIssues / Math.max(summary.totalTransactions, 1)) * 100)
        );

        summary.healthScore = healthScore;
        summary.healthRating =
          healthScore >= 90
            ? 'Excellent'
            : healthScore >= 70
              ? 'Good'
              : healthScore >= 50
                ? 'Needs Attention'
                : 'Critical';

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case 'find_duplicate_numbers': {
        const type = args?.type || 'all';

        let query = db.collection(COLLECTIONS.TRANSACTIONS);
        if (type !== 'all') {
          query = query.where('type', '==', type);
        }

        const snapshot = await query.get();

        // Group by transaction number
        const numberMap = new Map();

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const txnNumber = data.transactionNumber;

          if (txnNumber) {
            if (!numberMap.has(txnNumber)) {
              numberMap.set(txnNumber, []);
            }
            numberMap.get(txnNumber).push({
              id: doc.id,
              type: data.type,
              transactionNumber: txnNumber,
              date: formatDate(data.date || data.transactionDate),
              status: data.status,
              totalAmount: data.totalAmount,
            });
          }
        });

        // Find duplicates
        const duplicates = [];
        numberMap.forEach((items, number) => {
          if (items.length > 1) {
            duplicates.push({
              transactionNumber: number,
              count: items.length,
              transactions: items,
            });
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  filter: { type },
                  duplicateNumbersFound: duplicates.length,
                  totalAffectedTransactions: duplicates.reduce((sum, d) => sum + d.count, 0),
                  duplicates,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }),
        },
      ],
    };
  }
});

// Main
async function main() {
  try {
    initializeFirebase();
    console.error('Firebase initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Accounting Audit MCP server running');
}

main().catch(console.error);
