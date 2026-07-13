/**
 * Comp-Off Expiry — scheduled cron sweep (known-gaps 2.8a).
 *
 * Comp-off grants (hrCompOffGrants) carry a 1-year expiryDate set at grant
 * time (apps/web compOffService), but nothing ever enforced it — balances
 * only drifted upward. This sweep runs daily, finds `active` grants whose
 * expiryDate has passed, and in one transaction per grant:
 *   1. marks the grant `expired` (expiredAt = now), and
 *   2. decrements the user's COMP_OFF hrLeaveBalances doc — `entitled` when
 *      the balance doc is for the grant's fiscal year, `carryForward` when
 *      the credit was carried into a later year by the annual reset.
 *
 * Consumption is NOT linked to individual grants (usedByLeaveRequestId is
 * declared but never written), so the sweep assumes FIFO usage: the balance
 * decrement is clamped so `available` never goes below zero. A grant whose
 * credit was already spent is still marked expired, with a warning log.
 *
 * After the sweep, each affected user gets one informational
 * COMP_OFF_EXPIRED task notification (deterministic id — idempotent on
 * scheduler retries, feedback.ts pattern).
 *
 * Pattern copied from agentTaskExpiry.ts (equality-only query + in-code
 * date filter avoids needing a composite index; grant volume is tiny).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const HR_COMP_OFF_GRANTS = 'hrCompOffGrants';
const HR_LEAVE_BALANCES = 'hrLeaveBalances';
const TASK_NOTIFICATIONS = 'taskNotifications';
const COMP_OFF = 'COMP_OFF';

interface CompOffGrantRow {
  userId: string;
  userName?: string;
  fiscalYear: number;
  status: string;
  expiryDate?: admin.firestore.Timestamp;
  holidayName?: string;
}

/**
 * Daily sweep at 02:00 IST (off-peak, after the Dec-31 midnight annual
 * reset window so year-end carry-forward always lands first).
 */
export const expireCompOffGrants = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    memory: '256MiB',
    maxInstances: 1,
  },
  async (event) => {
    logger.info('comp-off expiry sweep', { scheduledTime: event.scheduleTime });
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const currentFiscalYear = new Date().getFullYear();

    // Equality-only query (no composite index needed); expiry filtered in code.
    const snapshot = await db.collection(HR_COMP_OFF_GRANTS).where('status', '==', 'active').get();

    if (snapshot.empty) {
      logger.info('no active comp-off grants');
      return;
    }

    const lapsed = snapshot.docs.filter((doc) => {
      const data = doc.data() as CompOffGrantRow;
      return data.expiryDate && data.expiryDate.toMillis() < now.toMillis();
    });

    if (lapsed.length === 0) {
      logger.info('no lapsed comp-off grants', { activeGrants: snapshot.size });
      return;
    }

    // userId -> expired-grant count, for the post-sweep notifications
    const expiredByUser = new Map<string, { userName: string; count: number }>();

    for (const grantDoc of lapsed) {
      const grant = grantDoc.data() as CompOffGrantRow;

      try {
        await db.runTransaction(async (tx) => {
          const grantSnap = await tx.get(grantDoc.ref);
          if (!grantSnap.exists || grantSnap.data()?.status !== 'active') {
            return; // Raced with a revoke/use — idempotent no-op
          }

          // Balance doc holding the credit: current fiscal year first (where
          // carried-forward credits live), falling back to the grant's year.
          let balanceSnap = await tx.get(
            db
              .collection(HR_LEAVE_BALANCES)
              .where('userId', '==', grant.userId)
              .where('leaveTypeCode', '==', COMP_OFF)
              .where('fiscalYear', '==', currentFiscalYear)
              .limit(1)
          );
          if (balanceSnap.empty && grant.fiscalYear !== currentFiscalYear) {
            balanceSnap = await tx.get(
              db
                .collection(HR_LEAVE_BALANCES)
                .where('userId', '==', grant.userId)
                .where('leaveTypeCode', '==', COMP_OFF)
                .where('fiscalYear', '==', grant.fiscalYear)
                .limit(1)
            );
          }

          const balanceDoc = balanceSnap.docs[0];
          if (balanceDoc) {
            const b = balanceDoc.data();
            // Credit granted in the balance year sits in `entitled`; credit
            // carried into a later year sits in `carryForward`.
            const bucket = b.fiscalYear === grant.fiscalYear ? 'entitled' : 'carryForward';
            const bucketValue = (b[bucket] as number) || 0;
            const available = (b.available as number) || 0;

            // FIFO clamp — see module docs.
            const decrement = Math.min(1, Math.max(0, bucketValue), Math.max(0, available));
            if (decrement < 1) {
              logger.warn('comp-off expiry clamped — credit appears already consumed', {
                grantId: grantDoc.id,
                userId: grant.userId,
                available,
              });
            }
            if (decrement > 0) {
              tx.update(balanceDoc.ref, {
                [bucket]: bucketValue - decrement,
                available: available - decrement,
                updatedAt: now,
                updatedBy: 'system:compOffExpiry',
              });
            }
          } else {
            logger.warn('COMP_OFF balance doc not found for lapsed grant — grant marked only', {
              grantId: grantDoc.id,
              userId: grant.userId,
              fiscalYear: grant.fiscalYear,
            });
          }

          tx.update(grantDoc.ref, {
            status: 'expired',
            expiredAt: now,
          });
        });

        const entry = expiredByUser.get(grant.userId) || {
          userName: grant.userName || '',
          count: 0,
        };
        entry.count += 1;
        expiredByUser.set(grant.userId, entry);
      } catch (err) {
        // One bad grant must not sink the sweep — log and continue; the next
        // nightly run retries it.
        logger.error('failed to expire comp-off grant', { grantId: grantDoc.id, error: err });
      }
    }

    // One informational notification per affected user, deterministic id so
    // scheduler retries can't duplicate it (feedback.ts pattern).
    const dateKey = new Date().toISOString().slice(0, 10);
    for (const [userId, info] of expiredByUser) {
      const taskId = `comp-off-expiry-${userId}-${dateKey}`;
      const taskRef = db.collection(TASK_NOTIFICATIONS).doc(taskId);
      try {
        await taskRef.create({
          type: 'informational',
          category: 'COMP_OFF_EXPIRED',
          userId,
          assignedBy: 'system',
          assignedByName: 'HR System',
          title: `${info.count} comp-off day${info.count > 1 ? 's' : ''} expired`,
          message: `${info.count} unused compensatory-off credit${info.count > 1 ? 's have' : ' has'} passed the 1-year expiry and been removed from your leave balance.`,
          priority: 'LOW',
          entityType: 'HR_LEAVE_BALANCE',
          entityId: userId,
          linkUrl: '/hr/leaves',
          status: 'pending',
          read: false,
          createdAt: now,
        });
      } catch (createErr) {
        if ((createErr as { code?: number }).code === 6) {
          logger.info('comp-off expiry notification already exists', { taskId });
        } else {
          logger.error('failed to create comp-off expiry notification', {
            taskId,
            error: createErr,
          });
        }
      }
    }

    logger.info('comp-off expiry sweep done', {
      lapsedGrants: lapsed.length,
      usersAffected: expiredByUser.size,
    });
  }
);
