/**
 * Module Stats Service
 *
 * Fetches statistics and pending counts for each module
 * Used by the dashboard to show badges and quick stats
 */

import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { createLogger } from '@vapour/utils';

const logger = createLogger('ModuleStats');

export interface ModuleStats {
  moduleId: string;
  pendingCount?: number;
  totalCount?: number;
  recentCount?: number;
  label?: string;
  lastActivity?: Date;
}

/**
 * Get stats for Tasks module (Time Tracking)
 */
async function getTasksStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending tasks
    const pendingTasksQuery = query(
      collection(db, 'tasks'),
      where('entityId', '==', entityId),
      where('status', '==', 'PENDING')
    );
    const pendingSnapshot = await getCountFromServer(pendingTasksQuery);

    // Count on-duty today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const onDutyQuery = query(
      collection(db, 'onDutyRecords'),
      where('entityId', '==', entityId),
      where('date', '>=', Timestamp.fromDate(today)),
      where('status', '==', 'APPROVED')
    );
    const onDutySnapshot = await getCountFromServer(onDutyQuery);

    return {
      moduleId: 'time-tracking',
      pendingCount: pendingSnapshot.data().count || 0,
      recentCount: onDutySnapshot.data().count || 0,
      label: 'Pending Tasks',
    };
  } catch (error) {
    logger.error('Failed to fetch tasks stats', error);
    return { moduleId: 'time-tracking', pendingCount: 0 };
  }
}

/**
 * Get stats for Document Management module
 */
async function getDocumentStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count documents created in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentDocsQuery = query(
      collection(db, 'documents'),
      where('entityId', '==', entityId),
      where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
    );
    const recentSnapshot = await getCountFromServer(recentDocsQuery);

    return {
      moduleId: 'document-management',
      recentCount: recentSnapshot.data().count || 0,
      label: 'Recent Documents',
    };
  } catch (error) {
    logger.error('Failed to fetch document stats', error);
    return { moduleId: 'document-management', recentCount: 0 };
  }
}

/**
 * Get stats for Procurement module
 */
async function getProcurementStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending purchase requests
    const pendingPRsQuery = query(
      collection(db, 'purchaseRequests'),
      where('entityId', '==', entityId),
      where('status', '==', 'PENDING_APPROVAL')
    );
    const pendingPRsSnapshot = await getCountFromServer(pendingPRsQuery);

    // Count pending RFQs
    const pendingRFQsQuery = query(
      collection(db, 'rfqs'),
      where('entityId', '==', entityId),
      where('status', 'in', ['DRAFT', 'SENT', 'PENDING_REVIEW'])
    );
    const pendingRFQsSnapshot = await getCountFromServer(pendingRFQsQuery);

    // Count pending POs
    const pendingPOsQuery = query(
      collection(db, 'purchaseOrders'),
      where('entityId', '==', entityId),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingPOsSnapshot = await getCountFromServer(pendingPOsQuery);

    const totalPending =
      (pendingPRsSnapshot.data().count || 0) +
      (pendingRFQsSnapshot.data().count || 0) +
      (pendingPOsSnapshot.data().count || 0);

    return {
      moduleId: 'procurement',
      pendingCount: totalPending,
      label: 'Pending Items',
    };
  } catch (error) {
    logger.error('Failed to fetch procurement stats', error);
    return { moduleId: 'procurement', pendingCount: 0 };
  }
}

/**
 * Get stats for Accounting module
 */
async function getAccountingStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending customer invoices
    const pendingInvoicesQuery = query(
      collection(db, 'customerInvoices'),
      where('entityId', '==', entityId),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingInvoicesSnapshot = await getCountFromServer(pendingInvoicesQuery);

    // Count pending vendor bills
    const pendingBillsQuery = query(
      collection(db, 'vendorBills'),
      where('entityId', '==', entityId),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingBillsSnapshot = await getCountFromServer(pendingBillsQuery);

    // Count unreconciled bank transactions
    const unreconciledQuery = query(
      collection(db, 'bankReconciliation'),
      where('entityId', '==', entityId),
      where('status', '==', 'UNRECONCILED')
    );
    const unreconciledSnapshot = await getCountFromServer(unreconciledQuery);

    const totalPending =
      (pendingInvoicesSnapshot.data().count || 0) +
      (pendingBillsSnapshot.data().count || 0) +
      (unreconciledSnapshot.data().count || 0);

    return {
      moduleId: 'accounting',
      pendingCount: totalPending,
      label: 'Pending Items',
    };
  } catch (error) {
    logger.error('Failed to fetch accounting stats', error);
    return { moduleId: 'accounting', pendingCount: 0 };
  }
}

/**
 * Get stats for Project Management module
 */
async function getProjectStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count active projects
    const activeProjectsQuery = query(
      collection(db, 'projects'),
      where('entityId', '==', entityId),
      where('status', 'in', ['ACTIVE', 'IN_PROGRESS'])
    );
    const activeSnapshot = await getCountFromServer(activeProjectsQuery);

    return {
      moduleId: 'project-management',
      totalCount: activeSnapshot.data().count || 0,
      label: 'Active Projects',
    };
  } catch (error) {
    logger.error('Failed to fetch project stats', error);
    return { moduleId: 'project-management', totalCount: 0 };
  }
}

/**
 * Get stats for Estimation module
 */
