/**
 * Module Stats Service
 *
 * Fetches statistics and pending counts for each module
 * Used by the dashboard to show badges and quick stats
 */

import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
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
async function getTasksStats(tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending tasks
    const pendingTasksQuery = query(
      collection(db, 'tasks'),
      where('tenantId', '==', tenantId),
      where('status', '==', 'PENDING')
    );
    const pendingSnapshot = await getCountFromServer(pendingTasksQuery);

    // Count on-duty today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const onDutyQuery = query(
      collection(db, 'onDutyRecords'),
      where('tenantId', '==', tenantId),
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
async function getDocumentStats(tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count documents created in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentDocsQuery = query(
      collection(db, 'documents'),
      where('tenantId', '==', tenantId),
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
async function getProcurementStats(tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending purchase requests
    const pendingPRsQuery = query(
      collection(db, 'purchaseRequests'),
      where('tenantId', '==', tenantId),
      where('status', '==', 'PENDING_APPROVAL')
    );
    const pendingPRsSnapshot = await getCountFromServer(pendingPRsQuery);

    // Count pending RFQs
    const pendingRFQsQuery = query(
      collection(db, 'rfqs'),
      where('tenantId', '==', tenantId),
      where('status', 'in', ['DRAFT', 'SENT', 'PENDING_REVIEW'])
    );
    const pendingRFQsSnapshot = await getCountFromServer(pendingRFQsQuery);

    // Count pending POs
    const pendingPOsQuery = query(
      collection(db, 'purchaseOrders'),
      where('tenantId', '==', tenantId),
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
async function getAccountingStats(_tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending customer invoices
    const pendingInvoicesQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('type', '==', 'CUSTOMER_INVOICE'),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingInvoicesSnapshot = await getCountFromServer(pendingInvoicesQuery);

    // Count pending vendor bills
    const pendingBillsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('type', '==', 'VENDOR_BILL'),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingBillsSnapshot = await getCountFromServer(pendingBillsQuery);

    const totalPending =
      (pendingInvoicesSnapshot.data().count || 0) + (pendingBillsSnapshot.data().count || 0);

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
async function getProjectStats(tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count active projects
    const activeProjectsQuery = query(
      collection(db, 'projects'),
      where('tenantId', '==', tenantId),
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
async function getEstimationStats(tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count draft estimates
    const draftEstimatesQuery = query(
      collection(db, 'estimates'),
      where('tenantId', '==', tenantId),
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
async function getHRStats(tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending leave requests
    const pendingLeavesQuery = query(
      collection(db, 'leaveRequests'),
      where('tenantId', '==', tenantId),
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
async function getProposalStats(tenantId: string): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count proposals in draft or internal review
    const pendingProposalsQuery = query(
      collection(db, 'proposals'),
      where('tenantId', '==', tenantId),
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
 * Get stats for Admin module — pending (new + in_progress) feedback count.
 */
async function getAdminStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    const feedbackRef = collection(db, COLLECTIONS.FEEDBACK);
    const [newSnap, inProgressSnap] = await Promise.all([
      getCountFromServer(query(feedbackRef, where('status', '==', 'new'))),
      getCountFromServer(query(feedbackRef, where('status', '==', 'in_progress'))),
    ]);

    return {
      moduleId: 'admin',
      pendingCount: (newSnap.data().count || 0) + (inProgressSnap.data().count || 0),
      label: 'Open Feedback',
    };
  } catch (error) {
    logger.error('Failed to fetch admin stats', error);
    return { moduleId: 'admin', pendingCount: 0 };
  }
}

/**
 * Get stats for all modules
 * Returns stats for modules the user has access to
 */
export async function getAllModuleStats(
  accessibleModuleIds: string[],
  tenantId: string
): Promise<ModuleStats[]> {
  const statsPromises: Promise<ModuleStats>[] = [];

  for (const moduleId of accessibleModuleIds) {
    switch (moduleId) {
      case 'time-tracking':
        statsPromises.push(getTasksStats(tenantId));
        break;
      case 'document-management':
        statsPromises.push(getDocumentStats(tenantId));
        break;
      case 'procurement':
        statsPromises.push(getProcurementStats(tenantId));
        break;
      case 'accounting':
        statsPromises.push(getAccountingStats(tenantId));
        break;
      case 'project-management':
        statsPromises.push(getProjectStats(tenantId));
        break;
      case 'estimation':
        statsPromises.push(getEstimationStats(tenantId));
        break;
      case 'entity-management':
        statsPromises.push(getEntityStats());
        break;
      case 'user-management':
        statsPromises.push(getUserStats());
        break;
      case 'hr-management':
        statsPromises.push(getHRStats(tenantId));
        break;
      case 'proposal-management':
        statsPromises.push(getProposalStats(tenantId));
        break;
      case 'admin':
        statsPromises.push(getAdminStats());
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
  tenantId: string
): Promise<ModuleStats | null> {
  switch (moduleId) {
    case 'time-tracking':
      return getTasksStats(tenantId);
    case 'document-management':
      return getDocumentStats(tenantId);
    case 'procurement':
      return getProcurementStats(tenantId);
    case 'accounting':
      return getAccountingStats(tenantId);
    case 'project-management':
      return getProjectStats(tenantId);
    case 'estimation':
      return getEstimationStats(tenantId);
    case 'entity-management':
      return getEntityStats();
    case 'user-management':
      return getUserStats();
    case 'hr-management':
      return getHRStats(tenantId);
    case 'proposal-management':
      return getProposalStats(tenantId);
    case 'admin':
      return getAdminStats();
    default:
      return null;
  }
}
