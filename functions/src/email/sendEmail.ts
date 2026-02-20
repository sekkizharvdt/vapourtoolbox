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

    // 3. Resolve recipients — use direct emails if provided, otherwise the configured list
    const recipientEmails = input.directRecipientEmails?.length
      ? input.directRecipientEmails
      : await resolveRecipientEmails(emailConfig.recipientUserIds);
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
  const transporter = createTransporter(fromEmail);

  const { base, notification } = compileTemplates();
  const bodyHtml = notification({
    title: 'Test Email',
    message:
      'This is a test email from Vapour Toolbox. If you received this, email notifications are working correctly.',
    details: [
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
    linkUrl: 'https://toolbox.vapourdesal.com/admin/settings',
  });
  const fullHtml = base({ senderName: fromName || 'Vapour Toolbox', body: bodyHtml });

  await transporter.sendMail({
    from: `"${fromName || 'Vapour Toolbox'}" <${fromEmail}>`,
    to: recipientEmail,
    subject: '[Test] Vapour Toolbox Email Notification',
    html: fullHtml,
  });
}
