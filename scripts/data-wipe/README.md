# Data Wipe Utility - Pre-Production Cleanup

This utility provides a safe way to wipe all test data from Firestore before going to production.

## Purpose

After your accountant completes testing with real data, use this script to clean the database before deploying to production users.

## What Gets Deleted

The following collections will be completely wiped:

- `transactions` - All invoices, bills, payments, journal entries
- `payments` - All payment records
- `entities` - All customers and vendors
- `projects` - All projects/cost centres
- `accounts` - Chart of Accounts (will need to be regenerated)
- `journals` - All journal entries
- `allocations` - All payment allocations
- `bankTransactions` - All bank transactions
- `reconciliations` - All bank reconciliations

## What Gets Preserved

The following collections are **NEVER** deleted:

- `users` - User accounts (admin, accountant, etc.)
- `company` - Company settings and configuration
- `roles` - User roles
- `permissions` - User permissions

## Safety Features

1. **Requires --confirm flag**: Won't run without explicit confirmation
2. **Interactive confirmation**: Asks "Type 'yes' to proceed"
3. **Automatic backups**: Creates JSON backups of all data before deletion
4. **Summary report**: Shows exactly what will be deleted before proceeding
5. **Protected collections**: User accounts and company settings are never touched

## Prerequisites

1. Firebase service account key file must be available:
   - Place `firebase-service-account.json` in project root, OR
   - Set `FIREBASE_SERVICE_ACCOUNT` environment variable

2. Install dependencies:
   ```bash
   cd scripts/data-wipe
   npm install firebase-admin
   ```

## Usage

### Step 1: Review what will be deleted

```bash
node scripts/data-wipe/wipe-all-data.js --confirm
```

The script will show you:
- How many documents exist in each collection
- Which collections will be deleted
- Which collections are protected
- Total number of documents that will be removed

### Step 2: Confirm the deletion

When prompted, type `yes` to proceed.

### Step 3: Verify backups

After completion, backups will be saved in `backups/` directory:

```
backups/
  ├── transactions_2025-11-02T03-30-00.json
  ├── entities_2025-11-02T03-30-00.json
  ├── projects_2025-11-02T03-30-00.json
  └── ...
```

## Example Output

```
═══════════════════════════════════════════════════════════
   🗑️  DATA WIPE UTILITY - PRE-PRODUCTION CLEANUP
═══════════════════════════════════════════════════════════

🔍 Environment Check:

   Project ID: vapour-toolbox
   Service Account: firebase-service-account.json

📊 Current Data Summary:

   transactions         : 45 documents
   payments            : 12 documents
   entities            : 8 documents
   projects            : 3 documents
   accounts            : 150 documents
   journals            : 0 documents
   allocations         : 12 documents
   bankTransactions    : 0 documents
   reconciliations     : 0 documents

🔒 Protected Collections (will NOT be deleted):

   users               : 2 documents
   company             : 1 documents
   roles               : 3 documents
   permissions         : 10 documents

⚠️  WARNING: This action is IRREVERSIBLE!

   You are about to delete 230 documents.
   Backups will be created before deletion.

Type "yes" to proceed with data wipe: yes

🔄 Starting data wipe...

📦 Processing transactions...
   ✓ Backed up 45 documents to transactions_2025-11-02T03-30-00.json
   ✓ Deleted 45 documents

📦 Processing payments...
   ✓ Backed up 12 documents to payments_2025-11-02T03-30-00.json
   ✓ Deleted 12 documents

...

═══════════════════════════════════════════════════════════
   ✅ DATA WIPE COMPLETED SUCCESSFULLY
═══════════════════════════════════════════════════════════

   📦 Backed up: 230 documents
   🗑️  Deleted: 230 documents
   🔒 Protected: 4 collections

   Backups saved to: scripts/data-wipe/../../backups/

   Next steps:
   1. Initialize Chart of Accounts (if needed)
   2. Verify production data is clean
   3. Deploy to production
```

## After Data Wipe

1. **Re-initialize Chart of Accounts**:
   - Run the Chart of Accounts initialization script
   - Or use the UI to generate the default Indian CoA

2. **Verify Clean State**:
   - Check Firestore console to ensure all test data is gone
   - Verify user accounts still exist
   - Verify company settings are intact

3. **Deploy to Production**:
   - Run the manual deployment workflow on GitHub Actions
   - OR use: `firebase deploy --project vapour-toolbox`

## Troubleshooting

### "Firebase service account key not found"

```bash
# Download service account key from Firebase Console
# Place it in project root as firebase-service-account.json
# OR set environment variable:
export FIREBASE_SERVICE_ACCOUNT=/path/to/your-service-account.json
```

### "Permission denied"

Ensure the service account has the following roles:
- Cloud Datastore Owner
- Firebase Admin

### Restore from Backup

If you need to restore data, use the backup JSON files:

```javascript
const fs = require('fs');
const admin = require('firebase-admin');

const backup = JSON.parse(fs.readFileSync('backups/transactions_xxx.json'));
const db = admin.firestore();

for (const doc of backup) {
  await db.collection('transactions').doc(doc.id).set(doc.data);
}
```

## Security Note

⚠️ **This script has destructive capabilities**.

- Only run on the database you intend to clean
- Always verify the Project ID before confirming
- Keep backups in a secure location
- Do NOT commit service account keys to git

## Support

If you encounter issues:
1. Check that firebase-service-account.json exists and is valid
2. Verify you have the correct permissions
3. Review the backup files to ensure data was captured
4. Contact support if data recovery is needed
