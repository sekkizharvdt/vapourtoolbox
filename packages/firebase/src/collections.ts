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

  // Time Tracking
  TASKS: 'tasks',
  TIME_ENTRIES: 'time_entries',
  LEAVES: 'leaves',
  ON_DUTY: 'on_duty',

  // Accounting
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  JOURNAL_ENTRIES: 'journal_entries',
  LEDGER_ENTRIES: 'ledger_entries',

  // Procurement
  PURCHASE_REQUISITIONS: 'purchase_requisitions',
  RFQS: 'rfqs',
  QUOTATIONS: 'quotations',
  PURCHASE_ORDERS: 'purchase_orders',
  PR_ITEMS: 'pr_items',

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
