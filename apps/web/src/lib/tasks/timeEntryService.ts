/**
 * Time Entry Service
 *
 * Manages time entries for task notifications
 * Enforces single active task rule and updates task duration
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  TimeEntry,
  TimeEntryFilters,
  TimeTrackingSummary,
  UserTimeStats,
} from '@vapour/types';
import { updateTaskDuration } from './taskNotificationService';

// ============================================================================
// CREATE & START TIME ENTRY
// ============================================================================

/**
 * Start a new time entry for a task notification
 * Enforces single active task rule: stops any active time entries first
 */
export async function startTimeEntry(
  userId: string,
  taskNotificationId: string,
  description?: string
): Promise<string> {
  const { db } = getFirebase();

  try {
    // Stop any active time entries first (single task rule)
    await stopActiveTimeEntries(userId);

    const now = Timestamp.now();

    const timeEntryData: Omit<TimeEntry, 'id'> = {
      userId,
      taskNotificationId,
      startTime: now,
      duration: 0,
      isActive: true,
      description,
      createdAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.TIME_ENTRIES), timeEntryData);

    return docRef.id;
  } catch (error) {
    console.error('[startTimeEntry] Error:', error);
    throw new Error('Failed to start time entry');
  }
}

// ============================================================================
// STOP TIME ENTRY
// ============================================================================

/**
 * Stop a time entry and calculate duration
 * Updates the task notification's total duration
 */
export async function stopTimeEntry(entryId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.TIME_ENTRIES, entryId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Time entry not found');
    }

    const timeEntry = docSnap.data() as TimeEntry;

    if (!timeEntry.isActive) {
      throw new Error('Time entry is not active');
    }

    const now = Timestamp.now();
    const startTime = timeEntry.startTime.toMillis();
    const endTime = now.toMillis();
    const pausedDuration = timeEntry.pausedDuration || 0;
    const duration = Math.floor((endTime - startTime) / 1000) - pausedDuration;

    await updateDoc(docRef, {
      endTime: now,
      duration,
      isActive: false,
      updatedAt: now,
    });

    // Update task notification's total duration
    await updateTaskTotalDuration(timeEntry.taskNotificationId);
  } catch (error) {
    console.error('[stopTimeEntry] Error:', error);
    throw error;
  }
}

/**
 * Stop all active time entries for a user
 * Used to enforce single active task rule
 */
export async function stopActiveTimeEntries(userId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.TIME_ENTRIES),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    const stopPromises = snapshot.docs.map((doc) => stopTimeEntry(doc.id));

    await Promise.all(stopPromises);
  } catch (error) {
    console.error('[stopActiveTimeEntries] Error:', error);
    // Don't throw - this is called before starting new entries
  }
}

// ============================================================================
// PAUSE & RESUME
// ============================================================================

/**
 * Pause a time entry
 * Tracks paused time separately
 */
export async function pauseTimeEntry(entryId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.TIME_ENTRIES, entryId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Time entry not found');
    }

    const timeEntry = docSnap.data() as TimeEntry;

    if (!timeEntry.isActive) {
      throw new Error('Time entry is not active');
    }

    if (timeEntry.pausedAt) {
      throw new Error('Time entry is already paused');
    }

    await updateDoc(docRef, {
      pausedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('[pauseTimeEntry] Error:', error);
    throw error;
  }
}

/**
 * Resume a paused time entry
 * Calculates paused duration and adds to total paused time
 */
export async function resumeTimeEntry(entryId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.TIME_ENTRIES, entryId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Time entry not found');
    }

    const timeEntry = docSnap.data() as TimeEntry;

    if (!timeEntry.isActive) {
      throw new Error('Time entry is not active');
    }

    if (!timeEntry.pausedAt) {
      throw new Error('Time entry is not paused');
    }

    const now = Timestamp.now();
    const pausedTime = Math.floor((now.toMillis() - timeEntry.pausedAt.toMillis()) / 1000);
    const totalPausedDuration = (timeEntry.pausedDuration || 0) + pausedTime;

    await updateDoc(docRef, {
      pausedAt: null,
      pausedDuration: totalPausedDuration,
      resumedAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('[resumeTimeEntry] Error:', error);
    throw error;
  }
}

// ============================================================================
// GET TIME ENTRIES
// ============================================================================

/**
 * Get active time entry for a user
 * Only one can be active at a time
 */
export async function getActiveTimeEntry(userId: string): Promise<TimeEntry | null> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.TIME_ENTRIES),
      where('userId', '==', userId),
      where('isActive', '==', true),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty || !snapshot.docs[0]) {
      return null;
    }

    const docData = snapshot.docs[0];
    return {
      id: docData.id,
      ...docData.data(),
    } as TimeEntry;
  } catch (error) {
    console.error('[getActiveTimeEntry] Error:', error);
    return null;
  }
}

/**
 * Get time entries with filters
 */