async function getEstimationStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count draft estimates
    const draftEstimatesQuery = query(
      collection(db, 'estimates'),
      where('entityId', '==', entityId),
      where('status', '==', 'DRAFT')
    );
    const draftSnapshot = await getCountFromServer(draftEstimatesQuery);

    return {
      moduleId: 'estimation',
      pendingCount: draftSnapshot.data().count || 0,
      label: 'Draft Estimates',
    };
  } catch (error) {
    logger.error('Failed to fetch estimation stats', error);
    return { moduleId: 'estimation', pendingCount: 0 };
  }
}

/**
 * Get stats for Entity Management module
 */
async function getEntityStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count total entities
    const entitiesQuery = query(collection(db, 'entities'), where('isActive', '==', true));
    const entitiesSnapshot = await getCountFromServer(entitiesQuery);

    return {
      moduleId: 'entity-management',
      totalCount: entitiesSnapshot.data().count || 0,
      label: 'Active Entities',
    };
  } catch (error) {
    logger.error('Failed to fetch entity stats', error);
    return { moduleId: 'entity-management', totalCount: 0 };
  }
}

/**
 * Get stats for User Management module
 */
async function getUserStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count active users
    const activeUsersQuery = query(collection(db, 'users'), where('isActive', '==', true));
    const activeSnapshot = await getCountFromServer(activeUsersQuery);

    return {
      moduleId: 'user-management',
      totalCount: activeSnapshot.data().count || 0,
      label: 'Active Users',
    };
  } catch (error) {
    logger.error('Failed to fetch user stats', error);
    return { moduleId: 'user-management', totalCount: 0 };
  }
}

/**
 * Get stats for HR module
 */
async function getHRStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending leave requests
    const pendingLeavesQuery = query(
      collection(db, 'leaveRequests'),
      where('entityId', '==', entityId),
      where('status', '==', 'PENDING')
    );
    const pendingSnapshot = await getCountFromServer(pendingLeavesQuery);

    return {
      moduleId: 'hr-management',
      pendingCount: pendingSnapshot.data().count || 0,
      label: 'Pending Leaves',
    };
  } catch (error) {
    logger.error('Failed to fetch HR stats', error);
    return { moduleId: 'hr-management', pendingCount: 0 };
  }
}

/**
 * Get stats for Proposals module
 */
async function getProposalStats(entityId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count proposals in draft or internal review
    const pendingProposalsQuery = query(
      collection(db, 'proposals'),
      where('entityId', '==', entityId),
      where('status', 'in', ['DRAFT', 'INTERNAL_REVIEW'])
    );
    const pendingSnapshot = await getCountFromServer(pendingProposalsQuery);

    return {
      moduleId: 'proposal-management',
      pendingCount: pendingSnapshot.data().count || 0,
      label: 'In Progress',
    };
  } catch (error) {
    logger.error('Failed to fetch proposal stats', error);
    return { moduleId: 'proposal-management', pendingCount: 0 };
  }
}

/**
 * Get stats for all modules
 * Returns stats for modules the user has access to
 */
export async function getAllModuleStats(
  accessibleModuleIds: string[],
  entityId: string
): Promise<ModuleStats[]> {
  const statsPromises: Promise<ModuleStats>[] = [];

  for (const moduleId of accessibleModuleIds) {
    switch (moduleId) {
      case 'time-tracking':
        statsPromises.push(getTasksStats(entityId));
        break;
      case 'document-management':
        statsPromises.push(getDocumentStats(entityId));
        break;
      case 'procurement':
        statsPromises.push(getProcurementStats(entityId));
        break;
      case 'accounting':
        statsPromises.push(getAccountingStats(entityId));
        break;
      case 'project-management':
        statsPromises.push(getProjectStats(entityId));
        break;
      case 'estimation':
        statsPromises.push(getEstimationStats(entityId));
        break;
      case 'entity-management':
        statsPromises.push(getEntityStats());
        break;
      case 'user-management':
        statsPromises.push(getUserStats());
        break;
      case 'hr-management':
        statsPromises.push(getHRStats(entityId));
        break;
      case 'proposal-management':
        statsPromises.push(getProposalStats(entityId));
        break;
      // Modules without stats (reference data / calculators)
      case 'material-database':
      case 'shape-database':
      case 'bought-out-database':
      case 'thermal-desal':
      case 'thermal-calcs':
      case 'process-data':
      case 'company-settings':
        // No stats for these modules - they are reference data or calculators
        break;
    }
  }

  try {
    const stats = await Promise.all(statsPromises);
    return stats;
  } catch (error) {
    logger.error('Failed to fetch all module stats', error);
    return [];
  }
}

/**
 * Get stats for a single module
 */
export async function getModuleStats(
  moduleId: string,
  entityId: string
): Promise<ModuleStats | null> {
  switch (moduleId) {
    case 'time-tracking':
      return getTasksStats(entityId);
    case 'document-management':
      return getDocumentStats(entityId);
    case 'procurement':
      return getProcurementStats(entityId);
    case 'accounting':
      return getAccountingStats(entityId);
    case 'project-management':
      return getProjectStats(entityId);
    case 'estimation':
      return getEstimationStats(entityId);
    case 'entity-management':
      return getEntityStats();
    case 'user-management':
      return getUserStats();
    case 'hr-management':
      return getHRStats(entityId);
    case 'proposal-management':
      return getProposalStats(entityId);
    default:
      return null;
  }
}
