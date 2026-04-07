#!/usr/bin/env node
/**
 * Migration script: Fix duplicate transaction numbers
 *
 * Run with: node scripts/migrate-fix-duplicate-numbers.js [--dry-run]
 *
 * Strategy:
 *   1. Scan all transactions, group by transactionNumber
 *   2. For each duplicate set, keep the oldest (by date), renumber the rest
 *   3. New numbers use the FY-scoped format: PREFIX-YYNN-NNNN
 *   4. Also seeds the counter documents so the app picks up from the right sequence
 *
 * Use --dry-run to preview changes without writing to Firestore.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Resolve service account ────────────────────────────────────────────
const candidates = [
  path.join(__dirname, '../firebase-service-account.json'),
  path.join(__dirname, '../mcp-servers/accounting-audit/service-account-key.json'),
];

let serviceAccountPath = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    serviceAccountPath = p;
    break;
  }
}

if (!serviceAccountPath) {
  console.error('Error: No service account key found.');
  candidates.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

console.log(`Using service account: ${path.relative(process.cwd(), serviceAccountPath)}\n`);

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = admin.firestore();
const dryRun = process.argv.includes('--dry-run');

// ── Prefixes ───────────────────────────────────────────────────────────
const TYPE_PREFIXES = {
  CUSTOMER_INVOICE: 'INV',
  CUSTOMER_PAYMENT: 'RCPT',
  VENDOR_BILL: 'BILL',
  VENDOR_PAYMENT: 'VPAY',
  JOURNAL_ENTRY: 'JE',
  BANK_TRANSFER: 'TRF',
  EXPENSE_CLAIM: 'EXP',
  DIRECT_PAYMENT: 'DPAY',
  DIRECT_RECEIPT: 'DRCPT',
};

/** Compute FY code from a date (April start) */
function getFYCode(date, fyStartMonth = 4) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (fyStartMonth === 1) return String(year).slice(2);
  const fyStartYear = month < fyStartMonth ? year - 1 : year;
  const fyEndYear = fyStartYear + 1;
  return `${String(fyStartYear).slice(2)}${String(fyEndYear).slice(2)}`;
}

/** Get the date from a Firestore document */
function getDate(data) {
  const raw = data.date || data.transactionDate || data.createdAt;
  if (!raw) return new Date(0);
  if (raw.toDate) return raw.toDate();
  if (raw instanceof Date) return raw;
  return new Date(raw);
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===');
  console.log('');

  // Load FY start month from company settings
  let fyStartMonth = 4;
  try {
    const settingsDoc = await db.collection('company').doc('settings').get();
    if (settingsDoc.exists) {
      fyStartMonth = settingsDoc.data().fiscalYearStartMonth || 4;
    }
  } catch (e) {
    console.log('Could not load company settings, using April (4) as FY start');
  }
  console.log(`Fiscal year start month: ${fyStartMonth}\n`);

  // 1. Fetch all transactions
  const snapshot = await db.collection('transactions').get();
  console.log(`Total transactions: ${snapshot.size}`);

  // 2. Group by transactionNumber
  const byNumber = new Map();
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.isDeleted) return;
    const num = data.transactionNumber;
    if (!num) return;
    if (!byNumber.has(num)) byNumber.set(num, []);
    byNumber.get(num).push({ id: doc.id, data });
  });

  // 3. Find duplicates
  const duplicates = [];
  for (const [num, docs] of byNumber) {
    if (docs.length > 1) {
      duplicates.push({ number: num, docs });
    }
  }

  console.log(`Duplicate numbers found: ${duplicates.length}`);
  console.log(`Total transactions affected: ${duplicates.reduce((s, d) => s + d.docs.length, 0)}`);
  console.log('');

  if (duplicates.length === 0) {
    console.log('No duplicates to fix.');
    return;
  }

  // 4. Track the highest sequence per type+FY for counter seeding
  const counterState = new Map(); // key: "type-FYcode" -> highest sequence

  // 5. First pass: scan ALL transactions to find existing max sequences in new format
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.isDeleted) return;
    const num = data.transactionNumber;
    if (!num) return;

    // Check if already in new format: PREFIX-YYNN-NNNN
    const newMatch = num.match(/^[A-Z]+-(\d{2,4})-(\d+)$/);
    if (newMatch) {
      const type = data.type;
      const fyCode = newMatch[1];
      const seq = parseInt(newMatch[2], 10);
      const key = `${type}-FY${fyCode}`;
      counterState.set(key, Math.max(counterState.get(key) || 0, seq));
    }
  });

  // 6. Process duplicates
  let fixed = 0;
  const updates = [];

  for (const { number, docs } of duplicates) {
    // Sort by date — oldest first
    docs.sort((a, b) => getDate(a.data).getTime() - getDate(b.data).getTime());

    // Keep the first (oldest), renumber the rest
    const kept = docs[0];
    console.log(
      `  ${number} (${docs.length} copies) — keeping ${kept.id} (${getDate(kept.data).toISOString().slice(0, 10)})`
    );

    for (let i = 1; i < docs.length; i++) {
      const dup = docs[i];
      const type = dup.data.type;
      const prefix = TYPE_PREFIXES[type] || 'TXN';
      const date = getDate(dup.data);
      const fyCode = getFYCode(date, fyStartMonth);
      const counterKey = `${type}-FY${fyCode}`;

      // Increment counter
      const nextSeq = (counterState.get(counterKey) || 0) + 1;
      counterState.set(counterKey, nextSeq);

      const newNumber = `${prefix}-${fyCode}-${String(nextSeq).padStart(4, '0')}`;
      console.log(
        `    ${dup.id}: ${number} -> ${newNumber} (${getDate(dup.data).toISOString().slice(0, 10)})`
      );

      updates.push({
        id: dup.id,
        oldNumber: number,
        newNumber,
        type,
      });
      fixed++;
    }
  }

  console.log(`\nTransactions to renumber: ${fixed}`);

  // 7. Write updates
  if (!dryRun && updates.length > 0) {
    console.log('\nWriting updates...');
    for (let i = 0; i < updates.length; i += 490) {
      const batch = db.batch();
      const chunk = updates.slice(i, i + 490);
      for (const u of chunk) {
        batch.update(db.collection('transactions').doc(u.id), {
          transactionNumber: u.newNumber,
          _previousTransactionNumber: u.oldNumber,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      console.log(`  Batch ${Math.floor(i / 490) + 1}: ${chunk.length} transactions updated`);
    }
    console.log('Transaction updates complete.');
  }

  // 8. Seed counter documents so the app continues from the right sequence
  console.log('\nSeeding counter documents...');
  for (const [key, value] of counterState) {
    // key format: "TYPE-FYcode"
    const parts = key.split('-FY');
    const type = parts[0].toLowerCase();
    const fyCode = parts[1];
    const counterDocKey = `transaction-${type}-FY${fyCode}`;

    if (!dryRun) {
      const counterRef = db.collection('counters').doc(counterDocKey);
      const existing = await counterRef.get();
      const currentValue = existing.exists ? existing.data().value || 0 : 0;

      if (value > currentValue) {
        await counterRef.set(
          {
            type: `accounting_${type}`,
            fiscalYear: fyCode,
            value: value,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(existing.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );
        console.log(`  ${counterDocKey}: ${currentValue} -> ${value}`);
      } else {
        console.log(`  ${counterDocKey}: already at ${currentValue} (>= ${value}), skipping`);
      }
    } else {
      console.log(`  ${counterDocKey}: would set to ${value}`);
    }
  }

  console.log(`\nDone. ${fixed} transactions ${dryRun ? 'would be' : 'were'} renumbered.`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
