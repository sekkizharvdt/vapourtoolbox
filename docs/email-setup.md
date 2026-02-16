# Email Notification Setup Guide

Vapour Toolbox sends email notifications via **Gmail SMTP** using Nodemailer. This requires a Google Workspace (or Gmail) account with an **App Password**.

---

## Prerequisites

- A Google Workspace or Gmail account that will be the sender (e.g. `notifications@yourcompany.com`)
- 2-Step Verification enabled on that Google account
- Firebase CLI installed and authenticated (`firebase login`)

---

## Step 1: Enable 2-Step Verification

If not already enabled on the sender Google account:

1. Go to https://myaccount.google.com/security
2. Under "How you sign in to Google", click **2-Step Verification**
3. Follow the prompts to enable it

---

## Step 2: Generate a Gmail App Password

1. Go to https://myaccount.google.com/apppasswords
   - If you don't see this option, 2-Step Verification is not enabled (see Step 1)
2. Enter a name like `Vapour Toolbox Notifications`
3. Click **Create**
4. Copy the 16-character password shown (e.g. `abcd efgh ijkl mnop`)
   - **Save this somewhere safe** — you won't be able to see it again

> **Note:** For Google Workspace accounts, the admin may need to allow "Less secure app access" or ensure App Passwords are not disabled at the org level. Check **Admin Console > Security > Access and data control > Less secure apps** if the App Passwords page is not available.

---

## Step 3: Store the App Password as a Firebase Secret

Run this from the project root:

```bash
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

When prompted, paste the 16-character App Password (without spaces).

To verify it was stored:

```bash
firebase functions:secrets:access GMAIL_APP_PASSWORD
```

---

## Step 4: Configure the Sender in Vapour Toolbox

1. Log in to Vapour Toolbox as an admin
2. Go to **Admin > Settings** (the Email Configuration section)
3. Set:
   - **From Email**: The Gmail/Workspace address that generated the App Password (e.g. `notifications@yourcompany.com`)
   - **From Name**: The display name for outgoing emails (e.g. `Vapour Toolbox`)
   - **Enable Notifications**: Toggle ON
   - **Recipients**: Select which users should receive notification emails
4. Click **Save**

---

## Step 5: Send a Test Email

On the same Admin > Settings page:

1. Click **Send Test Email**
2. Check the inbox of the logged-in admin user
3. If the test arrives, email is working

---

## Step 6: Configure Notification Events

1. Go to **Admin > Notifications**
2. Toggle ON/OFF individual events by category:
   - **Procurement** — PR submitted, PO approved, goods receipt completed, etc.
   - **Accounting** — Invoice/bill created, payment batch submitted/approved, journal entries
   - **HR & Leave** — Leave requests, on-duty, travel expenses
   - **Proposals & Business** — Enquiry updates, proposal status changes
3. Changes save automatically

---

## Step 7: Deploy Functions

After setting the secret, deploy the Cloud Functions:

```bash
firebase deploy --only functions
```

The secret is automatically made available to all trigger functions that reference it.

---

## Troubleshooting

### "Authentication failed" or "Invalid login"

- Verify the App Password is correct: `firebase functions:secrets:access GMAIL_APP_PASSWORD`
- Ensure the From Email in Admin > Settings **exactly matches** the Google account that generated the App Password
- Check that 2-Step Verification is still enabled

### "Username and Password not accepted"

- Google Workspace admin may have disabled App Passwords — check Admin Console
- The App Password may have been revoked — generate a new one

### Emails not being sent (no errors in logs)

- Check Admin > Settings: ensure **Enable Notifications** is ON
- Check Admin > Notifications: ensure the specific event is toggled ON
- Verify at least one recipient user has an email address in their profile

### Check Cloud Function logs

```bash
firebase functions:log --only onAccountingNotify
firebase functions:log --only onLeaveNotify
```

Or view logs in the Firebase Console under **Functions > Logs**.

---

## Architecture Overview

```
Firestore document change
  → Cloud Function trigger (e.g. onAccountingNotify)
    → Reads notificationSettings/emailConfig from Firestore
    → Checks if event is enabled in notificationSettings/config
    → Resolves recipient emails from user profiles
    → Compiles Handlebars HTML template
    → Sends via Gmail SMTP (smtp.gmail.com:465, TLS)
```

**Key Firestore documents:**

- `notificationSettings/emailConfig` — sender address, recipients, enabled flag
- `notificationSettings/config` — per-event toggle switches

**Firebase Secret:**

- `GMAIL_APP_PASSWORD` — the 16-character App Password
