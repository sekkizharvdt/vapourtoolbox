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
import { sendNotificationEmail, sendgridApiKey } from './sendEmail';

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
    secrets: [sendgridApiKey],
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    // Check overdue vendor bills
    try {
      const billsSnap = await db
        .collection('transactions')
        .where('type', '==', 'VENDOR_BILL')
        .where('status', 'in', ['APPROVED', 'POSTED'])
        .get();

      const overdueBills: { number: string; vendor: string; amount: number; dueDate: string }[] =
        [];

      billsSnap.forEach((doc) => {
        const data = doc.data();
        // Skip bills that are already fully paid
        if (data.paymentStatus === 'PAID') {
          return;
        }
        const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
        if (dueDate && dueDate < now) {
          overdueBills.push({
            number: data.transactionNumber || doc.id,
            vendor: data.entityName || '-',
            amount: data.outstandingAmount || data.totalAmount || 0,
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
