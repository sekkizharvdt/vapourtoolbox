/**
 * Email Service — Core SendGrid email sending module
 *
 * Reads notification settings from Firestore, resolves recipient emails,
 * compiles Handlebars templates, and sends via SendGrid.
 *
 * SendGrid API key is stored as a Firebase secret:
 *   firebase functions:secrets:set SENDGRID_API_KEY
 */

import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// Firebase secret — must be set via CLI before deploying
export const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

interface EmailConfig {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  recipientUserIds: string[];
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
 * 4. Compiles template and sends via SendGrid
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

    // 3. Resolve recipients
    const recipientEmails = await resolveRecipientEmails(emailConfig.recipientUserIds);
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

    // 5. Send via SendGrid
    sgMail.setApiKey(sendgridApiKey.value());

    const messages = recipientEmails.map((to) => ({
      to,
      from: {
        email: emailConfig.fromEmail,
        name: emailConfig.fromName || 'Vapour Toolbox',
      },
      subject: input.subject,
      html: fullHtml,
    }));

    await sgMail.send(messages);

    logger.info(
      `Sent ${input.eventId} email to ${recipientEmails.length} recipients: ${recipientEmails.join(', ')}`
    );
  } catch (error) {
    logger.error(`Failed to send ${input.eventId} email:`, error);
  }
}

/**
 * Send a test email to a single recipient.
 * Used by the admin settings page "Send Test Email" button.
 */
export async function sendTestEmailToAddress(
  recipientEmail: string,
  fromEmail: string,
  fromName: string
): Promise<void> {
  sgMail.setApiKey(sendgridApiKey.value());

  const { base, notification } = compileTemplates();
  const bodyHtml = notification({
    title: 'Test Email',
    message:
      'This is a test email from Vapour Toolbox. If you received this, email notifications are working correctly.',
    details: [
      { label: 'From', value: `${fromName} <${fromEmail}>` },
      { label: 'Sent At', value: new Date().toISOString() },
    ],
    linkUrl: 'https://toolbox.vapourdesal.com/admin/settings',
  });
  const fullHtml = base({ senderName: fromName || 'Vapour Toolbox', body: bodyHtml });

  await sgMail.send({
    to: recipientEmail,
    from: { email: fromEmail, name: fromName || 'Vapour Toolbox' },
    subject: '[Test] Vapour Toolbox Email Notification',
    html: fullHtml,
  });
}
