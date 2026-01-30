/**
 * Test Email Cloud Function
 *
 * Callable function that sends a test email to verify SendGrid configuration.
 * Only accessible by admin users.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { sendgridApiKey, sendTestEmailToAddress } from './sendEmail';

/**
 * Send a test email to verify email delivery is working.
 * Called from the admin settings page.
 */
export const sendTestEmail = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [sendgridApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // Check admin permission (MANAGE_USERS = bit 0 = 1)
    const permissions = (request.auth.token.permissions as number) || 0;
    if (Math.floor(permissions / 1) % 2 !== 1) {
      throw new HttpsError('permission-denied', 'Only admins can send test emails');
    }

    const { recipientEmail, fromEmail, fromName } = request.data as {
      recipientEmail: string;
      fromEmail: string;
      fromName: string;
    };

    if (!recipientEmail || !fromEmail) {
      throw new HttpsError('invalid-argument', 'recipientEmail and fromEmail are required');
    }

    try {
      logger.info(`Sending test email to ${recipientEmail} from ${fromEmail}`);
      await sendTestEmailToAddress(recipientEmail, fromEmail, fromName || 'Vapour Toolbox');
      return { success: true, message: `Test email sent to ${recipientEmail}` };
    } catch (error) {
      logger.error('Test email failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpsError('internal', `Failed to send test email: ${message}`);
    }
  }
);
