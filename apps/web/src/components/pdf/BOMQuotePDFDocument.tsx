/**
 * BOM Quote PDF Document Component
 *
 * @react-pdf/renderer component for generating techno-commercial offer PDFs.
 * Replaces the previous Puppeteer + Handlebars Cloud Function approach.
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { BOMQuotePDFData, PDFBOMItem } from '@vapour/types';
import {
  ReportPage,
  ReportHeader,
  ReportTable,
  KeyValueTable,
  Watermark,
  ReportFooter,
  REPORT_THEME,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

/* ─── Local styles ───────────────────────────────────────── */

const local = StyleSheet.create({
  quoteTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 10,
    color: REPORT_THEME.primary,
  },
  customerBox: {
    backgroundColor: REPORT_THEME.tableHeaderBg,
    border: `1pt solid ${REPORT_THEME.border}`,
    borderRadius: 3,
    padding: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
    borderBottom: `1pt solid ${REPORT_THEME.border}`,
    paddingBottom: 3,
    marginBottom: 6,
  },
  bomInfoBox: {
    backgroundColor: REPORT_THEME.primaryLight,
    borderLeft: `3pt solid ${REPORT_THEME.primary}`,
    padding: 10,
    marginBottom: 12,
  },
  bomTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
    marginBottom: 4,
  },
  bomDetail: {
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
    marginBottom: 2,
  },
  summaryBox: {
    border: `2pt solid ${REPORT_THEME.primary}`,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
  },
  summaryLabel: {
    fontSize: 9,
    color: REPORT_THEME.textSecondary,
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: REPORT_THEME.text,
  },
  summarySubTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: REPORT_THEME.primary,
    padding: 8,
    borderRadius: 3,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: REPORT_THEME.white,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: REPORT_THEME.white,
  },
  numberedList: {
    marginBottom: 8,
    paddingLeft: 5,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  numberedIndex: {
    width: 18,
    fontSize: 9,
  },
  numberedText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    paddingTop: 15,
    borderTop: `1pt solid ${REPORT_THEME.border}`,
  },
  signatureBlock: {
    alignItems: 'center',
    width: '45%',
  },
  signatureLine: {
    borderTop: `1pt solid ${REPORT_THEME.text}`,
    width: '100%',
    marginTop: 50,
    paddingTop: 5,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signatureTitle: {
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  summaryMeta: {
    marginTop: 10,
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
  },
  subItem: {
    paddingLeft: 12,
  },
  badge: {
    fontSize: 6,
    padding: '1 4',
    borderRadius: 2,
    marginLeft: 4,
  },
  badgeBoughtOut: {
    backgroundColor: REPORT_THEME.primaryLight,
    color: REPORT_THEME.primary,
  },
  badgeFabricated: {
    backgroundColor: '#f3e8ff',
    color: '#6b21a8',
  },
});

/* ─── Sub-components ─────────────────────────────────────── */

function CustomerSection({ data }: { data: BOMQuotePDFData }) {
  const rows = [
    { label: 'Customer Name', value: data.customer.name },
    ...(data.customer.attention ? [{ label: 'Attention', value: data.customer.attention }] : []),
    ...(data.customer.address ? [{ label: 'Address', value: data.customer.address }] : []),
    ...(data.customer.email ? [{ label: 'Email', value: data.customer.email }] : []),
    ...(data.customer.phone ? [{ label: 'Phone', value: data.customer.phone }] : []),
  ];

  return (
    <View style={local.customerBox}>
      <Text style={local.sectionTitle}>TO</Text>
      <KeyValueTable rows={rows} />
    </View>
  );
}

function BOMInfoSection({ data }: { data: BOMQuotePDFData }) {
  return (
    <View style={local.bomInfoBox}>
      <Text style={local.bomTitle}>{data.bom.name}</Text>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Text style={local.bomDetail}>BOM Code: {data.bom.bomCode}</Text>
        <Text style={local.bomDetail}>Category: {data.bom.category}</Text>
        {data.bom.projectName && (
          <Text style={local.bomDetail}>Project: {data.bom.projectName}</Text>
        )}
      </View>
      {data.bom.description && (
        <Text style={{ fontSize: 8, marginTop: 4 }}>{data.bom.description}</Text>
      )}
    </View>
  );
}

function ItemsTable({ data }: { data: BOMQuotePDFData }) {
  const columns: TableColumn[] = [
    { key: 'itemNo', header: 'Item No.', width: '8%' },
    { key: 'desc', header: 'Description', width: data.showMaterialCodes ? '30%' : '42%' },
    { key: 'qty', header: 'Quantity', width: '12%' },
    ...(data.showMaterialCodes ? [{ key: 'material', header: 'Material', width: '15%' }] : []),
    ...(data.showItemDetails ? [{ key: 'weight', header: 'Weight', width: '10%' }] : []),
    { key: 'price', header: 'Total Price', width: '15%', align: 'right' as const },
  ];

  const rows = data.items.map((item: PDFBOMItem) => {
    const desc = item.isSubItem ? `  ${item.name}` : item.name;
    const badge =
      item.componentType === 'BOUGHT_OUT' ? ' [B]' : item.componentType === 'SHAPE' ? ' [F]' : '';
    const row: Record<string, string> = {
      itemNo: item.itemNumber,
      desc: desc + badge,
      qty: item.quantity,
      price: item.totalPrice || '',
    };
    if (data.showMaterialCodes) row.material = item.materialCode || '';
    if (data.showItemDetails) row.weight = item.weight || '';
    return row;
  });

  return (
    <View>
      <Text style={local.sectionTitle}>BILL OF MATERIALS</Text>
      <ReportTable columns={columns} rows={rows} />
    </View>
  );
}

