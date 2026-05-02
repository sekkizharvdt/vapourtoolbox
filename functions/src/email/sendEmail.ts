/**
 * Email Service — Core Nodemailer email sending module
 *
 * Reads notification settings from Firestore, resolves recipient emails,
 * compiles Handlebars templates, and sends via Gmail SMTP (Google Workspace).
 *
 * Gmail App Password is stored as a Firebase secret:
 *   firebase functions:secrets:set GMAIL_APP_PASSWORD
 *
 * The "From Email" address is configured in the admin settings page
 * (Firestore: notificationSettings/emailConfig).
 */

import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { APP_URL } from './config';

// Firebase secret — must be set via CLI before deploying
export const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');

interface EmailConfig {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  recipientUserIds: string[];
  /** Per-event recipient overrides. Empty array or absent = use recipientUserIds. */
  eventRecipients?: Record<string, string[]>;
}

interface SendNotificationInput {
  eventId: string;
  subject: string;
  templateData: {
    title: string;
    message: string;
    details?: { label: string; value: string }[];
    linkUrl?: string;
  };
  /** Send directly to these emails instead of the configured recipient list */
  directRecipientEmails?: string[];
  /**
   * Always include these emails in addition to the configured recipient list (deduped).
   * Bypasses user opt-out preferences — use only for "self" notifications where the
   * person is the subject of the event (e.g. employee on their own approved leave).
   */
  additionalRecipientEmails?: string[];
  /**
   * Unique key for idempotency. When provided, prevents duplicate sends if Cloud
   * Functions retries the trigger. Pass `event.id` from the trigger handler.
   */
  idempotencyKey?: string;
}

// Cache compiled templates
let baseTemplate: Handlebars.TemplateDelegate | null = null;
let notificationTemplate: Handlebars.TemplateDelegate | null = null;

function getTemplateDir(): string {
  return path.join(__dirname, 'templates');
}

function compileTemplates(): {
  base: Handlebars.TemplateDelegate;
  notification: Handlebars.TemplateDelegate;
} {
  if (!baseTemplate || !notificationTemplate) {
    const templateDir = getTemplateDir();
    const baseSrc = fs.readFileSync(path.join(templateDir, 'base.html'), 'utf-8');
    const notifSrc = fs.readFileSync(path.join(templateDir, 'notification.html'), 'utf-8');
    baseTemplate = Handlebars.compile(baseSrc);
    notificationTemplate = Handlebars.compile(notifSrc);
  }
  return { base: baseTemplate, notification: notificationTemplate };
}

/**
 * Create a Nodemailer transporter using Gmail SMTP.
 * Uses the fromEmail from config as the Gmail account and the App Password for auth.
 */
function createTransporter(fromEmail: string) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: fromEmail,
      pass: gmailAppPassword.value(),
    },
  });
}

/**
 * Load email configuration from Firestore.
 * Returns null if email is not configured or disabled.
 */
async function getEmailConfig(): Promise<EmailConfig | null> {
  const db = admin.firestore();
  const doc = await db.doc('notificationSettings/emailConfig').get();

  if (!doc.exists) {
    logger.info('Email config not found — skipping');
    return null;
  }

  const config = doc.data() as EmailConfig;
  if (!config.enabled) {
    logger.info('Email notifications disabled — skipping');
    return null;
  }

  if (!config.fromEmail || !config.recipientUserIds?.length) {
    logger.info('Email config incomplete (no sender or recipients) — skipping');
    return null;
  }

  return config;
}

/**
 * Check if a specific event is enabled in notification settings.
 */
async function isEventEnabled(eventId: string): Promise<boolean> {
  const db = admin.firestore();
  const doc = await db.doc('notificationSettings/config').get();

  if (!doc.exists) return false;

  const settings = doc.data() as Record<string, boolean>;
  return settings[eventId] === true;
}

/**
 * Build a plain-text version of the email body from the template data.
 * Used as the multipart fallback for clients that don't render HTML.
 */
function buildPlainText(templateData: SendNotificationInput['templateData']): string {
  const lines: string[] = [];
  lines.push(templateData.title);
  lines.push('');
  lines.push(templateData.message);
  if (templateData.details?.length) {
    lines.push('');
    for (const { label, value } of templateData.details) {
      lines.push(`${label}: ${value}`);
    }
  }
  if (templateData.linkUrl) {
    lines.push('');
    lines.push(`View details: ${templateData.linkUrl}`);
  }
  lines.push('');
  lines.push('— Vapour Toolbox');
  return lines.join('\n');
}

/**
 * Acquire an idempotency lock for this send. Returns true if the caller
 * should proceed, false if a previous (successful) attempt already sent.
 *
 * Uses .create() which throws if the document exists — atomic claim.
 * Docs include `expiresAt` 30 days out; configure Firestore TTL on the
 * `emailIdempotency` collection / `expiresAt` field to auto-prune.
 */
