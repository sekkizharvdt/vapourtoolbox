/**
 * Email module configuration constants.
 *
 * Override APP_URL via the APP_URL env var (e.g. for staging deployments)
 * by setting it in functions/.env or via `firebase functions:config`.
 */

export const APP_URL = process.env.APP_URL || 'https://toolbox.vapourdesal.com';
