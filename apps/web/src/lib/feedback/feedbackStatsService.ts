/**
 * Feedback Statistics Service
 *
 * Provides aggregated statistics for the feedback module.
 * Used to display dashboard metrics and filter feedback by various criteria.
 */

import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  type Firestore,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import type {
  FeedbackItem,
  FeedbackType,
  FeedbackStatus,
  FeedbackModule,
  FeedbackStats,
} from '@/components/admin/feedback/types';

const logger = createLogger({ context: 'feedbackStatsService' });

/**
 * Get aggregated feedback statistics
 *
 * Calculates counts by type, status, and severity using efficient count queries.
 * Uses parallel getCountFromServer queries instead of loading all documents.
 *
 * PERFORMANCE: This avoids loading all feedback documents into memory.
 * For module breakdown (which has dynamic values), we still need to query documents
 * but with a limit to prevent memory issues at scale.
 */
export async function getFeedbackStats(db: Firestore): Promise<FeedbackStats> {
  try {
    const feedbackRef = collection(db, 'feedback');

    // Define all count queries
    const typeQueries = {
      bug: query(feedbackRef, where('type', '==', 'bug')),
      feature: query(feedbackRef, where('type', '==', 'feature')),
      general: query(feedbackRef, where('type', '==', 'general')),
    };

    const statusQueries = {
      new: query(feedbackRef, where('status', '==', 'new')),
      in_progress: query(feedbackRef, where('status', '==', 'in_progress')),
      resolved: query(feedbackRef, where('status', '==', 'resolved')),
      closed: query(feedbackRef, where('status', '==', 'closed')),
      wont_fix: query(feedbackRef, where('status', '==', 'wont_fix')),
    };

    const severityQueries = {
      critical: query(feedbackRef, where('type', '==', 'bug'), where('severity', '==', 'critical')),
      major: query(feedbackRef, where('type', '==', 'bug'), where('severity', '==', 'major')),
      minor: query(feedbackRef, where('type', '==', 'bug'), where('severity', '==', 'minor')),
      cosmetic: query(feedbackRef, where('type', '==', 'bug'), where('severity', '==', 'cosmetic')),
    };

    // Run all count queries in parallel
    const [
      totalCount,
      bugCount,
      featureCount,
      generalCount,
      newCount,
      inProgressCount,
      resolvedCount,
      closedCount,
      wontFixCount,
      criticalCount,
      majorCount,
      minorCount,
      cosmeticCount,
    ] = await Promise.all([
      getCountFromServer(query(feedbackRef)),
      getCountFromServer(typeQueries.bug),
      getCountFromServer(typeQueries.feature),
      getCountFromServer(typeQueries.general),
      getCountFromServer(statusQueries.new),
      getCountFromServer(statusQueries.in_progress),
      getCountFromServer(statusQueries.resolved),
      getCountFromServer(statusQueries.closed),
      getCountFromServer(statusQueries.wont_fix),
      getCountFromServer(severityQueries.critical),
      getCountFromServer(severityQueries.major),
      getCountFromServer(severityQueries.minor),
      getCountFromServer(severityQueries.cosmetic),
    ]);

    // For module breakdown, we need to query documents but with pagination
    // Use a reasonable limit to prevent loading too many documents
    const moduleStats = await getModuleBreakdown(db, 1000);

    const stats: FeedbackStats = {
      total: totalCount.data().count,
      byType: {
        bug: bugCount.data().count,
        feature: featureCount.data().count,
        general: generalCount.data().count,
      },
      byModule: moduleStats,
      byStatus: {
        new: newCount.data().count,
        in_progress: inProgressCount.data().count,
        resolved: resolvedCount.data().count,
        closed: closedCount.data().count,
        wont_fix: wontFixCount.data().count,
      },
      bySeverity: {
        critical: criticalCount.data().count,
        major: majorCount.data().count,
        minor: minorCount.data().count,
        cosmetic: cosmeticCount.data().count,
      },
    };

    logger.info('Calculated feedback stats', { total: stats.total });
    return stats;
  } catch (error) {
    logger.error('Error getting feedback stats', { error });
    throw error;
  }
}

