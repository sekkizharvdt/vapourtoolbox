/**
 * BOM Quote PDF Service
 *
 * Client-side service for generating BOM techno-commercial offer PDFs.
 * Replaces the previous Puppeteer Cloud Function (generateBOMQuotePDF).
 *
 * Flow:
 * 1. Fetch BOM + items + cost config from Firestore
 * 2. Transform into BOMQuotePDFData shape
 * 3. Render via @react-pdf/renderer
 * 4. Download blob directly (no Storage upload needed)
 */

import React from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type {
  BOMQuotePDFData,
  PDFBOMItem,
  PDFGenerationOptions,
  BOM,
  BOMItem,
  Money,
} from '@vapour/types';
import {
  DEFAULT_TERMS_AND_CONDITIONS,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_DELIVERY_TERMS,
} from '@vapour/types';
import { generatePDFBlob, downloadBlob, sanitiseFilename } from '@/lib/pdf/pdfUtils';
import { BOMQuotePDFDocument } from '@/components/pdf/BOMQuotePDFDocument';

/* ─── Helpers ────────────────────────────────────────────── */

function formatCurrency(money: Money | undefined | null): string {
  if (!money) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: money.currency || 'INR',
  }).format(money.amount);
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return new Date().toLocaleDateString('en-IN');
  const date =
    ts && typeof ts === 'object' && 'toDate' in ts
      ? (ts as { toDate: () => Date }).toDate()
      : ts instanceof Date
        ? ts
        : new Date(ts as string);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function computeItemTotalPrice(item: BOMItem): Money | null {
  const cost = item.cost;
  if (!cost) return null;

  const matAmount = cost.totalMaterialCost?.amount ?? 0;
  const fabAmount = cost.totalFabricationCost?.amount ?? 0;
  const svcAmount = cost.totalServiceCost?.amount ?? 0;
  const currency = cost.totalMaterialCost?.currency ?? 'INR';

  return { amount: matAmount + fabAmount + svcAmount, currency };
}

/* ─── Main Service ───────────────────────────────────────── */

/**
 * Generate and download a BOM Quote PDF
 */
export async function generateBOMQuotePDF(
  db: Firestore,
  bomId: string,
  options: PDFGenerationOptions
): Promise<void> {
  // 1. Fetch BOM
  const bomDoc = await getDoc(doc(db, 'boms', bomId));
  if (!bomDoc.exists()) {
    throw new Error('BOM not found');
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const bom = { id: bomDoc.id, ...bomDoc.data() } as BOM;

  // 2. Fetch BOM items
  const itemsQuery = query(collection(db, 'boms', bomId, 'items'), orderBy('sortOrder', 'asc'));
  const itemsSnapshot = await getDocs(itemsQuery);
  const items: BOMItem[] = itemsSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as BOMItem[];

  // 3. Fetch cost config if available
  let costConfigName: string | undefined;
  if (bom.summary?.costConfigId) {
    const configDoc = await getDoc(doc(db, 'costConfigurations', bom.summary.costConfigId));
    if (configDoc.exists()) {
      costConfigName = configDoc.data()?.name as string;
    }
  }

  // 4. Build PDF data
  const pdfData = buildPDFData(bom, items, options, costConfigName);

  // 5. Generate and download
  const blob = await generatePDFBlob(React.createElement(BOMQuotePDFDocument, { data: pdfData }));
  const filename = sanitiseFilename(`Quote_${bom.bomCode}_${bom.name}.pdf`);
  downloadBlob(blob, filename);
}

/* ─── Data Transformation ────────────────────────────────── */

function buildPDFData(
  bom: BOM,
  items: BOMItem[],
  options: PDFGenerationOptions,
  costConfigName?: string
): BOMQuotePDFData {
  const summary = bom.summary;

  const pdfItems: PDFBOMItem[] = items.map((item) => {
    const totalPrice = computeItemTotalPrice(item);
    return {
      itemNumber: item.itemNumber,
      name: item.name,
      description: item.description,
      quantity: `${item.quantity} ${item.unit}`,
      type: item.itemType,
      componentType: item.component?.type,
      materialCode: item.component?.materialCode,
      materialGrade: item.component?.materialGrade,
      weight:
        item.calculatedProperties?.totalWeight != null
          ? `${item.calculatedProperties.totalWeight} kg`
          : undefined,
      totalPrice: totalPrice ? formatCurrency(totalPrice) : undefined,
      materialCost: item.cost?.totalMaterialCost
        ? formatCurrency(item.cost.totalMaterialCost)
        : undefined,
      fabricationCost: item.cost?.totalFabricationCost
        ? formatCurrency(item.cost.totalFabricationCost)
        : undefined,
      serviceCost: item.cost?.totalServiceCost
        ? formatCurrency(item.cost.totalServiceCost)
        : undefined,
      level: item.level,
      isSubItem: item.level > 0,
    };
  });

  return {
    quoteNumber: options.quoteNumber || `Q-${Date.now()}`,
    quoteDate: formatTimestamp(options.quoteDate),
    validUntil: formatTimestamp(options.validUntil),
    preparedBy: options.preparedBy || 'Vapour Toolbox',
    generatedAt: new Date().toLocaleString('en-IN'),

    company: {
      name: options.companyName || 'Your Company Name',
      address: options.companyAddress,
      phone: options.companyPhone,
      email: options.companyEmail,
      website: options.companyWebsite,
      logoUrl: options.companyLogoUrl,
      gstin: options.companyGSTIN,
      pan: options.companyPAN,
    },

    customer: {
      name: options.customerName || 'Customer Name',
      address: options.customerAddress,
      attention: options.customerAttention,
      email: options.customerEmail,
      phone: options.customerPhone,
    },

    bom: {
      bomCode: bom.bomCode,
      name: bom.name,
      description: bom.description,
      category: bom.category,
      projectName: bom.projectName,
    },

    items: pdfItems,

    summary: {
      totalWeight: `${summary.totalWeight} kg`,
      itemCount: summary.itemCount,
      totalMaterialCost: formatCurrency(summary.totalMaterialCost),
      totalFabricationCost: formatCurrency(summary.totalFabricationCost),
      totalServiceCost: formatCurrency(summary.totalServiceCost),
      totalDirectCost: formatCurrency(summary.totalDirectCost),
      overhead: formatCurrency(summary.overhead),
      contingency: formatCurrency(summary.contingency),
      profit: formatCurrency(summary.profit),
      totalCost: formatCurrency(summary.totalCost),
      currency: summary.currency,
      costConfigName,
    },

    showCostBreakdown: options.showCostBreakdown !== false,
    showIndirectCosts: options.showIndirectCosts !== false,
    showItemDetails: options.showItemDetails !== false,
    showMaterialCodes: options.showMaterialCodes !== false,
    showServices: options.showServices !== false,

    customNotes: options.customNotes,
    termsAndConditions: options.customTerms || DEFAULT_TERMS_AND_CONDITIONS,
    paymentTerms: options.paymentTerms || DEFAULT_PAYMENT_TERMS,
    deliveryTerms: options.deliveryTerms || DEFAULT_DELIVERY_TERMS,
    watermark: options.watermark,
  };
}
