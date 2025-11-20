import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { BOMItem } from '@vapour/types';

/**
 * Trigger: When a BOM Item is created, updated, or deleted
 * Action: Update the parent BOM's summary totals (weight, cost, etc.)
 */
export const onBOMItemWrite = onDocumentWritten(
  'boms/{bomId}/items/{itemId}',
  async (
    event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { bomId: string; itemId: string }>
  ) => {
    const bomId = event.params.bomId;
    const change = event.data;

    // If no change data (shouldn't happen for onDocumentWritten but good for type safety)
    if (!change) return;

    const db = admin.firestore();
    const bomRef = db.collection('boms').doc(bomId);

    // Get data before and after the change
    const newData = change.after.exists ? (change.after.data() as BOMItem) : null;
    const oldData = change.before.exists ? (change.before.data() as BOMItem) : null;

    // If no change in data (e.g. touch), skip
    if (!newData && !oldData) return;

    // Calculate deltas
    let deltaWeight = 0;
    let deltaMaterialCost = 0;
    let deltaFabricationCost = 0;
    let deltaServiceCost = 0;
    let deltaItemCount = 0;

    // Add new values
    if (newData) {
      deltaWeight += newData.calculatedProperties?.totalWeight || 0;
      deltaMaterialCost += newData.cost?.totalMaterialCost?.amount || 0;
      deltaFabricationCost += newData.cost?.totalFabricationCost?.amount || 0;
      deltaServiceCost += newData.cost?.totalServiceCost?.amount || 0;
      deltaItemCount += 1;
    }

    // Subtract old values
    if (oldData) {
      deltaWeight -= oldData.calculatedProperties?.totalWeight || 0;
      deltaMaterialCost -= oldData.cost?.totalMaterialCost?.amount || 0;
      deltaFabricationCost -= oldData.cost?.totalFabricationCost?.amount || 0;
      deltaServiceCost -= oldData.cost?.totalServiceCost?.amount || 0;
      deltaItemCount -= 1;
    }

    // If no changes in relevant fields, skip update
    if (
      deltaWeight === 0 &&
      deltaMaterialCost === 0 &&
      deltaFabricationCost === 0 &&
      deltaServiceCost === 0 &&
      deltaItemCount === 0
    ) {
      return;
    }

    // Calculate total direct cost delta
    const deltaDirectCost = deltaMaterialCost + deltaFabricationCost + deltaServiceCost;

    // For now, we assume totalCost delta is same as direct cost delta
    // (Indirect costs like overhead/profit are usually calculated on top,
    // but we'll update the total base here)
    const deltaTotalCost = deltaDirectCost;

    // Perform atomic increment update
    await bomRef.update({
      'summary.totalWeight': admin.firestore.FieldValue.increment(deltaWeight),
      'summary.totalMaterialCost.amount': admin.firestore.FieldValue.increment(deltaMaterialCost),
      'summary.totalFabricationCost.amount':
        admin.firestore.FieldValue.increment(deltaFabricationCost),
      'summary.totalServiceCost.amount': admin.firestore.FieldValue.increment(deltaServiceCost),
      'summary.totalDirectCost.amount': admin.firestore.FieldValue.increment(deltaDirectCost),
      'summary.totalCost.amount': admin.firestore.FieldValue.increment(deltaTotalCost),
      'summary.itemCount': admin.firestore.FieldValue.increment(deltaItemCount),
      'summary.lastCalculated': admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Updated BOM ${bomId} summary:`, {
      deltaWeight,
      deltaMaterialCost,
      deltaFabricationCost,
      deltaServiceCost,
      deltaItemCount,
    });
  }
);
