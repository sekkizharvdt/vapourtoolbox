/**
 * Schema Registry - Central definition of expected schemas for all collections
 *
 * This file defines the expected schema for each Firestore collection.
 * Used by:
 * - Schema analysis scripts
 * - Migration planning
 * - Type validation
 * - Pre-deployment checks
 *
 * Update this file when you add new fields or collections.
 */

const SCHEMA_REGISTRY = {
  // ==================== CORE COLLECTIONS ====================

  users: {
    required: ['uid', 'email', 'displayName', 'roles', 'permissions', 'domain', 'status', 'isActive', 'createdAt', 'updatedAt'],
    recommended: ['department', 'phoneNumber', 'photoURL'],
    optional: ['bio', 'preferences', 'lastLogin', 'emailVerified'],
    deprecated: [],
  },

  companies: {
    required: ['id', 'name', 'code', 'isActive', 'createdAt', 'updatedAt'],
    recommended: ['legalName', 'registrationNumber', 'taxId', 'address', 'phone', 'email'],
    optional: ['website', 'logo', 'description', 'industry'],
    deprecated: [],
  },

  departments: {
    required: ['id', 'name', 'code', 'companyId', 'isActive', 'createdAt', 'updatedAt'],
    recommended: ['headId', 'description'],
    optional: ['budget', 'employeeCount'],
    deprecated: [],
  },

  entities: {
    required: ['id', 'code', 'name', 'roles', 'status', 'createdAt', 'updatedAt'],
    recommended: ['isDeleted', 'isActive', 'legalName'],
    optional: [
      'displayName', 'contacts', 'primaryContactId',
      'billingAddress', 'shippingAddress',
      'taxIdentifiers', 'bankDetails',
      'creditTerms', 'paymentTerms',
      'industry', 'category', 'tags', 'notes',
      'assignedToUserId',
      'totalProjects', 'totalTransactions', 'outstandingAmount'
    ],
    deprecated: ['contactPerson', 'email', 'phone', 'mobile'], // Replaced by contacts array
  },

  projects: {
    required: ['id', 'code', 'name', 'status', 'priority', 'client', 'projectManager', 'createdAt', 'updatedAt'],
    recommended: [
      'description', 'startDate', 'endDate', 'expectedEndDate',
      'team', 'tags', 'isDeleted', 'isActive'
    ],
    optional: [
      'budget', 'actualCost', 'progress',
      'location', 'contractValue',
      'milestones', 'risks', 'notes'
    ],
    deprecated: [],
  },

  invitations: {
    required: ['id', 'email', 'projectId', 'role', 'status', 'invitedBy', 'createdAt', 'expiresAt'],
    recommended: ['acceptedAt', 'rejectedAt'],
    optional: ['message', 'userId'],
    deprecated: [],
  },

  notifications: {
    required: ['id', 'userId', 'type', 'title', 'message', 'read', 'createdAt'],
    recommended: ['link', 'metadata'],
    optional: ['actionLabel', 'actionUrl', 'priority'],
    deprecated: [],
  },

  auditLogs: {
    required: ['id', 'action', 'actorId', 'actorEmail', 'entityType', 'entityId', 'timestamp', 'changes'],
    recommended: ['severity', 'ipAddress', 'userAgent'],
    optional: ['metadata', 'previousValues', 'newValues'],
    deprecated: [],
  },

  // ==================== TIME TRACKING ====================

  tasks: {
    required: ['id', 'title', 'projectId', 'assignedTo', 'status', 'createdAt', 'updatedAt'],
    recommended: ['description', 'priority', 'dueDate', 'estimatedHours'],
    optional: ['tags', 'attachments', 'dependencies', 'completedAt', 'actualHours'],
    deprecated: [],
  },

  time_entries: {
    required: ['id', 'userId', 'projectId', 'date', 'hours', 'status', 'createdAt', 'updatedAt'],
    recommended: ['description', 'taskId', 'workArea', 'billable'],
    optional: ['approvedBy', 'approvedAt', 'rejectedReason'],
    deprecated: [],
  },

  leaves: {
    required: ['id', 'userId', 'type', 'startDate', 'endDate', 'status', 'createdAt'],
    recommended: ['reason', 'approvedBy', 'approvedAt'],
    optional: ['attachments', 'rejectedReason', 'days'],
    deprecated: [],
  },

  on_duty: {
    required: ['id', 'userId', 'date', 'purpose', 'status', 'createdAt'],
    recommended: ['location', 'approvedBy', 'approvedAt'],
    optional: ['notes', 'expenses'],
    deprecated: [],
  },

  // ==================== ACCOUNTING ====================

  accounts: {
    required: ['id', 'code', 'name', 'type', 'category', 'isActive', 'createdAt', 'updatedAt'],
    recommended: ['description', 'balance', 'currency'],
    optional: ['parentAccountId', 'tags'],
    deprecated: [],
  },

  transactions: {
    required: ['id', 'type', 'amount', 'currency', 'date', 'accountId', 'status', 'createdAt'],
    recommended: ['description', 'reference', 'projectId'],
    optional: ['attachments', 'approvedBy', 'approvedAt'],
    deprecated: [],
  },

  journal_entries: {
    required: ['id', 'date', 'description', 'entries', 'createdAt', 'createdBy'],
    recommended: ['reference', 'projectId', 'status'],
    optional: ['approvedBy', 'approvedAt', 'tags'],
    deprecated: [],
  },

  ledger_entries: {
    required: ['id', 'accountId', 'transactionId', 'type', 'amount', 'date', 'createdAt'],
    recommended: ['description', 'balance'],
    optional: ['projectId', 'reference'],
    deprecated: [],
  },

  // ==================== PROCUREMENT ====================

  purchase_requisitions: {
    required: ['id', 'code', 'projectId', 'requestedBy', 'status', 'priority', 'items', 'createdAt', 'updatedAt'],
    recommended: ['description', 'requiredDate', 'approvals'],
    optional: ['budgetCode', 'notes', 'attachments'],
    deprecated: [],
  },

  rfqs: {
    required: ['id', 'code', 'projectId', 'requisitionId', 'vendors', 'status', 'dueDate', 'createdAt'],
    recommended: ['description', 'terms', 'items'],
    optional: ['quotationsReceived', 'selectedQuotationId', 'notes'],
    deprecated: [],
  },

  quotations: {
    required: ['id', 'rfqId', 'vendorId', 'items', 'totalAmount', 'currency', 'validUntil', 'createdAt'],
    recommended: ['status', 'terms', 'deliveryTime'],
    optional: ['notes', 'attachments', 'selectedForPO'],
    deprecated: [],
  },

  purchase_orders: {
    required: ['id', 'code', 'projectId', 'vendorId', 'items', 'totalAmount', 'currency', 'status', 'createdAt'],
    recommended: ['deliveryDate', 'deliveryAddress', 'terms', 'approvals'],
    optional: ['quotationId', 'notes', 'attachments', 'receivedDate'],
    deprecated: [],
  },

  pr_items: {
    required: ['id', 'requisitionId', 'description', 'quantity', 'unit', 'estimatedCost'],
    recommended: ['specifications', 'purpose'],
    optional: ['approvedQuantity', 'approvedCost', 'notes'],
    deprecated: [],
  },

  // ==================== ESTIMATION ====================

  estimates: {
    required: ['id', 'code', 'projectId', 'version', 'status', 'totalCost', 'createdAt', 'createdBy'],
    recommended: ['description', 'items', 'validUntil', 'approvedBy', 'approvedAt'],
    optional: ['notes', 'assumptions', 'contingency', 'markup'],
    deprecated: [],
  },

  equipment: {
    required: ['id', 'code', 'name', 'type', 'status', 'createdAt', 'updatedAt'],
    recommended: ['description', 'manufacturer', 'model', 'cost'],
    optional: ['serialNumber', 'purchaseDate', 'warrantyExpiry', 'location'],
    deprecated: [],
  },

  components: {
    required: ['id', 'code', 'name', 'type', 'unit', 'createdAt', 'updatedAt'],
    recommended: ['description', 'cost', 'supplier'],
    optional: ['specifications', 'leadTime', 'minimumOrder'],
    deprecated: [],
  },
};

/**
 * Get schema for a collection
 */
function getCollectionSchema(collectionName) {
  return SCHEMA_REGISTRY[collectionName] || null;
}

/**
 * Get all collection names
 */
function getAllCollections() {
  return Object.keys(SCHEMA_REGISTRY);
}

/**
 * Get collections by category
 */
function getCollectionsByCategory() {
  return {
    core: ['users', 'companies', 'departments', 'entities', 'projects', 'invitations', 'notifications', 'auditLogs'],
    timeTracking: ['tasks', 'time_entries', 'leaves', 'on_duty'],
    accounting: ['accounts', 'transactions', 'journal_entries', 'ledger_entries'],
    procurement: ['purchase_requisitions', 'rfqs', 'quotations', 'purchase_orders', 'pr_items'],
    estimation: ['estimates', 'equipment', 'components'],
  };
}

module.exports = {
  SCHEMA_REGISTRY,
  getCollectionSchema,
  getAllCollections,
  getCollectionsByCategory,
};