/**
 * Get module breakdown with pagination to prevent loading all documents
 * @param maxDocs - Maximum number of documents to scan for module breakdown
 */
async function getModuleBreakdown(
  db: Firestore,
  maxDocs: number = 1000
): Promise<Record<FeedbackModule | string, number>> {
  const { limit: firestoreLimit, orderBy } = await import('firebase/firestore');
  const feedbackRef = collection(db, 'feedback');

  // Query with limit to prevent unbounded reads
  const q = query(feedbackRef, orderBy('createdAt', 'desc'), firestoreLimit(maxDocs));
  const snapshot = await getDocs(q);

  const byModule: Record<string, number> = {};

  snapshot.forEach((doc) => {
    const data = doc.data() as FeedbackItem;
    const feedbackModule = data.module || 'other';
    byModule[feedbackModule] = (byModule[feedbackModule] || 0) + 1;
  });

  return byModule;
}

/**
 * Get feedback count for a specific status
 */
export async function getFeedbackCountByStatus(
  db: Firestore,
  status: FeedbackStatus
): Promise<number> {
  try {
    const feedbackRef = collection(db, 'feedback');
    const q = query(feedbackRef, where('status', '==', status));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    logger.error('Error getting feedback count by status', { status, error });
    throw error;
  }
}

/**
 * Get feedback items filtered by module
 */
export async function getFeedbackByModule(
  db: Firestore,
  module: FeedbackModule
): Promise<FeedbackItem[]> {
  try {
    const feedbackRef = collection(db, 'feedback');
    const q = query(feedbackRef, where('module', '==', module));
    const snapshot = await getDocs(q);

    const items: FeedbackItem[] = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as FeedbackItem);
    });

    logger.info('Fetched feedback by module', { module, count: items.length });
    return items;
  } catch (error) {
    logger.error('Error getting feedback by module', { module, error });
    throw error;
  }
}

/**
 * Get feedback items filtered by type
 */
export async function getFeedbackByType(
  db: Firestore,
  type: FeedbackType
): Promise<FeedbackItem[]> {
  try {
    const feedbackRef = collection(db, 'feedback');
    const q = query(feedbackRef, where('type', '==', type));
    const snapshot = await getDocs(q);

    const items: FeedbackItem[] = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as FeedbackItem);
    });

    return items;
  } catch (error) {
    logger.error('Error getting feedback by type', { type, error });
    throw error;
  }
}

/**
 * Get open (actionable) feedback count
 * Returns count of feedback in 'new' or 'in_progress' status
 */
export async function getOpenFeedbackCount(db: Firestore): Promise<number> {
  try {
    const feedbackRef = collection(db, 'feedback');

    // Run parallel queries for 'new' and 'in_progress'
    const [newCount, inProgressCount] = await Promise.all([
      getCountFromServer(query(feedbackRef, where('status', '==', 'new'))),
      getCountFromServer(query(feedbackRef, where('status', '==', 'in_progress'))),
    ]);

    return newCount.data().count + inProgressCount.data().count;
  } catch (error) {
    logger.error('Error getting open feedback count', { error });
    throw error;
  }
}

/**
 * Get critical and major bug count (high priority items)
 */
export async function getHighPriorityBugCount(db: Firestore): Promise<number> {
  try {
    const feedbackRef = collection(db, 'feedback');

    // Run parallel queries for critical and major severity
    const [criticalCount, majorCount] = await Promise.all([
      getCountFromServer(
        query(feedbackRef, where('type', '==', 'bug'), where('severity', '==', 'critical'))
      ),
      getCountFromServer(
        query(feedbackRef, where('type', '==', 'bug'), where('severity', '==', 'major'))
      ),
    ]);

    return criticalCount.data().count + majorCount.data().count;
  } catch (error) {
    logger.error('Error getting high priority bug count', { error });
    throw error;
  }
}
