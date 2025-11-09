/**
 * Module Stats Service
 *
 * Fetches statistics and pending counts for each module
 * Used by the dashboard to show badges and quick stats
 */

import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';

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
async function getTasksStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending tasks
    const pendingTasksQuery = query(collection(db, 'tasks'), where('status', '==', 'PENDING'));
    const pendingSnapshot = await getCountFromServer(pendingTasksQuery);

    // Count on-duty today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const onDutyQuery = query(
      collection(db, 'onDutyRecords'),
      where('date', '>=', Timestamp.fromDate(today)),
      where('status', '==', 'APPROVED')
    );
    const onDutySnapshot = await getCountFromServer(onDutyQuery);

    return {
      moduleId: 'time-tracking',
      pendingCount: pendingSnapshot.data().count,
      recentCount: onDutySnapshot.data().count,
      label: 'Pending Tasks',
    };
  } catch (error) {
    console.error('[getTasksStats] Error:', error);
    return { moduleId: 'time-tracking' };
  }
}

/**
 * Get stats for Document Management module
 */
async function getDocumentStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count documents created in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentDocsQuery = query(
      collection(db, 'documents'),
      where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
    );
    const recentSnapshot = await getCountFromServer(recentDocsQuery);

    return {
      moduleId: 'document-management',
      recentCount: recentSnapshot.data().count,
      label: 'Recent Documents',
    };
  } catch (error) {
    console.error('[getDocumentStats] Error:', error);
    return { moduleId: 'document-management' };
  }
}

/**
 * Get stats for Procurement module
 */
async function getProcurementStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending purchase requests
    const pendingPRsQuery = query(
      collection(db, 'purchaseRequests'),
      where('status', '==', 'PENDING_APPROVAL')
    );
    const pendingPRsSnapshot = await getCountFromServer(pendingPRsQuery);

    // Count pending RFQs
    const pendingRFQsQuery = query(
      collection(db, 'rfqs'),
      where('status', 'in', ['DRAFT', 'SENT', 'PENDING_REVIEW'])
    );
    const pendingRFQsSnapshot = await getCountFromServer(pendingRFQsQuery);

    // Count pending POs
    const pendingPOsQuery = query(
      collection(db, 'purchaseOrders'),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingPOsSnapshot = await getCountFromServer(pendingPOsQuery);

    const totalPending =
      pendingPRsSnapshot.data().count +
      pendingRFQsSnapshot.data().count +
      pendingPOsSnapshot.data().count;

    return {
      moduleId: 'procurement',
      pendingCount: totalPending,
      label: 'Pending Items',
    };
  } catch (error) {
    console.error('[getProcurementStats] Error:', error);
    return { moduleId: 'procurement' };
  }
}

/**
 * Get stats for Accounting module
 */
async function getAccountingStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count pending customer invoices
    const pendingInvoicesQuery = query(
      collection(db, 'customerInvoices'),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingInvoicesSnapshot = await getCountFromServer(pendingInvoicesQuery);

    // Count pending vendor bills
    const pendingBillsQuery = query(
      collection(db, 'vendorBills'),
      where('status', 'in', ['DRAFT', 'PENDING_APPROVAL'])
    );
    const pendingBillsSnapshot = await getCountFromServer(pendingBillsQuery);

    // Count unreconciled bank transactions
    const unreconciledQuery = query(
      collection(db, 'bankReconciliation'),
      where('status', '==', 'UNRECONCILED')
    );
    const unreconciledSnapshot = await getCountFromServer(unreconciledQuery);

    const totalPending =
      pendingInvoicesSnapshot.data().count +
      pendingBillsSnapshot.data().count +
      unreconciledSnapshot.data().count;

    return {
      moduleId: 'accounting',
      pendingCount: totalPending,
      label: 'Pending Items',
    };
  } catch (error) {
    console.error('[getAccountingStats] Error:', error);
    return { moduleId: 'accounting' };
  }
}

/**
 * Get stats for Project Management module
 */
async function getProjectStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count active projects
    const activeProjectsQuery = query(
      collection(db, 'projects'),
      where('status', 'in', ['ACTIVE', 'IN_PROGRESS'])
    );
    const activeSnapshot = await getCountFromServer(activeProjectsQuery);

    return {
      moduleId: 'project-management',
      totalCount: activeSnapshot.data().count,
      label: 'Active Projects',
    };
  } catch (error) {
    console.error('[getProjectStats] Error:', error);
    return { moduleId: 'project-management' };
  }
}

/**
 * Get stats for Estimation module
 */
async function getEstimationStats(): Promise<ModuleStats> {
  const { db } = getFirebase();

  try {
    // Count draft estimates
    const draftEstimatesQuery = query(collection(db, 'estimates'), where('status', '==', 'DRAFT'));
    const draftSnapshot = await getCountFromServer(draftEstimatesQuery);

    return {
      moduleId: 'estimation',
      pendingCount: draftSnapshot.data().count,
      label: 'Draft Estimates',
    };
  } catch (error) {
    console.error('[getEstimationStats] Error:', error);
    return { moduleId: 'estimation' };
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
      totalCount: entitiesSnapshot.data().count,
      label: 'Active Entities',
    };
  } catch (error) {
    console.error('[getEntityStats] Error:', error);
    return { moduleId: 'entity-management' };
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
      totalCount: activeSnapshot.data().count,
      label: 'Active Users',
    };
  } catch (error) {
    console.error('[getUserStats] Error:', error);
    return { moduleId: 'user-management' };
  }
}

/**
 * Get stats for all modules
 * Returns stats for modules the user has access to
 */
export async function getAllModuleStats(accessibleModuleIds: string[]): Promise<ModuleStats[]> {
  const statsPromises: Promise<ModuleStats>[] = [];

  for (const moduleId of accessibleModuleIds) {
    switch (moduleId) {
      case 'time-tracking':
        statsPromises.push(getTasksStats());
        break;
      case 'document-management':
        statsPromises.push(getDocumentStats());
        break;
      case 'procurement':
        statsPromises.push(getProcurementStats());
        break;
      case 'accounting':
        statsPromises.push(getAccountingStats());
        break;
      case 'project-management':
        statsPromises.push(getProjectStats());
        break;
      case 'estimation':
        statsPromises.push(getEstimationStats());
        break;
      case 'entity-management':
        statsPromises.push(getEntityStats());
        break;
      case 'user-management':
        statsPromises.push(getUserStats());
        break;
      // Coming soon modules don't have stats yet
      case 'material-database':
      case 'bought-out-database':
      case 'thermal-desal':
      case 'proposal-management':
      case 'company-settings':
        // No stats for these modules
        break;
    }
  }

  try {
    const stats = await Promise.all(statsPromises);
    return stats;
  } catch (error) {
    console.error('[getAllModuleStats] Error:', error);
    return [];
  }
}

/**
 * Get stats for a single module
 */
export async function getModuleStats(moduleId: string): Promise<ModuleStats | null> {
  switch (moduleId) {
    case 'time-tracking':
      return getTasksStats();
    case 'document-management':
      return getDocumentStats();
    case 'procurement':
      return getProcurementStats();
    case 'accounting':
      return getAccountingStats();
    case 'project-management':
      return getProjectStats();
    case 'estimation':
      return getEstimationStats();
    case 'entity-management':
      return getEntityStats();
    case 'user-management':
      return getUserStats();
    default:
      return null;
  }
}