function CostSummarySection({ data }: { data: BOMQuotePDFData }) {
  return (
    <View style={local.summaryBox} wrap={false}>
      <Text style={local.sectionTitle}>COST SUMMARY</Text>

      {data.showCostBreakdown && (
        <View>
          <Text style={local.summarySubTitle}>Direct Costs</Text>
          <SummaryRow label="Material Cost" value={data.summary.totalMaterialCost} />
          <SummaryRow label="Fabrication Cost" value={data.summary.totalFabricationCost} />
          {data.showServices && (
            <SummaryRow label="Service Cost" value={data.summary.totalServiceCost} />
          )}
          <View style={[local.summaryRow, { backgroundColor: REPORT_THEME.tableHeaderBg }]}>
            <Text style={[local.summaryLabel, { fontWeight: 'bold' }]}>Total Direct Cost</Text>
            <Text style={local.summaryValue}>{data.summary.totalDirectCost}</Text>
          </View>
        </View>
      )}

      {data.showIndirectCosts && (
        <View>
          <Text style={local.summarySubTitle}>Indirect Costs</Text>
          <SummaryRow label="Overhead" value={data.summary.overhead} />
          <SummaryRow label="Contingency" value={data.summary.contingency} />
          <SummaryRow label="Profit" value={data.summary.profit} />
        </View>
      )}

      <View style={local.totalRow}>
        <Text style={local.totalLabel}>TOTAL QUOTED PRICE</Text>
        <Text style={local.totalValue}>{data.summary.totalCost}</Text>
      </View>

      <View style={local.summaryMeta}>
        <Text>Total Weight: {data.summary.totalWeight}</Text>
        <Text>Number of Items: {data.summary.itemCount}</Text>
        <Text>Currency: {data.summary.currency}</Text>
        {data.summary.costConfigName && (
          <Text>Cost Configuration: {data.summary.costConfigName}</Text>
        )}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={local.summaryRow}>
      <Text style={local.summaryLabel}>{label}</Text>
      <Text style={local.summaryValue}>{value}</Text>
    </View>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <View style={local.numberedList}>
      {items.map((item, i) => (
        <View key={i} style={local.numberedItem}>
          <Text style={local.numberedIndex}>{i + 1}.</Text>
          <Text style={local.numberedText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function TermsSection({ data }: { data: BOMQuotePDFData }) {
  return (
    <View wrap={false}>
      {data.customNotes && (
        <View style={{ marginBottom: 8 }}>
          <Text style={local.sectionTitle}>ADDITIONAL NOTES</Text>
          <Text style={{ fontSize: 9 }}>{data.customNotes}</Text>
        </View>
      )}

      {data.termsAndConditions && data.termsAndConditions.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={local.sectionTitle}>TERMS &amp; CONDITIONS</Text>
          <NumberedList items={data.termsAndConditions} />
        </View>
      )}

      {data.paymentTerms && data.paymentTerms.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={local.sectionTitle}>PAYMENT TERMS</Text>
          <NumberedList items={data.paymentTerms} />
        </View>
      )}

      {data.deliveryTerms && data.deliveryTerms.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={local.sectionTitle}>DELIVERY TERMS</Text>
          <NumberedList items={data.deliveryTerms} />
        </View>
      )}
    </View>
  );
}

function SignatureSection({ data }: { data: BOMQuotePDFData }) {
  return (
    <View style={local.footer} wrap={false}>
      <View style={local.signatureBlock}>
        <View style={local.signatureLine}>
          <Text style={local.signatureName}>{data.company.name}</Text>
          <Text style={local.signatureTitle}>Authorized Signatory</Text>
        </View>
      </View>
      <View style={local.signatureBlock}>
        <View style={local.signatureLine}>
          <Text style={local.signatureName}>{data.customer.name}</Text>
          <Text style={local.signatureTitle}>Customer Acceptance</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Main Document ──────────────────────────────────────── */

interface BOMQuotePDFDocumentProps {
  data: BOMQuotePDFData;
}

export function BOMQuotePDFDocument({ data }: BOMQuotePDFDocumentProps) {
  const subtitle = [
    `Quote #${data.quoteNumber}`,
    `Date: ${data.quoteDate}`,
    `Valid Until: ${data.validUntil}`,
  ].join('  |  ');

  return (
    <Document>
      <ReportPage>
        {data.watermark && <Watermark text={data.watermark} />}

        <ReportHeader
          title="TECHNO-COMMERCIAL OFFER"
          subtitle={subtitle}
          logoDataUri={data.company.logoUrl}
        />

        <Text style={local.quoteTitle}>{data.company.name}</Text>

        <CustomerSection data={data} />
        <BOMInfoSection data={data} />
        <ItemsTable data={data} />
        <CostSummarySection data={data} />
        <TermsSection data={data} />
        <SignatureSection data={data} />

        <ReportFooter
          lines={[
            `Generated on ${data.generatedAt} | Prepared by ${data.preparedBy}`,
            'This is a computer-generated quotation and does not require a physical signature for validity.',
          ]}
        />
      </ReportPage>
    </Document>
  );
}
