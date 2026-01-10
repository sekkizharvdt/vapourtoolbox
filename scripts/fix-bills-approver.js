/**
 * One-time script to fix PENDING_APPROVAL bills that don't have an assignedApproverId
 *
 * Run with: node scripts/fix-bills-approver.js
 *
 * Make sure you have GOOGLE_APPLICATION_CREDENTIALS set or are logged into Firebase
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(
  __dirname,
  '../mcp-servers/firebase-feedback/service-account-key.json'
);
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'vapour-toolbox',
  });
}

const db = admin.firestore();

// Your user ID - the person who should be the approver
const APPROVER_USER_ID = 'wTT35QYJ9og7gr1FAWuDpUvDc6F3';
const APPROVER_NAME = 'Sekkizhar'; // Update this with your name

async function fixBillsWithoutApprover() {
  console.log('Fetching PENDING_APPROVAL bills without assignedApproverId...\n');

  const transactionsRef = db.collection('transactions');
  const query = transactionsRef
    .where('type', '==', 'VENDOR_BILL')
    .where('status', '==', 'PENDING_APPROVAL');

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('No PENDING_APPROVAL bills found.');
    return;
  }

  console.log(`Found ${snapshot.size} PENDING_APPROVAL bills.\n`);

  const billsToFix = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.assignedApproverId) {
      billsToFix.push({
        id: doc.id,
        billNumber: data.vendorInvoiceNumber || data.transactionNumber,
        vendorName: data.entityName,
      });
    }
  });

  if (billsToFix.length === 0) {
    console.log('All PENDING_APPROVAL bills already have an assignedApproverId.');
    return;
  }

  console.log(`Found ${billsToFix.length} bills without assignedApproverId:\n`);
  billsToFix.forEach((bill) => {
    console.log(`  - ${bill.billNumber} (${bill.vendorName}) [${bill.id}]`);
  });

  console.log(`\nUpdating bills to set assignedApproverId to ${APPROVER_USER_ID}...\n`);

  const batch = db.batch();

  for (const bill of billsToFix) {
    const docRef = transactionsRef.doc(bill.id);
    batch.update(docRef, {
      assignedApproverId: APPROVER_USER_ID,
      assignedApproverName: APPROVER_NAME,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  await batch.commit();

  console.log(`✅ Successfully updated ${billsToFix.length} bills.`);
}

fixBillsWithoutApprover()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
