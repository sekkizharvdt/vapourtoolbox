/**
 * Tell Accounts about a purchase order they will have to pay.
 *
 * Feature request §2 (a newly approved PO) and §8 (an amendment that moved its
 * value or payment terms). Both land in the accounting channel of Flow / My
 * Work, the one live notification system.
 *
 * Fanned out to every MANAGE_ACCOUNTING holder rather than a named person —
 * the same choice `sendGRToAccounting` already makes, and there is no
 * "payables owner" concept to address instead. Two users hold that permission
 * today.
 *
 * Best-effort throughout: a PO approval must not fail because a notification
 * could not be written (rule 27). Failures are warned about and the caller
 * continues.
 */

import { PERMISSION_FLAGS } from '@vapour/constants';
import { createLogger } from '@vapour/logger';
import type { PurchaseOrder } from '@vapour/types';
import { getUsersWithPermission } from '@/lib/auth/userLookup';
import { getFirebase } from '@/lib/firebase';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';
import { formatCurrencyCode } from '@/lib/utils/formatters';

const logger = createLogger({ context: 'notifyAccountingOfPO' });

/** One-line summary of the payment schedule, e.g. "30% Advance, 70% Before Dispatch". */
function describeSchedule(po: Pick<PurchaseOrder, 'commercialTerms'>): string {
  const schedule = po.commercialTerms?.paymentSchedule ?? [];
  if (schedule.length === 0) return 'no structured payment schedule';
  return schedule
    .map(
      (m) => `${m.percentage}% ${m.paymentType || 'payment'}${m.carriesTax ? ' (incl. tax)' : ''}`
    )
    .join(', ');
}

interface NotifyParams {
  po: PurchaseOrder;
  /** Who triggered it — the approver. Recorded as the assigner. */
  actorId: string;
  /**
   * Falls back to the PO's own tenantId, then to 'default-entity' — the same
   * chain `sendGRToAccounting` uses, so callers need not thread it through.
   */
  tenantId?: string;
}

async function notifyAccounting(
  params: NotifyParams,
  category: 'PO_APPROVED_FOR_PAYMENT' | 'PO_PAYMENT_TERMS_AMENDED',
  title: string,
  message: string
): Promise<void> {
  const { po, actorId, tenantId } = params;

  try {
    const { db } = getFirebase();
    const recipients = await getUsersWithPermission(
      db,
      tenantId || po.tenantId || 'default-entity',
      PERMISSION_FLAGS.MANAGE_ACCOUNTING
    );

    if (recipients.length === 0) {
      logger.warn('No MANAGE_ACCOUNTING users to notify about PO', {
        poId: po.id,
        poNumber: po.number,
      });
      return;
    }

    await Promise.all(
      recipients.map((userId) =>
        createTaskNotification({
          type: 'informational',
          category,
          userId,
          assignedBy: actorId,
          title,
          message,
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
          ...(po.projectIds?.[0] && { projectId: po.projectIds[0] }),
          linkUrl: `/procurement/pos/${po.id}`,
          priority: 'MEDIUM',
        })
      )
    );

    logger.info('Notified accounting about PO', {
      poId: po.id,
      category,
      recipients: recipients.length,
    });
  } catch (error) {
    // Never fail the approval or the amendment for this.
    logger.warn('Could not notify accounting about PO', {
      poId: po.id,
      category,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** §2 — a PO has been approved and Accounts will need to pay against it. */
export async function notifyAccountingOfApprovedPO(params: NotifyParams): Promise<void> {
  const { po } = params;
  const value = formatCurrencyCode(po.grandTotal ?? 0, po.currency || 'INR');
  const projects = (po.projectNames ?? []).join(', ');

  await notifyAccounting(
    params,
    'PO_APPROVED_FOR_PAYMENT',
    `PO ${po.number} approved — ${value}`,
    `${po.vendorName || 'Vendor'}${projects ? ` for ${projects}` : ''}. ` +
      `Payment terms: ${describeSchedule(po)}.`
  );
}

/** §8 — an approved amendment moved the PO value or its payment terms. */
export async function notifyAccountingOfAmendedPO(
  params: NotifyParams & { previousGrandTotal: number; amendmentNumber: number }
): Promise<void> {
  const { po, previousGrandTotal, amendmentNumber } = params;
  const currency = po.currency || 'INR';

  await notifyAccounting(
    params,
    'PO_PAYMENT_TERMS_AMENDED',
    `PO ${po.number} amended (amendment ${amendmentNumber})`,
    `Value changed from ${formatCurrencyCode(previousGrandTotal, currency)} to ` +
      `${formatCurrencyCode(po.grandTotal ?? 0, currency)}. ` +
      `Revised payment terms: ${describeSchedule(po)}.`
  );
}
