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
  LEAVES: 'leaves',
  ON_DUTY: 'on_duty',

  // Accounting
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  JOURNAL_ENTRIES: 'journal_entries',
  LEDGER_ENTRIES: 'ledger_entries',

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
  RFQS: 'rfqs',
  RFQ_ITEMS: 'rfqItems',
  OFFERS: 'offers',
  OFFER_ITEMS: 'offerItems',
  OFFER_COMPARISONS: 'offerComparisons',
  PURCHASE_ORDERS: 'purchaseOrders',
  PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
  PACKING_LISTS: 'packingLists',
  PACKING_LIST_ITEMS: 'packingListItems',
  GOODS_RECEIPTS: 'goodsReceipts',
  GOODS_RECEIPT_ITEMS: 'goodsReceiptItems',
  RECEIPT_PHOTOS: 'receiptPhotos',
  WORK_COMPLETION_CERTIFICATES: 'workCompletionCertificates',
  RAW_MATERIALS: 'rawMaterials',

  // Document Management
  DOCUMENTS: 'documents',
  DOCUMENT_ACTIVITIES: 'documentActivities',

  // Estimation
  ESTIMATES: 'estimates',
  EQUIPMENT: 'equipment',
  COMPONENTS: 'components',
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
