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
  /** Always include these emails in addition to the configured recipient list (deduped) */
  additionalRecipientEmails?: string[];
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

    // 3. Resolve recipients — use direct emails if provided, then per-event override, then global list
    let recipientEmails: string[];
    if (input.directRecipientEmails?.length) {
      recipientEmails = input.directRecipientEmails;
    } else {
      const eventSpecificIds = emailConfig.eventRecipients?.[input.eventId];
      const idsToResolve =
        eventSpecificIds && eventSpecificIds.length > 0
          ? eventSpecificIds
          : emailConfig.recipientUserIds;
      recipientEmails = await resolveRecipientEmails(idsToResolve);
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
      logger.info('No eligible recipients — skipping email');
      return;
    }

    // 4. Compile template
    const { base, notification } = compileTemplates();
    const bodyHtml = notification(input.templateData);
    const fullHtml = base({
      senderName: emailConfig.fromName || 'Vapour Toolbox',
      body: bodyHtml,
    });

    // 5. Send via Gmail SMTP
    const transporter = createTransporter(emailConfig.fromEmail);

    for (const to of recipientEmails) {
      await transporter.sendMail({
        from: `"${emailConfig.fromName || 'Vapour Toolbox'}" <${emailConfig.fromEmail}>`,
        to,
        subject: input.subject,
        html: fullHtml,
      });
    }

    logger.info(
      `Sent ${input.eventId} email to ${recipientEmails.length} recipients: ${recipientEmails.join(', ')}`
    );

    // 6. Log delivery to Firestore
    await logEmailDelivery(input.eventId, input.subject, recipientEmails, 'sent');
  } catch (error) {
    logger.error(`Failed to send ${input.eventId} email:`, error);
    await logEmailDelivery(input.eventId, input.subject, [], 'failed', String(error));
  }
}

/**
 * Write a delivery record to the emailLogs collection.
 */
async function logEmailDelivery(
  eventId: string,
  subject: string,
  recipientEmails: string[],
  status: 'sent' | 'failed',
  error?: string
): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection('emailLogs').add({
      eventId,
      subject,
      recipientEmails,
      recipientCount: recipientEmails.length,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status,
      ...(error !== undefined && { error }),
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
    linkUrl: 'https://toolbox.vapourdesal.com/admin/email',
  });
  const fullHtml = base({ senderName: fromName || 'Vapour Toolbox', body: bodyHtml });

  const subject = eventId
    ? `[Test] ${formatEventLabel(eventId)} — Vapour Toolbox`
    : '[Test] Vapour Toolbox Email Notification';

  await transporter.sendMail({
    from: `"${fromName || 'Vapour Toolbox'}" <${fromEmail}>`,
    to: recipientEmail,
    subject,
    html: fullHtml,
  });
}

/** Convert an event ID like 'bill_overdue' to a human-readable label */
function formatEventLabel(eventId: string): string {
  return eventId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
