/**
 * Purchase Order PDF Document Template
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 * Includes: header, vendor info, line items table, financial summary, terms.
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import {
  ReportPage,
  ReportSection,
  ReportTable,
  KeyValueTable,
  ReportFooter,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';

const local = StyleSheet.create({
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: `2pt solid ${REPORT_THEME.primary}`,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
    marginBottom: 5,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
  },
  poNumber: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 3,
  },
  summaryLabel: {
    width: '30%',
    textAlign: 'right',
    paddingRight: 10,
    fontWeight: 'bold',
  },
  summaryValue: {
    width: '20%',
    textAlign: 'right',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    borderTop: '1pt solid #333',
    marginTop: 2,
  },
  totalLabel: {
    width: '30%',
    textAlign: 'right',
    paddingRight: 10,
    fontWeight: 'bold',
    fontSize: 11,
  },
  totalValue: {
    width: '20%',
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 11,
  },
  termsItem: {
    marginBottom: 6,
  },
  termsLabel: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  termsValue: {
    color: REPORT_THEME.text,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
  },
  value: {
    width: '70%',
  },
});

function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatTimestamp(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || !ts.toDate) return '—';
  return ts.toDate().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface POPDFDocumentProps {
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  companyName?: string;
}

export function POPDFDocument({
  po,
  items,
  companyName = 'Vapour Desalination Pvt. Ltd.',
}: POPDFDocumentProps): React.JSX.Element {
  const sortedItems = [...items].sort((a, b) => a.lineNumber - b.lineNumber);

  const orderDetails = [
    { label: 'PO Number', value: po.number },
    { label: 'Date', value: formatTimestamp(po.createdAt) },
    { label: 'Status', value: po.status },
    ...(po.title ? [{ label: 'Title', value: po.title }] : []),
    ...(po.description ? [{ label: 'Description', value: po.description }] : []),
  ];

  return (
    <Document>
      <ReportPage style={{ padding: 40, fontSize: 10 }}>
        {/* Header */}
        <View style={local.header}>
          <Text style={local.companyName}>{companyName}</Text>
          <Text style={local.documentTitle}>PURCHASE ORDER</Text>
          <Text style={local.poNumber}>{po.number}</Text>
        </View>

        {/* PO Details */}
        <ReportSection title="Order Details">
          <KeyValueTable rows={orderDetails} labelWidth="30%" valueWidth="70%" />
        </ReportSection>

        {/* Vendor Info */}
        <ReportSection title="Vendor">
          <KeyValueTable
            rows={[{ label: 'Vendor Name', value: po.vendorName }]}
            labelWidth="30%"
            valueWidth="70%"
          />
        </ReportSection>

        {/* Project Info */}
        {po.projectNames.length > 0 && (
          <ReportSection title="Projects">
            <KeyValueTable
              rows={[{ label: 'Project(s)', value: po.projectNames.join(', ') }]}
              labelWidth="30%"
              valueWidth="70%"
            />
          </ReportSection>
        )}

        {/* Line Items */}
        <ReportSection title="Line Items">
          <ReportTable
            columns={[
              { key: 'sno', header: '#', width: '6%' },
              { key: 'description', header: 'Description', width: '30%' },
              { key: 'specification', header: 'Specification', width: '14%' },
              { key: 'qty', header: 'Qty', width: '8%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '8%' },
              { key: 'rate', header: 'Unit Price', width: '12%', align: 'right' },
              { key: 'gst', header: 'GST %', width: '8%', align: 'right' },
              { key: 'amount', header: 'Amount', width: '14%', align: 'right' },
            ]}
            rows={sortedItems.map((item) => ({
              sno: item.lineNumber,
              description: item.description,
              specification: item.specification || '—',
              qty: item.quantity,
              unit: item.unit,
              rate: formatCurrency(item.unitPrice, po.currency),
              gst: `${item.gstRate}%`,
              amount: formatCurrency(item.amount, po.currency),
            }))}
            fontSize={9}
          />
        </ReportSection>

        {/* Financial Summary */}
        <ReportSection title="Financial Summary">
          <View style={local.summaryRow}>
            <Text style={local.summaryLabel}>Subtotal:</Text>
            <Text style={local.summaryValue}>{formatCurrency(po.subtotal, po.currency)}</Text>
          </View>
          {po.cgst > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>CGST:</Text>
              <Text style={local.summaryValue}>{formatCurrency(po.cgst, po.currency)}</Text>
            </View>
          )}
          {po.sgst > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>SGST:</Text>
              <Text style={local.summaryValue}>{formatCurrency(po.sgst, po.currency)}</Text>
            </View>
          )}
          {po.igst > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>IGST:</Text>
              <Text style={local.summaryValue}>{formatCurrency(po.igst, po.currency)}</Text>
            </View>
          )}
          {po.totalTax > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>Total Tax:</Text>
              <Text style={local.summaryValue}>{formatCurrency(po.totalTax, po.currency)}</Text>
            </View>
          )}
          <View style={local.summaryTotal}>
            <Text style={local.totalLabel}>Grand Total:</Text>
            <Text style={local.totalValue}>{formatCurrency(po.grandTotal, po.currency)}</Text>
          </View>
        </ReportSection>
      </ReportPage>

      {/* Page 2: Terms & Conditions */}
      <ReportPage style={{ padding: 40, fontSize: 10 }}>
        <View style={local.header}>
          <Text style={local.companyName}>{companyName}</Text>
          <Text style={local.poNumber}>{po.number} — Terms &amp; Conditions</Text>
        </View>

        <ReportSection title="Terms &amp; Conditions">
          {po.paymentTerms && (
            <View style={local.termsItem}>
              <Text style={local.termsLabel}>Payment Terms:</Text>
              <Text style={local.termsValue}>{po.paymentTerms}</Text>
            </View>
          )}
          {po.deliveryTerms && (
            <View style={local.termsItem}>
              <Text style={local.termsLabel}>Delivery Terms:</Text>
              <Text style={local.termsValue}>{po.deliveryTerms}</Text>
            </View>
          )}
          {po.deliveryAddress && (
            <View style={local.termsItem}>
              <Text style={local.termsLabel}>Delivery Address:</Text>
              <Text style={local.termsValue}>{po.deliveryAddress}</Text>
            </View>
          )}
          {po.expectedDeliveryDate && (
            <View style={local.termsItem}>
              <Text style={local.termsLabel}>Expected Delivery:</Text>
              <Text style={local.termsValue}>{formatTimestamp(po.expectedDeliveryDate)}</Text>
            </View>
          )}
          {po.warrantyTerms && (
            <View style={local.termsItem}>
              <Text style={local.termsLabel}>Warranty:</Text>
              <Text style={local.termsValue}>{po.warrantyTerms}</Text>
            </View>
          )}
          {po.penaltyClause && (
            <View style={local.termsItem}>
              <Text style={local.termsLabel}>Penalty Clause:</Text>
              <Text style={local.termsValue}>{po.penaltyClause}</Text>
            </View>
          )}
          {po.otherClauses && po.otherClauses.length > 0 && (
            <View style={local.termsItem}>
              <Text style={local.termsLabel}>Other Clauses:</Text>
              {po.otherClauses.map((clause, i) => (
                <Text key={i} style={local.termsValue}>
                  {i + 1}. {clause}
                </Text>
              ))}
            </View>
          )}
        </ReportSection>

        {/* Commercial Terms */}
        {po.commercialTerms && (
          <ReportSection title="Commercial Terms">
            <KeyValueTable
              rows={[
                {
                  label: 'Price Basis',
                  value:
                    po.commercialTerms.priceBasis === 'FOR_SITE'
                      ? 'FOR Site'
                      : po.commercialTerms.priceBasis === 'EX_WORKS'
                        ? 'Ex-Works'
                        : 'FOR Destination',
                },
                { label: 'Currency', value: po.commercialTerms.currency },
                {
                  label: 'Delivery',
                  value:
                    po.commercialTerms.deliveryUnit === 'READY_STOCK'
                      ? 'Ready Stock'
                      : po.commercialTerms.deliveryUnit
                        ? `${po.commercialTerms.deliveryPeriod} ${po.commercialTerms.deliveryUnit.toLowerCase()} from ${po.commercialTerms.deliveryTrigger === 'PO_DATE' ? 'PO date' : po.commercialTerms.deliveryTrigger === 'ADVANCE_PAYMENT' ? 'advance payment' : 'drawing approval'}`
                        : po.commercialTerms.deliveryWeeks
                          ? `${po.commercialTerms.deliveryWeeks} weeks`
                          : '—',
                },
                {
                  label: 'Freight',
                  value: po.commercialTerms.freightScope === 'VENDOR' ? 'Vendor' : 'Buyer',
                },
                {
                  label: 'Warranty',
                  value: `${po.commercialTerms.warrantyMonthsFromSupply} months from supply / ${po.commercialTerms.warrantyMonthsFromCommissioning} months from commissioning`,
                },
                {
                  label: 'LD',
                  value: `${po.commercialTerms.ldPerWeekPercent}% per week, max ${po.commercialTerms.ldMaxPercent}%`,
                },
              ]}
              labelWidth="30%"
              valueWidth="70%"
            />
          </ReportSection>
        )}

        {/* Approval Info */}
        {po.approvedByName && (
          <ReportSection title="Approval">
            <KeyValueTable
              rows={[
                { label: 'Approved By', value: po.approvedByName },
                ...(po.approvedAt
                  ? [{ label: 'Approved On', value: formatTimestamp(po.approvedAt) }]
                  : []),
                ...(po.approvalComments ? [{ label: 'Comments', value: po.approvalComments }] : []),
              ]}
              labelWidth="30%"
              valueWidth="70%"
            />
          </ReportSection>
        )}

        <ReportFooter
          lines={[`Generated on ${new Date().toLocaleDateString('en-IN')} | ${po.number}`]}
        />
      </ReportPage>
    </Document>
  );
}
