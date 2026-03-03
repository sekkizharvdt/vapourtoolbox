/**
 * Scheduled Email Notifications
 *
 * Daily check for overdue items (bills, invoices, PO deliveries).
 * Sends digest emails for delivery_overdue and bill_overdue events.
 *
 * Runs daily at 9:00 AM IST (3:30 AM UTC).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { sendNotificationEmail, gmailAppPassword } from './sendEmail';

interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0–6, Sunday=0; used when frequency='weekly'
  dayOfMonth?: number; // 1–31; used when frequency='monthly'
}

/**
 * Returns true if today matches the configured send schedule.
 * The Cloud Function always runs daily; this gate controls whether to actually send.
 */
function shouldSendToday(schedule: ScheduleConfig | undefined): boolean {
  if (!schedule || schedule.frequency === 'daily') return true;

  const now = new Date();
  // Convert UTC to IST (UTC+5:30) for day-of-week / day-of-month checks
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  if (schedule.frequency === 'weekly') {
    return istNow.getUTCDay() === (schedule.dayOfWeek ?? 1); // default Monday
  }
  if (schedule.frequency === 'monthly') {
    return istNow.getUTCDate() === (schedule.dayOfMonth ?? 1); // default 1st
  }
  return true;
}

/**
 * Daily overdue items check — sends notification emails for:
 * - bill_overdue: Vendor bills past their due date
 * - delivery_overdue: Purchase orders past their expected delivery date
 */
