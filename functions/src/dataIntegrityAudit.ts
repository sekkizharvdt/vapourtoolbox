/**
 * Nightly data-integrity audit (Phase 5 of
 * docs/reviews/2026-07-05-automated-verification-plan.md).
 *
 * Recomputes account balances from scratch (via the same accountBalanceLogic
 * the incremental trigger and Recalculate Balances use — rule 32) and runs
 * the structural checks in dataIntegrityAuditLogic against the full dataset.
 *
 * Silent success, loud failure: every run writes a summary doc to
 * `dataAuditRuns` (surfaced on the Data Health page); any finding also sends
 * a notification email (event id `data_audit_failed`, toggled on
 * /admin/notifications like every other event).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { sendNotificationEmail, gmailAppPassword } from './email/sendEmail';
import { APP_URL } from './email/config';
import { runDataIntegrityChecks, type AuditDoc, type AccountDoc } from './dataIntegrityAuditLogic';
import type { TransactionLike } from './accountBalanceLogic';

const MAX_FINDINGS_STORED = 50;
const MAX_FINDINGS_EMAILED = 15;

export const dataIntegrityAudit = onSchedule(
  {
    schedule: '30 21 * * *', // 21:30 UTC = 3:00 AM IST — quiet hours
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
    maxInstances: 1,
    secrets: [gmailAppPassword],
  },
  async () => {
    const db = admin.firestore();
    const startedAt = Date.now();

    try {
      const [txnSnap, accountSnap, entitySnap] = await Promise.all([
        db.collection('transactions').get(),
        db.collection('accounts').get(),
        // Empty projection: document ids only — the checks never read entity fields.
        db.collection('entities').select().get(),
      ]);

      const transactions: AuditDoc[] = txnSnap.docs.map((d) => ({
        id: d.id,
        data: d.data() as TransactionLike & Record<string, unknown>,
      }));
      const accounts: AccountDoc[] = accountSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
      const entityIds = new Set(entitySnap.docs.map((d) => d.id));

      const result = runDataIntegrityChecks({
        transactions,
        accounts,
        entityIds,
        now: new Date(),
      });

      const status = result.findings.length === 0 ? 'CLEAN' : 'ISSUES';
      await db.collection('dataAuditRuns').add({
        runAt: admin.firestore.FieldValue.serverTimestamp(),
        status,
        findingsCount: result.findings.length,
        countsByCheck: result.countsByCheck,
        transactionsScanned: result.transactionsScanned,
        accountsScanned: result.accountsScanned,
        durationMs: Date.now() - startedAt,
        // Cap stored findings; countsByCheck keeps the full totals.
        findings: result.findings.slice(0, MAX_FINDINGS_STORED),
        ...(result.findings.length > MAX_FINDINGS_STORED && {
          findingsTruncated: result.findings.length - MAX_FINDINGS_STORED,
        }),
      });

      if (result.findings.length === 0) {
        logger.info(
          `Data integrity audit CLEAN — ${result.transactionsScanned} transactions, ` +
            `${result.accountsScanned} accounts, ${Date.now() - startedAt}ms`
        );
        return;
      }

      logger.error(
        `Data integrity audit found ${result.findings.length} issue(s)`,
        result.countsByCheck
      );

      const istDateKey = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await sendNotificationEmail({
        eventId: 'data_audit_failed',
        subject: `Data integrity audit: ${result.findings.length} issue(s) found`,
        templateData: {
          title: 'Nightly Data Integrity Audit — Issues Found',
          message:
            `The automated audit found ${result.findings.length} issue(s) across ` +
            `${result.transactionsScanned} transactions and ${result.accountsScanned} accounts.`,
          details: [
            ...Object.entries(result.countsByCheck)
              .filter(([, count]) => count > 0)
              .map(([check, count]) => ({ label: check, value: String(count) })),
            ...result.findings
              .slice(0, MAX_FINDINGS_EMAILED)
              .map((f, i) => ({ label: `#${i + 1}`, value: f.message })),
          ],
          linkUrl: `${APP_URL}/accounting/data-health`,
        },
        idempotencyKey: `data_audit_failed_${istDateKey}`,
      });
    } catch (error) {
      logger.error('Data integrity audit failed to run:', error);
      // Best-effort ERROR run doc so the Data Health page shows the failure
      // rather than a silently missing run.
      try {
        await db.collection('dataAuditRuns').add({
          runAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        });
      } catch (writeError) {
        logger.error('Could not record ERROR audit run:', writeError);
      }
      throw error; // mark the scheduled execution failed for Cloud Monitoring
    }
  }
);
