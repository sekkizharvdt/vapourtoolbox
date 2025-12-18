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
 * Calculates counts by type, module, status, and severity.
 * Uses parallel queries for performance.
 */
export async function getFeedbackStats(db: Firestore): Promise<FeedbackStats> {
  try {
    const feedbackRef = collection(db, 'feedback');

    // Get all feedback to calculate stats
    const snapshot = await getDocs(feedbackRef);

    const stats: FeedbackStats = {
      total: 0,
      byType: { bug: 0, feature: 0, general: 0 },
      byModule: {},
      byStatus: { new: 0, in_progress: 0, resolved: 0, closed: 0, wont_fix: 0 },
      bySeverity: {},
    };

    snapshot.forEach((doc) => {
      const data = doc.data() as FeedbackItem;
      stats.total++;

      // Count by type
      if (data.type && stats.byType[data.type] !== undefined) {
        stats.byType[data.type]++;
      }

      // Count by module (handle older records without module)
      const feedbackModule = data.module || 'other';
      stats.byModule[feedbackModule] = (stats.byModule[feedbackModule] || 0) + 1;

      // Count by status
      if (data.status && stats.byStatus[data.status] !== undefined) {
        stats.byStatus[data.status]++;
      }

      // Count by severity (only for bugs)
      if (data.type === 'bug' && data.severity) {
        stats.bySeverity[data.severity] = (stats.bySeverity[data.severity] || 0) + 1;
      }
    });

    logger.info('Calculated feedback stats', { total: stats.total });
    return stats;
  } catch (error) {
    logger.error('Error getting feedback stats', { error });
    throw error;
  }
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
