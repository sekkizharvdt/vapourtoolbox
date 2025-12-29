// Firestore collection names and references

/**
 * Collection names
 */
export const COLLECTIONS = {
  // Core collections
  USERS: 'users',
  COMPANIES: 'companies',
  COMPANY: 'companies', // Alias for single company access
  DEPARTMENTS: 'departments',
  ENTITIES: 'entities',
  ENTITY_CONTACTS: 'entity_contacts',
  PROJECTS: 'projects',
  PROJECT_ACTIVITIES: 'project_activities',
  PROJECT_MILESTONES: 'project_milestones',
  INVITATIONS: 'invitations', // External CLIENT_PM invitations
  NOTIFICATIONS: 'notifications', // In-app notifications
  AUDIT_LOGS: 'auditLogs', // System audit trail for security and compliance

  // Time Tracking & Task Notifications
  TASK_NOTIFICATIONS: 'taskNotifications', // Unified notification-task system
  TIME_ENTRIES: 'time_entries',
  TASKS: 'tasks', // Legacy - will be migrated to TASK_NOTIFICATIONS
  LEAVES: 'leaves', // Legacy - use HR_LEAVE_REQUESTS instead
  ON_DUTY: 'on_duty',

  // HR Module
  HR_CONFIG: 'hrConfig', // HR module configuration (approvers, policies, etc.)
  HR_LEAVE_TYPES: 'hrLeaveTypes', // Leave type configuration (Sick, Casual, etc.)
  HR_LEAVE_BALANCES: 'hrLeaveBalances', // Employee leave balance per fiscal year
  HR_LEAVE_REQUESTS: 'hrLeaveRequests', // Leave requests with approval workflow
  HR_TRAVEL_EXPENSES: 'hrTravelExpenses', // Travel expense reports with approval workflow
  HR_HOLIDAYS: 'hrHolidays', // Company holidays (Diwali, Pongal, etc.)

  // Slack-like Task Channels (Phase A-C)
  PROJECT_CHANNELS: 'projectChannels', // Custom channels per project
  TASK_THREADS: 'taskThreads', // Threaded discussions on tasks
  TASK_MESSAGES: 'taskMessages', // Messages in threads
  TASK_MENTIONS: 'taskMentions', // @mention notifications

  // Accounting
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  JOURNAL_ENTRIES: 'journal_entries',
  LEDGER_ENTRIES: 'ledger_entries',
  COST_CENTRES: 'costCentres',
  FISCAL_YEARS: 'fiscalYears',
  ACCOUNTING_PERIODS: 'accountingPeriods',
  YEAR_END_CLOSING_ENTRIES: 'yearEndClosingEntries',
  PERIOD_LOCK_AUDIT: 'periodLockAudit',

  // Bank Reconciliation
  BANK_STATEMENTS: 'bankStatements',
  BANK_TRANSACTIONS: 'bankTransactions',
  RECONCILIATION_MATCHES: 'reconciliationMatches',
  RECONCILIATION_REPORTS: 'reconciliationReports',
  RECONCILIATION_ADJUSTMENTS: 'reconciliationAdjustments',

  // Currency & Forex
  EXCHANGE_RATES: 'exchangeRates',
  FOREX_GAIN_LOSS: 'forexGainLoss',
  CURRENCY_CONFIG: 'currencyConfig',

  // Procurement
  PURCHASE_REQUESTS: 'purchaseRequests',
  PURCHASE_REQUEST_ITEMS: 'purchaseRequestItems',
  PURCHASE_REQUEST_ATTACHMENTS: 'purchaseRequestAttachments',
  RFQS: 'rfqs',
  RFQ_ITEMS: 'rfqItems',
  RFQ_TERMS_TEMPLATES: 'rfqTermsTemplates', // Reusable terms & conditions
  RFQ_PDF_RECORDS: 'rfqPdfRecords', // Generated PDF tracking
  OFFERS: 'offers',
  OFFER_ITEMS: 'offerItems',
  OFFER_COMPARISONS: 'offerComparisons',
  PURCHASE_ORDERS: 'purchaseOrders',
  PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
  PURCHASE_ORDER_AMENDMENTS: 'purchaseOrderAmendments',
  PURCHASE_ORDER_VERSIONS: 'purchaseOrderVersions',
  AMENDMENT_APPROVAL_HISTORY: 'amendmentApprovalHistory',
  PACKING_LISTS: 'packingLists',
  PACKING_LIST_ITEMS: 'packingListItems',
  GOODS_RECEIPTS: 'goodsReceipts',
  GOODS_RECEIPT_ITEMS: 'goodsReceiptItems',
  RECEIPT_PHOTOS: 'receiptPhotos',
  WORK_COMPLETION_CERTIFICATES: 'workCompletionCertificates',
  RAW_MATERIALS: 'rawMaterials',

  // 3-Way Matching
  THREE_WAY_MATCHES: 'threeWayMatches',
  MATCH_LINE_ITEMS: 'matchLineItems',
  MATCH_DISCREPANCIES: 'matchDiscrepancies',
  MATCH_TOLERANCE_CONFIGS: 'matchToleranceConfigs',

  // Document Management
  DOCUMENTS: 'documents',
  DOCUMENT_ACTIVITIES: 'documentActivities',
  DOCUMENT_FOLDERS: 'documentFolders', // User-created subfolders for document browser
  COMPANY_DOCUMENTS: 'companyDocuments', // Company-wide documents: SOPs, policies, templates

  // Estimation
  ESTIMATES: 'estimates',
  EQUIPMENT: 'equipment',
  COMPONENTS: 'components',

  // BOM (Bill of Materials) - Week 1 Sprint
  BOMS: 'boms',
  BOM_ITEMS: 'items', // Subcollection under boms/{bomId}/items

  // Material Database (Phase 1)
  MATERIALS: 'materials',
  MATERIAL_PRICES: 'materialPrices',
  STOCK_MOVEMENTS: 'stockMovements',

  // Shape Database
  SHAPES: 'shapes',

  // Service Catalog (Phase 3)
  SERVICES: 'services',
  SERVICE_RATES: 'serviceRates',

  // Cost Configuration (Phase 4)
  COST_CONFIGURATIONS: 'costConfigurations',

  // Proposal Management
  ENQUIRIES: 'enquiries',
  PROPOSALS: 'proposals',

  // Module Integration Management (Super Admin)
  MODULE_INTEGRATIONS: 'moduleIntegrations',

  // System Counters (for sequence generation)
  COUNTERS: 'counters',

  // System Admin
  SYSTEM_STATUS: 'systemStatus', // Package versions, security status (super-admin only)
  FEEDBACK: 'feedback', // User feedback, bug reports, feature requests
} as const;

