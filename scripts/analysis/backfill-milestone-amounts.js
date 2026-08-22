#!/usr/bin/env node
/**
 * Batch 1 backfill: price the payment milestones on existing POs
 * (docs/reviews/2026-08-22-po-wise-payment-plan.md §5).
 *
 * Mirrors `calculateMilestoneAmounts` in
 * apps/web/src/lib/procurement/commercialTerms/paymentSchedule.ts — GST
 * pro-rata across the milestones flagged `carriesTax`, everything else on the
 * pre-tax taxable value, rounding residue absorbed by the last milestone.
 *
 * A PO whose schedule has no `carriesTax` milestone while GST is due CANNOT be
 * priced: the tax belongs to nobody and the milestones would fall short of the
 * grand total by exactly the tax. Those are reported and skipped — going
 * forward `validatePaymentSchedule` refuses the save, so the two editable ones
 * get fixed on next edit. PO/2026/01/0003 is COMPLETED and has to be assigned
 * by hand.
 *
 * Run backfill-po-link.js FIRST — this reads the `taxableValue` that one fills
 * in, and refuses to guess if it is missing.
 *
 * Usage, from the repo root:
 *   node ./scripts/analysis/backfill-milestone-amounts.js          # dry run
 *   node ./scripts/analysis/backfill-milestone-amounts.js --apply  # writes
 */

const admin = require('firebase-admin');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '..', 'docs', 'inputs', 'firebase-service-account-key.json');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const roundToPaisa = (n) => Math.round(n * 100) / 100;

function calculateMilestoneAmounts(milestones, { taxableValue, totalTax, grandTotal }) {
  const flaggedPct = milestones.reduce(
    (sum, m) => (m.carriesTax === true ? sum + (m.percentage || 0) : sum),
    0
  );

  const priced = milestones.map((m) => {
    const pct = m.percentage || 0;
    const base = (taxableValue * pct) / 100;
    const taxShare = flaggedPct > 0 && m.carriesTax === true ? (totalTax * pct) / flaggedPct : 0;
    return { ...m, amount: roundToPaisa(base + taxShare) };
  });

  const pctTotal = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
  if (Math.abs(pctTotal - 100) < 0.01 && flaggedPct > 0) {
    const sum = roundToPaisa(priced.reduce((acc, m) => acc + (m.amount || 0), 0));
    const residue = roundToPaisa(grandTotal - sum);
    const last = priced[priced.length - 1];
    if (residue !== 0 && last) last.amount = roundToPaisa(last.amount + residue);
  }

  return priced;
}

(async () => {
  console.log(APPLY ? '*** APPLY MODE — writing ***' : '*** DRY RUN — pass --apply to write ***');

  const snap = await db.collection('purchaseOrders').get();
  const writes = [];
  const skipped = [];

  snap.forEach((d) => {
    const po = d.data();
    const schedule = po.commercialTerms?.paymentSchedule;
    if (!Array.isArray(schedule) || schedule.length === 0) return;

    const totalTax = po.totalTax || 0;
    const grandTotal = po.grandTotal || 0;
    const taxableValue =
      typeof po.taxableValue === 'number' ? po.taxableValue : roundToPaisa(grandTotal - totalTax);

    const flagged = schedule.filter((m) => m.carriesTax === true).length;
    if (totalTax > 0 && flagged === 0) {
      skipped.push({
        number: po.number,
        status: po.status,
        reason: 'no milestone carries the GST',
      });
      return;
    }

    const priced = calculateMilestoneAmounts(schedule, { taxableValue, totalTax, grandTotal });
    const sum = roundToPaisa(priced.reduce((a, m) => a + m.amount, 0));

    if (Math.abs(sum - grandTotal) >= 0.01) {
      skipped.push({
        number: po.number,
        status: po.status,
        reason: `amounts total ${sum} but grandTotal is ${grandTotal}`,
      });
      return;
    }

    writes.push({
      ref: d.ref,
      number: po.number,
      priced,
      grandTotal,
      commercialTerms: po.commercialTerms,
    });
    console.log(`\n${po.number}  (grandTotal ${grandTotal})`);
    priced.forEach((m) =>
      console.log(
        `   #${m.serialNumber} ${m.percentage}%${m.carriesTax ? ' +tax' : '     '}  ${m.amount}  ${m.paymentType}`
      )
    );
  });

  if (skipped.length) {
    console.log('\n=== SKIPPED — need a tax assignment before they can be priced ===');
    skipped.forEach((r) => console.log(`  ${r.number} [${r.status}]: ${r.reason}`));
  }

  console.log(`\n${writes.length} PO(s) priceable, ${skipped.length} skipped`);

  if (!APPLY || writes.length === 0) return;

  const batch = db.batch();
  writes.forEach((w) =>
    batch.update(w.ref, {
      commercialTerms: { ...w.commercialTerms, paymentSchedule: w.priced },
      updatedAt: admin.firestore.Timestamp.now(),
    })
  );
  await batch.commit();
  console.log(`applied to ${writes.length} PO(s)`);
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
