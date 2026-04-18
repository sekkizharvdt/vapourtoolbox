/**
 * Purchase Order PDF Document Template
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 * Structure:
 *  - Header with company logo + legal name
 *  - Order details (PO#, date, title, vendor offer reference)
 *  - Vendor block (full name + address) and Billing / Delivery addresses
 *  - Line items table
 *  - Financial summary
 *  - Commercial Terms (price basis, currency, payment terms, delivery)
 *  - Terms & Conditions (warranty, freight, inspection, LD, force majeure, etc.)
 *  - Special Instructions (VDT's standard clauses)
 *  - Buyer contact
 *  - Approval block
 */

import React from 'react';
import { Document, Image, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import {
  ReportPage,
  ReportSection,
  ReportTable,
  KeyValueTable,
  ReportFooter,
  NotesSection,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';

const local = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: `2pt solid ${REPORT_THEME.primary}`,
  },
  logo: {
    width: 72,
    height: 72,
    objectFit: 'contain',
  },
  companyBlock: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
  },
  companyMeta: {
    fontSize: 9,
    color: REPORT_THEME.textSecondary,
    marginTop: 2,
  },
  documentTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 8,
  },
  poNumber: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  col: {
    flex: 1,
    padding: 8,
    border: `1pt solid ${REPORT_THEME.border}`,
    borderRadius: 2,
  },
  colLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
    color: REPORT_THEME.primary,
  },
  colValue: {
    fontSize: 9,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap' as unknown as 'normal',
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
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  numberedIndex: {
    width: 18,
    fontSize: 9,
    fontWeight: 'bold',
  },
  numberedText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.4,
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

/** Standard VDT special instructions per procurement review #33. */
const DEFAULT_SPECIAL_INSTRUCTIONS = [
  'The payment process will take one week from the date of receipt of the proforma invoice / invoice.',
  'Please return the duplicate copy of the PO duly signed as a token of your acceptance.',
  'Our GST number and PO number must be clearly mentioned on your invoice and all reports.',
  'The price shall remain firm until full completion of this order.',
  'TDS shall be deducted, if applicable.',
];

export interface POPDFCompanyProfile {
  name: string;
  legalName?: string;
  address?: string; // Pre-formatted multiline address block
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface POPDFVendorProfile {
  name: string;
  address?: string; // Pre-formatted multiline address block
  contactPerson?: string;
  email?: string;
  phone?: string;
  gstin?: string;
}

export interface POPDFDocumentProps {
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  company?: POPDFCompanyProfile;
  vendor?: POPDFVendorProfile;
  logoDataUri?: string;
  specialInstructions?: string[];
  buyerContact?: { name: string; phone: string; email: string };
}

export function POPDFDocument({
  po,
  items,
  company,
  vendor,
  logoDataUri,
  specialInstructions = DEFAULT_SPECIAL_INSTRUCTIONS,
  buyerContact,
}: POPDFDocumentProps): React.JSX.Element {
  const sortedItems = [...items].sort((a, b) => a.lineNumber - b.lineNumber);

  const companyDisplayName =
    company?.legalName || company?.name || 'Vapour Desal Technologies Private Limited';

  const vendorOfferReference = po.vendorOfferNumber
    ? po.vendorOfferDate
      ? `${po.vendorOfferNumber} dated ${formatTimestamp(po.vendorOfferDate)}`
      : po.vendorOfferNumber
    : po.selectedOfferNumber;

  const orderDetails: Array<{ label: string; value: string }> = [
    { label: 'PO Number', value: po.number },
    { label: 'Date', value: formatTimestamp(po.createdAt) },
    { label: 'Status', value: po.status },
    ...(po.title ? [{ label: 'Title', value: po.title }] : []),
    { label: 'Vendor Offer Reference', value: vendorOfferReference },
  ];

  const billingAddress =
    po.commercialTerms?.billingAddress || company?.address || companyDisplayName;

  const contact =
    buyerContact ||
    (po.commercialTerms?.buyerContactName
      ? {
          name: po.commercialTerms.buyerContactName,
          phone: po.commercialTerms.buyerContactPhone || '',
          email: po.commercialTerms.buyerContactEmail || '',
        }
      : undefined);

  return (
    <Document>
      <ReportPage style={{ padding: 36, fontSize: 10 }}>
        {/* Header with logo + company block */}
        <View style={local.header}>
          {logoDataUri && (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, not HTML img
            <Image src={logoDataUri} style={local.logo} />
          )}
          <View style={local.companyBlock}>
            <Text style={local.companyName}>{companyDisplayName}</Text>
            {company?.address && <Text style={local.companyMeta}>{company.address}</Text>}
            {(company?.gstin || company?.pan) && (
              <Text style={local.companyMeta}>
                {company.gstin ? `GSTIN: ${company.gstin}` : ''}
                {company.gstin && company.pan ? ' · ' : ''}
                {company.pan ? `PAN: ${company.pan}` : ''}
              </Text>
            )}
            <Text style={local.documentTitle}>PURCHASE ORDER</Text>
            <Text style={local.poNumber}>{po.number}</Text>
          </View>
        </View>

        {/* Order Details */}
        <ReportSection title="Order Details">
          <KeyValueTable rows={orderDetails} labelWidth="30%" valueWidth="70%" />
        </ReportSection>

        {/* Vendor + Addresses (billing + delivery side-by-side) */}
        <View style={local.twoCol}>
          <View style={local.col}>
            <Text style={local.colLabel}>Vendor</Text>
            <Text style={local.colValue}>
              {(vendor?.name || po.vendorName) +
                (vendor?.address ? `\n${vendor.address}` : '') +
                (vendor?.gstin ? `\nGSTIN: ${vendor.gstin}` : '') +
                (vendor?.contactPerson ? `\nAttn: ${vendor.contactPerson}` : '') +
                (vendor?.email ? `\nEmail: ${vendor.email}` : '') +
                (vendor?.phone ? `\nPhone: ${vendor.phone}` : '')}
            </Text>
          </View>
          <View style={local.col}>
            <Text style={local.colLabel}>Billing Address</Text>
            <Text style={local.colValue}>{billingAddress}</Text>
          </View>
          <View style={local.col}>
            <Text style={local.colLabel}>Delivery Address</Text>
            <Text style={local.colValue}>{po.deliveryAddress || '—'}</Text>
          </View>
        </View>

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

      {/* Page 2: Commercial Terms, T&C, Special Instructions, Buyer contact */}
      <ReportPage style={{ padding: 36, fontSize: 10 }}>
        <View style={local.header}>
          {logoDataUri && (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, not HTML img
            <Image src={logoDataUri} style={local.logo} />
          )}
          <View style={local.companyBlock}>
            <Text style={local.companyName}>{companyDisplayName}</Text>
            <Text style={local.poNumber}>{po.number} — Terms &amp; Conditions</Text>
          </View>
        </View>

        {/* Commercial Terms */}
        <ReportSection title="Commercial Terms">
          <KeyValueTable
            rows={[
              ...(po.commercialTerms
                ? [
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
                  ]
                : []),
              ...(po.paymentTerms ? [{ label: 'Payment Terms', value: po.paymentTerms }] : []),
              ...(po.commercialTerms
                ? [
                    {
                      label: 'Delivery Period',
                      value:
                        po.commercialTerms.deliveryUnit === 'READY_STOCK'
                          ? 'Ready Stock'
                          : po.commercialTerms.deliveryUnit
                            ? `${po.commercialTerms.deliveryPeriod} ${po.commercialTerms.deliveryUnit.toLowerCase()} from ${
                                po.commercialTerms.deliveryTrigger === 'PO_DATE'
                                  ? 'PO date'
                                  : po.commercialTerms.deliveryTrigger === 'ADVANCE_PAYMENT'
                                    ? 'advance payment'
                                    : 'drawing approval'
                              }`
                            : po.commercialTerms.deliveryWeeks
                              ? `${po.commercialTerms.deliveryWeeks} weeks`
                              : '—',
                    },
                  ]
                : []),
              ...(po.expectedDeliveryDate
                ? [{ label: 'Expected Delivery', value: formatTimestamp(po.expectedDeliveryDate) }]
                : []),
            ]}
            labelWidth="30%"
            valueWidth="70%"
          />
        </ReportSection>

        {/* Terms & Conditions */}
        <ReportSection title="Terms &amp; Conditions">
          <KeyValueTable
            rows={[
              { label: 'Billing Address', value: billingAddress },
              { label: 'Delivery Address', value: po.deliveryAddress || '—' },
              ...(po.commercialTerms
                ? [
                    {
                      label: 'Freight',
                      value:
                        po.commercialTerms.freightScope === 'VENDOR'
                          ? "Vendor's scope"
                          : "Buyer's scope",
                    },
                    {
                      label: 'Transport',
                      value:
                        po.commercialTerms.transportScope === 'VENDOR'
                          ? "Vendor's scope"
                          : "Buyer's scope",
                    },
                    {
                      label: 'Transit Insurance',
                      value:
                        po.commercialTerms.transitInsuranceScope === 'VENDOR'
                          ? "Vendor's scope"
                          : "Buyer's scope",
                    },
                    {
                      label: 'Erection & Commissioning',
                      value:
                        po.commercialTerms.erectionScope === 'VENDOR'
                          ? "Vendor's scope"
                          : po.commercialTerms.erectionScope === 'NA'
                            ? 'Not in scope'
                            : po.commercialTerms.erectionCustomText || 'Custom',
                    },
                    {
                      label: 'Inspection',
                      value:
                        po.commercialTerms.inspectorType === 'THIRD_PARTY'
                          ? 'Third-party inspection'
                          : po.commercialTerms.inspectorType === 'VDT'
                            ? 'VDT / VDT consultant'
                            : 'VDT consultant',
                    },
                  ]
                : []),
              ...(po.warrantyTerms ? [{ label: 'Warranty', value: po.warrantyTerms }] : []),
              ...(po.penaltyClause ? [{ label: 'LD Clause', value: po.penaltyClause }] : []),
              ...(po.commercialTerms
                ? [
                    {
                      label: 'Force Majeure',
                      value:
                        'As per Indian Contract Act; neither party liable for delay due to events beyond reasonable control. Notify within 7 days.',
                    },
                    {
                      label: 'Rejection Clause',
                      value:
                        'Non-conforming or damaged materials may be rejected at vendor risk & cost; vendor to replace/rectify within 15 days.',
                    },
                  ]
                : []),
              ...(po.otherClauses && po.otherClauses.length > 0
                ? po.otherClauses.map((clause, i) => ({
                    label: `Other clause ${i + 1}`,
                    value: clause,
                  }))
                : []),
            ]}
            labelWidth="30%"
            valueWidth="70%"
          />
        </ReportSection>

        {/* Special Instructions */}
        {specialInstructions.length > 0 && (
          <ReportSection title="Special Instructions">
            <View>
              {specialInstructions.map((line, i) => (
                <View key={i} style={local.numberedItem}>
                  <Text style={local.numberedIndex}>{i + 1}.</Text>
                  <Text style={local.numberedText}>{line}</Text>
                </View>
              ))}
            </View>
          </ReportSection>
        )}

        {/* Buyer contact */}
        {contact && (
          <ReportSection title="For Queries">
            <KeyValueTable
              rows={[
                { label: 'Name', value: contact.name },
                ...(contact.phone ? [{ label: 'Phone', value: contact.phone }] : []),
                ...(contact.email ? [{ label: 'Email', value: contact.email }] : []),
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

        {/* Acceptance note for vendor counter-signature */}
        <NotesSection
          title="VENDOR ACCEPTANCE:"
          notes={[
            'Please acknowledge acceptance of this purchase order by returning a signed copy.',
            'Name / Designation: __________________________',
            'Signature & Seal: __________________________     Date: ______________',
          ].join('\n')}
        />

        <ReportFooter
          lines={[`Generated on ${new Date().toLocaleDateString('en-IN')} | ${po.number}`]}
        />
      </ReportPage>
    </Document>
  );
}
