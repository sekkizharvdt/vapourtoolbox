/**
 * Scheduled + manual generation of recurring transaction occurrences.
 *
 * Mirrors the logic in apps/web/src/lib/accounting/recurringTransactionService.ts
 * (generatePendingOccurrences + createOccurrence + calculateNextOccurrence) using
 * the admin SDK. The client copy stays for in-app calls; this is the engine.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const RECURRING_TRANSACTIONS = 'recurringTransactions';
const RECURRING_OCCURRENCES = 'recurringOccurrences';
const MANAGE_ACCOUNTING = 1 << 14; // 16384

type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

interface RecurringTransactionDoc {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  frequency: Frequency;
  startDate: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  nextOccurrence: admin.firestore.Timestamp;
  dayOfMonth?: number;
  dayOfWeek?: number;
  amount: { amount: number; currency: string };
  totalOccurrences: number;
  daysBeforeToGenerate: number;
  type: string;
  entityId?: string;
  isDeleted?: boolean;
}

function calculateNextOccurrence(
  frequency: Frequency,
  lastOccurrence: Date,
  dayOfMonth?: number,
  dayOfWeek?: number
): Date {
  const result = new Date(lastOccurrence);

  switch (frequency) {
    case 'DAILY':
      result.setDate(result.getDate() + 1);
      break;

    case 'WEEKLY':
      result.setDate(result.getDate() + 7);
      if (dayOfWeek !== undefined) {
        const diff = dayOfWeek - result.getDay();
        result.setDate(result.getDate() + diff);
      }
      break;

    case 'BIWEEKLY':
      result.setDate(result.getDate() + 14);
      break;

    case 'MONTHLY': {
      const originalDay = result.getDate();
      const targetMonth = result.getMonth() + 1;
      const targetYear = targetMonth > 11 ? result.getFullYear() + 1 : result.getFullYear();
      const normalizedMonth = targetMonth % 12;

      if (dayOfMonth !== undefined) {
        if (dayOfMonth === 0) {
          result.setFullYear(targetYear, normalizedMonth + 1, 0);
        } else {
          const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
          result.setFullYear(targetYear, normalizedMonth, Math.min(dayOfMonth, lastDay));
        }
      } else {
        const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        result.setFullYear(targetYear, normalizedMonth, Math.min(originalDay, lastDay));
      }
      break;
    }

    case 'QUARTERLY':
      result.setMonth(result.getMonth() + 3);
      if (dayOfMonth !== undefined && dayOfMonth !== 0) {
        const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
        result.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;

    case 'YEARLY':
      result.setFullYear(result.getFullYear() + 1);
      break;
  }

  return result;
}

/**
 * Walk forward from `nextOccurrence` issuing every occurrence whose
 * generate-window has already opened (i.e. scheduledDate - daysBefore <= asOfDate).
 * Catches up multiple periods at once when a template was paused or the scheduler
 * missed runs.
 */
async function generateForTemplate(
  db: admin.firestore.Firestore,
  template: RecurringTransactionDoc,
  asOfDate: Date,
  triggeredBy: string
): Promise<number> {
  // rule20-exempt: each iteration commits a fresh 2-op batch (set + update) — the batch never grows, and the loop is bounded by MAX_CATCHUP=24
  let created = 0;
  let scheduledDate = template.nextOccurrence.toDate();
  let occurrenceCount = template.totalOccurrences;

  const MAX_CATCHUP = 24;

  while (created < MAX_CATCHUP) {
    const generateWindowOpensAt = new Date(scheduledDate);
    generateWindowOpensAt.setDate(generateWindowOpensAt.getDate() - template.daysBeforeToGenerate);

    if (asOfDate < generateWindowOpensAt) break;
    if (template.endDate && scheduledDate > template.endDate.toDate()) {
      await db.collection(RECURRING_TRANSACTIONS).doc(template.id).update({
        status: 'COMPLETED',
        updatedAt: admin.firestore.Timestamp.now(),
      });
      logger.info('Recurring template completed (end date reached)', {
        templateId: template.id,
        name: template.name,
      });
      return created;
    }

    const now = admin.firestore.Timestamp.now();
    const occurrenceRef = db.collection(RECURRING_OCCURRENCES).doc();
    const nextDate = calculateNextOccurrence(
      template.frequency,
      scheduledDate,
      template.dayOfMonth,
      template.dayOfWeek
    );

    const batch = db.batch();
    batch.set(occurrenceRef, {
      recurringTransactionId: template.id,
      recurringTransactionName: template.name,
      type: template.type,
      scheduledDate: admin.firestore.Timestamp.fromDate(scheduledDate),
      occurrenceNumber: occurrenceCount + 1,
      originalAmount: template.amount,
      finalAmount: template.amount,
      status: 'PENDING',
      ...(template.entityId ? { entityId: template.entityId } : {}),
      generatedBy: triggeredBy,
      createdAt: now,
      updatedAt: now,
    });
    batch.update(db.collection(RECURRING_TRANSACTIONS).doc(template.id), {
      nextOccurrence: admin.firestore.Timestamp.fromDate(nextDate),
      totalOccurrences: occurrenceCount + 1,
      lastGeneratedAt: now,
      lastGeneratedOccurrenceId: occurrenceRef.id,
      updatedAt: now,
    });
    await batch.commit();

    created++;
    occurrenceCount++;
    scheduledDate = nextDate;
  }

  if (created === MAX_CATCHUP) {
    logger.warn('Hit MAX_CATCHUP for recurring template', {
      templateId: template.id,
      name: template.name,
    });
  }

  return created;
}

async function runGeneration(
  triggeredBy: string,
  asOfDate: Date = new Date()
): Promise<{ created: number; templatesProcessed: number; errors: string[] }> {
  const db = admin.firestore();

  const snapshot = await db
    .collection(RECURRING_TRANSACTIONS)
    .where('status', '==', 'ACTIVE')
    .get();

  const templates: RecurringTransactionDoc[] = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<RecurringTransactionDoc, 'id'>) }))
    .filter((t) => !t.isDeleted);

  let created = 0;
  const errors: string[] = [];

  for (const template of templates) {
    try {
      created += await generateForTemplate(db, template, asOfDate, triggeredBy);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${template.name}: ${message}`);
      logger.error('Failed to generate occurrences for template', {
        templateId: template.id,
        name: template.name,
        error: message,
      });
    }
  }

  logger.info('Recurring generation complete', {
    triggeredBy,
    templatesProcessed: templates.length,
    created,
    errors: errors.length,
  });

  return { created, templatesProcessed: templates.length, errors };
}

/**
 * Scheduled daily run — 00:30 UTC = 06:00 AM IST.
 */
export const scheduledRecurringGeneration = onSchedule(
  {
    schedule: '30 0 * * *',
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 1,
  },
  async () => {
    logger.info('Starting scheduled recurring transaction generation');
    await runGeneration('scheduled');
  }
);

/**
 * Manual trigger — called by the "Generate now" button on /accounting/recurring/upcoming.
 */
export const manualRecurringGeneration = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 1,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const permissions = (request.auth.token.permissions as number | undefined) ?? 0;
    if ((permissions & MANAGE_ACCOUNTING) !== MANAGE_ACCOUNTING) {
      throw new HttpsError(
        'permission-denied',
        'MANAGE_ACCOUNTING permission required to generate recurring occurrences'
      );
    }

    logger.info('Manual recurring generation triggered', { userId: request.auth.uid });

    const result = await runGeneration(`manual:${request.auth.uid}`);

    return {
      success: true,
      created: result.created,
      templatesProcessed: result.templatesProcessed,
      errors: result.errors,
    };
  }
);