export const checkOverdueItemsAndNotify = onSchedule(
  {
    schedule: '30 3 * * *', // 3:30 AM UTC = 9:00 AM IST
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
    maxInstances: 1,
    secrets: [gmailAppPassword],
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    // Check schedule config — skip sending if today doesn't match the configured frequency
    const emailConfigDoc = await db.doc('notificationSettings/emailConfig').get();
    const scheduleConfig = emailConfigDoc.exists
      ? (emailConfigDoc.data()?.schedule as ScheduleConfig | undefined)
      : undefined;

    if (!shouldSendToday(scheduleConfig)) {
      logger.info(
        `Daily overdue check: skipping send — schedule frequency is '${scheduleConfig?.frequency}' and today does not match`
      );
      return;
    }

    // Check overdue vendor bills — use entity-level balance to match Data Health page
    try {
      const txnRef = db.collection('transactions');
      const [billsSnap, invoicesSnap, paymentsSnap, journalSnap] = await Promise.all([
        txnRef
          .where('type', '==', 'VENDOR_BILL')
          .where('status', 'in', ['APPROVED', 'POSTED'])
          .get(),
        txnRef
          .where('type', '==', 'CUSTOMER_INVOICE')
          .where('status', 'in', ['APPROVED', 'POSTED'])
          .get(),
        txnRef.where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']).get(),
        txnRef.where('type', '==', 'JOURNAL_ENTRY').get(),
      ]);

      // Build entity-level balance map (positive = receivable, negative = payable)
      const entityBalance = new Map<string, number>();
      const addBalance = (entityId: string | undefined, delta: number) => {
        if (!entityId) return;
        entityBalance.set(entityId, (entityBalance.get(entityId) ?? 0) + delta);
      };

      invoicesSnap.docs.forEach((d) => {
        if (d.data().isDeleted) return;
        const data = d.data();
        addBalance(data.entityId, data.baseAmount || data.totalAmount || 0);
      });
      billsSnap.docs.forEach((d) => {
        if (d.data().isDeleted) return;
        const data = d.data();
        addBalance(data.entityId, -(data.baseAmount || data.totalAmount || 0));
      });
      paymentsSnap.docs.forEach((d) => {
        if (d.data().isDeleted) return;
        const data = d.data();
        const amt = data.baseAmount || data.totalAmount || data.amount || 0;
        addBalance(data.entityId, data.type === 'CUSTOMER_PAYMENT' ? -amt : amt);
      });
      journalSnap.docs.forEach((d) => {
        if (d.data().isDeleted) return;
        const entries = (d.data().entries || []) as Array<{
          entityId?: string;
          debit?: number;
          credit?: number;
        }>;
        const perEntity = new Map<string, number>();
        entries.forEach((e) => {
          if (!e.entityId) return;
          perEntity.set(
            e.entityId,
            (perEntity.get(e.entityId) ?? 0) + (e.debit || 0) - (e.credit || 0)
          );
        });
        perEntity.forEach((delta, eid) => addBalance(eid, delta));
      });

      // Add entity opening balances
      const entityIds = [...entityBalance.keys()];
      for (let i = 0; i < entityIds.length; i += 30) {
        const batch = entityIds.slice(i, i + 30);
        const entitiesSnap = await db
          .collection('entities')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        entitiesSnap.forEach((entityDoc) => {
          const data = entityDoc.data();
          const opening = data.openingBalance || 0;
          const signed = data.openingBalanceType === 'CR' ? -opening : opening;
          entityBalance.set(entityDoc.id, signed + (entityBalance.get(entityDoc.id) ?? 0));
        });
      }

      const overdueBills: { number: string; vendor: string; amount: number; dueDate: string }[] =
        [];

      billsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted || data.paymentStatus === 'PAID') return;

        const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
        if (dueDate && dueDate < now) {
          // Skip if entity net position shows no payable (matches Data Health logic)
          if (data.entityId) {
            const balance = entityBalance.get(data.entityId) ?? 0;
            if (balance >= 0) return;
          }

          const outstanding = data.outstandingAmount ?? data.baseAmount ?? data.totalAmount ?? 0;
          if (outstanding < 0.01) return; // Skip floating-point residues

          overdueBills.push({
            number: data.transactionNumber || doc.id,
            vendor: data.entityName || '-',
            amount: outstanding,
            dueDate: dueDate.toLocaleDateString('en-IN'),
          });
        }
      });

      if (overdueBills.length > 0) {
        logger.info(`Found ${overdueBills.length} overdue bills`);

        const totalAmount = overdueBills.reduce((sum, b) => sum + b.amount, 0);
        const topBills = overdueBills.slice(0, 5);
        const details = topBills.map((b) => ({
          label: b.number,
          value: `${b.vendor} — ₹${b.amount.toLocaleString('en-IN')} (due ${b.dueDate})`,
        }));

        if (overdueBills.length > 5) {
          details.push({
            label: 'More',
            value: `+ ${overdueBills.length - 5} more overdue bills`,
          });
        }

        await sendNotificationEmail({
          eventId: 'bill_overdue',
          subject: `${overdueBills.length} Overdue Bills — ₹${totalAmount.toLocaleString('en-IN')}`,
          templateData: {
            title: 'Overdue Vendor Bills',
            message: `${overdueBills.length} vendor bill(s) are past their due date, totaling ₹${totalAmount.toLocaleString('en-IN')}.`,
            details,
            linkUrl: 'https://toolbox.vapourdesal.com/accounting/data-health/overdue',
          },
        });
      }
    } catch (err) {
      logger.error('Error checking overdue bills:', err);
    }

    // Check overdue PO deliveries
    try {
      const posSnap = await db
        .collection('purchaseOrders')
        .where('status', 'in', ['ISSUED', 'PARTIALLY_RECEIVED'])
        .get();

      const overdueDeliveries: { number: string; vendor: string; expectedDate: string }[] = [];

      posSnap.forEach((doc) => {
        const data = doc.data();
        const deliveryDate =
          data.expectedDeliveryDate?.toDate?.() ||
          (data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null);
        if (deliveryDate && deliveryDate < now) {
          overdueDeliveries.push({
            number: data.number || doc.id,
            vendor: data.entityName || '-',
            expectedDate: deliveryDate.toLocaleDateString('en-IN'),
          });
        }
      });

      if (overdueDeliveries.length > 0) {
        logger.info(`Found ${overdueDeliveries.length} overdue deliveries`);

        const topDeliveries = overdueDeliveries.slice(0, 5);
        const details = topDeliveries.map((d) => ({
          label: d.number,
          value: `${d.vendor} — expected ${d.expectedDate}`,
        }));

        if (overdueDeliveries.length > 5) {
          details.push({
            label: 'More',
            value: `+ ${overdueDeliveries.length - 5} more overdue deliveries`,
          });
        }

        await sendNotificationEmail({
          eventId: 'delivery_overdue',
          subject: `${overdueDeliveries.length} Overdue PO Deliveries`,
          templateData: {
            title: 'Overdue Purchase Order Deliveries',
            message: `${overdueDeliveries.length} purchase order(s) are past their expected delivery date.`,
            details,
            linkUrl: 'https://toolbox.vapourdesal.com/procurement/pos',
          },
        });
      }
    } catch (err) {
      logger.error('Error checking overdue deliveries:', err);
    }

    logger.info('Daily overdue check complete');
  }
);