async function acquireIdempotencyLock(key: string, eventId: string): Promise<boolean> {
  const db = admin.firestore();
  const lockRef = db.doc(`emailIdempotency/${key}_${eventId}`);
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  try {
    await lockRef.create({
      eventId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });
    return true;
  } catch (err) {
    // ALREADY_EXISTS — a prior attempt of this same logical event already sent
    const code = (err as { code?: number | string })?.code;
    if (code === 6 || code === 'already-exists') {
      return false;
    }
    // Unknown error — log and let the caller proceed (fail open, prefer over-send to lost notification)
    logger.warn(`Idempotency lock check failed for ${key}_${eventId} — proceeding`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

/**
 * Resolve recipient UIDs to email addresses.
 * Filters out users who have opted out via preferences.notifications.email.
 */
async function resolveRecipientEmails(recipientUserIds: string[]): Promise<string[]> {
  const db = admin.firestore();
  const emails: string[] = [];

  // Batch fetch users (Firestore getAll supports up to 100 refs)
  const userRefs = recipientUserIds.map((uid) => db.doc(`users/${uid}`));

  if (userRefs.length === 0) return [];

  const userDocs = await db.getAll(...userRefs);

  for (const userDoc of userDocs) {
    if (!userDoc.exists) continue;

    const userData = userDoc.data();
    if (!userData) continue;

    // Skip inactive users
    if (!userData.isActive || userData.status !== 'active') continue;

    // Check user-level email opt-out
    if (userData.preferences?.notifications?.email === false) continue;

    if (userData.email) {
      emails.push(userData.email);
    }
  }

  return emails;
}

/**
 * Send a notification email to all configured recipients.
 *
 * Checks:
 * 1. Email config exists and is enabled
 * 2. The specific event is enabled in notification settings
 * 3. Resolves recipient emails, filtering opted-out users
 * 4. Compiles template and sends via Gmail SMTP
 */
export async function sendNotificationEmail(input: SendNotificationInput): Promise<void> {
  try {
    // 1. Check email config
    const emailConfig = await getEmailConfig();
    if (!emailConfig) return;

    // 2. Check event enabled
    const enabled = await isEventEnabled(input.eventId);
    if (!enabled) {
      logger.info(`Event ${input.eventId} is not enabled — skipping email`);
      return;
    }

    // 3. Idempotency — claim a lock so Cloud Function retries don't re-send
    if (input.idempotencyKey) {
      const proceed = await acquireIdempotencyLock(input.idempotencyKey, input.eventId);
      if (!proceed) {
        logger.info(
          `Idempotency: ${input.eventId} already sent for key ${input.idempotencyKey} — skipping`
        );
        return;
      }
    }

    // 4. Resolve recipients
    //    - directRecipientEmails: bypass everything
    //    - per-event override: use it; if it resolves to zero active users, fall back to defaults
    //    - default: use the global recipientUserIds
    //    - additionalRecipientEmails: always appended (deduped), bypasses opt-out
    let recipientEmails: string[];
    if (input.directRecipientEmails?.length) {
      recipientEmails = [...input.directRecipientEmails];
    } else {
      const eventSpecificIds = emailConfig.eventRecipients?.[input.eventId];
      if (eventSpecificIds && eventSpecificIds.length > 0) {
        recipientEmails = await resolveRecipientEmails(eventSpecificIds);
        if (recipientEmails.length === 0) {
          logger.warn(
            `Per-event recipients for ${input.eventId} resolved to 0 active users — falling back to default recipients`
          );
          recipientEmails = await resolveRecipientEmails(emailConfig.recipientUserIds);
        }
      } else {
        recipientEmails = await resolveRecipientEmails(emailConfig.recipientUserIds);
      }
    }

    if (input.additionalRecipientEmails?.length) {
      const seen = new Set(recipientEmails);
      for (const email of input.additionalRecipientEmails) {
        if (email && !seen.has(email)) {
          recipientEmails.push(email);
          seen.add(email);
        }
      }
    }

    if (recipientEmails.length === 0) {
      logger.info(`No eligible recipients for ${input.eventId} — skipping email`);
      return;
    }

    // 5. Compile template (HTML + plain-text fallback)
    const { base, notification } = compileTemplates();
    const bodyHtml = notification(input.templateData);
    const fullHtml = base({
      senderName: emailConfig.fromName || 'Vapour Toolbox',
      body: bodyHtml,
    });
    const plainText = buildPlainText(input.templateData);

    // 6. Send via Gmail SMTP — per-recipient try/catch so one failure doesn't block the rest
    const transporter = createTransporter(emailConfig.fromEmail);
    const fromHeader = `"${emailConfig.fromName || 'Vapour Toolbox'}" <${emailConfig.fromEmail}>`;

    const results = await Promise.allSettled(
      recipientEmails.map((to) =>
        transporter.sendMail({
          from: fromHeader,
          to,
          subject: input.subject,
          html: fullHtml,
          text: plainText,
        })
      )
    );

    const sentEmails: string[] = [];
    const failedEmails: { email: string; error: string }[] = [];
    results.forEach((r, i) => {
      const email = recipientEmails[i];
      if (r.status === 'fulfilled') {
        sentEmails.push(email);
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        failedEmails.push({ email, error: message });
      }
    });

    const overallStatus: 'sent' | 'partial' | 'failed' =
      failedEmails.length === 0 ? 'sent' : sentEmails.length === 0 ? 'failed' : 'partial';

    if (failedEmails.length > 0) {
      logger.error(`${input.eventId}: ${sentEmails.length} sent, ${failedEmails.length} failed`, {
        failedEmails,
      });
    } else {
      logger.info(`Sent ${input.eventId} email to ${sentEmails.length} recipients`);
    }

    await logEmailDelivery({
      eventId: input.eventId,
      subject: input.subject,
      recipientEmails,
      sentEmails,
      failedEmails,
      status: overallStatus,
    });
  } catch (error) {
    logger.error(`Failed to send ${input.eventId} email:`, error);
    await logEmailDelivery({
      eventId: input.eventId,
      subject: input.subject,
      recipientEmails: [],
      sentEmails: [],
      failedEmails: [],
      status: 'failed',
      error: String(error),
    });
  }
}

/**
 * Write a delivery record to the emailLogs collection.
 *
 * - `recipientEmails` / `recipientCount` — every address attempted (back-compat)
 * - `sentEmails` / `failedEmails` — per-recipient outcome with error messages
 * - `status` — 'sent' (all ok), 'partial' (some failed), 'failed' (all failed or pre-send error)
 */
interface EmailLogEntry {
  eventId: string;
  subject: string;
  recipientEmails: string[];
  sentEmails: string[];
  failedEmails: { email: string; error: string }[];
  status: 'sent' | 'partial' | 'failed';
  error?: string;
}

async function logEmailDelivery(entry: EmailLogEntry): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection('emailLogs').add({
      eventId: entry.eventId,
      subject: entry.subject,
      recipientEmails: entry.recipientEmails,
      recipientCount: entry.recipientEmails.length,
      sentEmails: entry.sentEmails,
      sentCount: entry.sentEmails.length,
      failedEmails: entry.failedEmails,
      failedCount: entry.failedEmails.length,
      status: entry.status,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(entry.error !== undefined && { error: entry.error }),
    });
  } catch (logError) {
    // Don't let logging failures cascade — just warn
    logger.warn('Failed to write email delivery log:', logError);
  }
}

/**
 * Send a test email to a single recipient.
 * Used by the admin settings page "Send Test Email" button.
 * If eventId is provided, the email is labelled as a test for that specific event.
 */
export async function sendTestEmailToAddress(
  recipientEmail: string,
  fromEmail: string,
  fromName: string,
  eventId?: string
): Promise<void> {
  const transporter = createTransporter(fromEmail);

  const { base, notification } = compileTemplates();
  const title = eventId ? `Test: ${formatEventLabel(eventId)}` : 'Test Email';
  const message = eventId
    ? `This is a test of the "${formatEventLabel(eventId)}" notification. If you received this, email delivery for this event is working correctly.`
    : 'This is a test email from Vapour Toolbox. If you received this, email notifications are working correctly.';

  const bodyHtml = notification({
    title,
    message,
    details: [
      { label: 'Event', value: eventId || 'Global test' },
      { label: 'From', value: `${fromName} <${fromEmail}>` },
      {
        label: 'Sent At',
        value: new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        }),
      },
    ],
    linkUrl: `${APP_URL}/admin/email`,
  });
  const fullHtml = base({ senderName: fromName || 'Vapour Toolbox', body: bodyHtml });
  const plainText = buildPlainText({
    title,
    message,
    details: [
      { label: 'Event', value: eventId || 'Global test' },
      { label: 'From', value: `${fromName} <${fromEmail}>` },
    ],
    linkUrl: `${APP_URL}/admin/email`,
  });

  const subject = eventId
    ? `[Test] ${formatEventLabel(eventId)} — Vapour Toolbox`
    : '[Test] Vapour Toolbox Email Notification';

  await transporter.sendMail({
    from: `"${fromName || 'Vapour Toolbox'}" <${fromEmail}>`,
    to: recipientEmail,
    subject,
    html: fullHtml,
    text: plainText,
  });
}

/** Convert an event ID like 'bill_overdue' to a human-readable label */
function formatEventLabel(eventId: string): string {
  return eventId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
