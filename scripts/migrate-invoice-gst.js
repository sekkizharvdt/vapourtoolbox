/**
 * Migration script to add gstDetails and taxAmount to existing invoices
 * Run with: node scripts/migrate-invoice-gst.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../vapourtoolbox-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateInvoices() {
  try {
    console.log('Starting invoice GST migration...\n');

    // Get all customer invoices
    const invoicesSnapshot = await db
      .collection('transactions')
      .where('type', '==', 'CUSTOMER_INVOICE')
      .get();

    console.log(`Found ${invoicesSnapshot.size} invoices to check\n`);

    let updated = 0;
    let skipped = 0;

    for (const doc of invoicesSnapshot.docs) {
      const invoice = doc.data();

      // Skip if already has gstDetails or taxAmount
      if (invoice.gstDetails || invoice.taxAmount) {
        console.log(`✓ Skipping ${invoice.transactionNumber} - already has GST data`);
        skipped++;
        continue;
      }

      // Calculate GST from subtotal (assuming 18% GST)
      const subtotal = invoice.subtotal || 0;
      const gstRate = 0.18;
      const gstAmount = subtotal * gstRate;
      const totalWithGst = subtotal + gstAmount;

      const updates = {
        taxAmount: gstAmount,
        gstDetails: {
          totalGST: gstAmount,
          gstComponents: [
            {
              description: 'GST @ 18%',
              rate: 18,
              amount: gstAmount,
            },
          ],
        },
        // Update total if it doesn't match
        ...(invoice.totalAmount !== totalWithGst ? { totalAmount: totalWithGst } : {}),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      await doc.ref.update(updates);

      console.log(
        `✓ Updated ${invoice.transactionNumber} - GST: ₹${gstAmount.toFixed(2)}, Total: ₹${totalWithGst.toFixed(2)}`
      );
      updated++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${invoicesSnapshot.size}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateInvoices();