export async function getTimeEntries(filters: TimeEntryFilters): Promise<TimeEntry[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    // User filter
    if (filters.userId) {
      constraints.push(where('userId', '==', filters.userId));
    }

    // Task notification filter
    if (filters.taskNotificationId) {
      constraints.push(where('taskNotificationId', '==', filters.taskNotificationId));
    }

    // Active filter
    if (filters.isActive !== undefined) {
      constraints.push(where('isActive', '==', filters.isActive));
    }

    // Date range filters
    if (filters.startDate) {
      constraints.push(where('startTime', '>=', Timestamp.fromDate(filters.startDate)));
    }

    if (filters.endDate) {
      constraints.push(where('startTime', '<=', Timestamp.fromDate(filters.endDate)));
    }

    // Order by start time (newest first)
    constraints.push(orderBy('startTime', 'desc'));

    // Limit
    if (filters.limit) {
      constraints.push(firestoreLimit(filters.limit));
    }

    const q = query(collection(db, COLLECTIONS.TIME_ENTRIES), ...constraints);
    const snapshot = await getDocs(q);

    const timeEntries: TimeEntry[] = [];
    snapshot.forEach((doc) => {
      timeEntries.push({
        id: doc.id,
        ...doc.data(),
      } as TimeEntry);
    });

    return timeEntries;
  } catch (error) {
    console.error('[getTimeEntries] Error:', error);
    throw new Error('Failed to get time entries');
  }
}

/**
 * Get all time entries for a task notification
 */
export async function getTaskTimeEntries(taskNotificationId: string): Promise<TimeEntry[]> {
  return getTimeEntries({ taskNotificationId });
}

// ============================================================================
// DURATION CALCULATIONS
// ============================================================================

/**
 * Calculate total time spent on a task notification
 * Sums all completed time entries
 */
export async function calculateTotalTime(taskNotificationId: string): Promise<number> {
  try {
    const timeEntries = await getTaskTimeEntries(taskNotificationId);

    const totalSeconds = timeEntries.reduce((sum, entry) => {
      // Only count completed (non-active) entries
      if (!entry.isActive) {
        return sum + entry.duration;
      }
      return sum;
    }, 0);

    return totalSeconds;
  } catch (error) {
    console.error('[calculateTotalTime] Error:', error);
    return 0;
  }
}

/**
 * Update task notification's total duration
 * Called after stopping a time entry
 */
async function updateTaskTotalDuration(taskNotificationId: string): Promise<void> {
  try {
    const totalDuration = await calculateTotalTime(taskNotificationId);
    await updateTaskDuration(taskNotificationId, totalDuration);
  } catch (error) {
    console.error('[updateTaskTotalDuration] Error:', error);
    // Don't throw - duration update is not critical
  }
}

// ============================================================================
// TIME TRACKING SUMMARIES
// ============================================================================

/**
 * Get time tracking summary for a user within a date range
 */
export async function getTimeTrackingSummary(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<TimeTrackingSummary> {
  try {
    const timeEntries = await getTimeEntries({
      userId,
      startDate,
      endDate,
      isActive: false, // Only completed entries
    });

    const totalTime = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
    const activeEntries = await getTimeEntries({ userId, isActive: true });

    // Get unique task notification IDs to count completed tasks
    const completedTaskIds = new Set(timeEntries.map((e) => e.taskNotificationId));

    const averageTaskDuration = completedTaskIds.size > 0 ? totalTime / completedTaskIds.size : 0;

    return {
      totalTime,
      activeEntries: activeEntries.length,
      completedTasks: completedTaskIds.size,
      averageTaskDuration,
    };
  } catch (error) {
    console.error('[getTimeTrackingSummary] Error:', error);
    return {
      totalTime: 0,
      activeEntries: 0,
      completedTasks: 0,
      averageTaskDuration: 0,
    };
  }
}

/**
 * Get user time stats (today, this week, this month)
 */
export async function getUserTimeStats(userId: string): Promise<UserTimeStats> {
  const now = new Date();

  // Today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // This week (Monday to Sunday)
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [today, thisWeek, thisMonth, activeEntry] = await Promise.all([
    getTimeTrackingSummary(userId, todayStart, todayEnd),
    getTimeTrackingSummary(userId, weekStart, weekEnd),
    getTimeTrackingSummary(userId, monthStart, monthEnd),
    getActiveTimeEntry(userId),
  ]);

  return {
    userId,
    today,
    thisWeek,
    thisMonth,
    currentActiveEntry: activeEntry || undefined,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format duration in seconds to human-readable string
 * e.g., 3665 -> "1h 1m 5s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Calculate elapsed time for an active time entry
 * Excludes paused time
 */
export function calculateElapsedTime(timeEntry: TimeEntry): number {
  if (!timeEntry.isActive) {
    return timeEntry.duration;
  }

  const now = Date.now();
  const startTime = timeEntry.startTime.toMillis();
  const pausedDuration = timeEntry.pausedDuration || 0;

  let elapsedSeconds = Math.floor((now - startTime) / 1000) - pausedDuration;

  // If currently paused, subtract current pause duration
  if (timeEntry.pausedAt) {
    const currentPauseDuration = Math.floor((now - timeEntry.pausedAt.toMillis()) / 1000);
    elapsedSeconds -= currentPauseDuration;
  }

  return Math.max(0, elapsedSeconds);
}