/**
 * Subcollection names
 */
export const SUBCOLLECTIONS = {
  // Project subcollections
  PROJECT_PROCUREMENT_STATS: 'procurement_stats',
  PROJECT_TIME_STATS: 'time_stats',
  PROJECT_ACCOUNTING_STATS: 'accounting_stats',
  PROJECT_ESTIMATION_STATS: 'estimation_stats',

  // Entity subcollections
  ENTITY_TRANSACTIONS: 'transactions',
  ENTITY_DOCUMENTS: 'documents',

  // SSOT Process Data subcollections (under projects/{projectId})
  SSOT_STREAMS: 'streams',
  SSOT_EQUIPMENT: 'equipment',
  SSOT_LINES: 'lines',
  SSOT_INSTRUMENTS: 'instruments',
  SSOT_VALVES: 'valves',
  SSOT_PIPE_TABLE: 'pipeTable',
} as const;

/**
 * SSOT Collection paths (for convenience)
 */
export const SSOT_COLLECTIONS = {
  STREAMS: (projectId: string) => `projects/${projectId}/streams`,
  EQUIPMENT: (projectId: string) => `projects/${projectId}/equipment`,
  LINES: (projectId: string) => `projects/${projectId}/lines`,
  INSTRUMENTS: (projectId: string) => `projects/${projectId}/instruments`,
  VALVES: (projectId: string) => `projects/${projectId}/valves`,
  PIPE_TABLE: (projectId: string) => `projects/${projectId}/pipeTable`,
} as const;

/**
 * Helper to get collection path
 */
export function getCollectionPath(collection: keyof typeof COLLECTIONS): string {
  return COLLECTIONS[collection];
}

/**
 * Helper to get subcollection path
 */
export function getSubcollectionPath(
  parentCollection: string,
  parentId: string,
  subcollection: keyof typeof SUBCOLLECTIONS
): string {
  return `${parentCollection}/${parentId}/${SUBCOLLECTIONS[subcollection]}`;
}
