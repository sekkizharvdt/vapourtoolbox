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
import { formatDate, formatCurrencyCode } from '@/lib/utils/formatters';
import { amountToWords } from '@/lib/utils/currency';

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
  totalInWords: {
    marginTop: 4,
    fontSize: 9,
    fontStyle: 'italic',
    color: REPORT_THEME.textSecondary,
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

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || !ts.toDate) return '—';
  // Shared DD-MMM-YYYY formatter — feedback dZQaZCkO172rq3dSrWoK.
  return formatDate(ts as { toDate: () => Date });
}

/** Standard VDT special instructions per procurement review #33. */
const DEFAULT_SPECIAL_INSTRUCTIONS = [
  'The payment process will take one week from the date of receipt of the proforma invoice / invoice.',
  'Please return the duplicate copy of the PO duly signed as a token of your acceptance.',
  'Our GST number and PO number must be clearly mentioned on your invoice and all reports.',
  'The price shall remain firm until full completion of this order.',
  'TDS shall be deducted, if applicable.',
  'HSN Code should be mentioned in the Tax Invoice.',
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

  // Service terms / safety blocks render only when populated (a Service Order
  // is just a PO carrying service lines + these terms).
  const serviceTerms = po.commercialTerms?.serviceTerms;
  const hasServiceTerms =
    !!serviceTerms && Object.values(serviceTerms).some((v) => v !== undefined && v !== '');
  const safety = po.commercialTerms?.safetyCompliance;
  const hasSafety =
    !!safety &&
    (!!safety.safetyRequired ||
      !!safety.ppeRequired ||
      !!safety.workPermitRequired ||
      !!safety.insuranceRequired);

  // Scope-of-work rows, each omitted when its section is marked Not Required
  // (feedback iZqGG). Undefined/true => shown (back-compat).
  const ct = po.commercialTerms;
  const scopeRows: Array<{ label: string; value: string }> = [];
  if (ct) {
    if (ct.freightRequired !== false) {
      scopeRows.push({
        label: 'Freight',
        value:
          (ct.freightScope === 'VENDOR' ? "Vendor's scope" : "Buyer's scope") +
          (ct.freightScope === 'CUSTOMER' && ct.freightPaymentType
            ? ` — ${ct.freightPaymentType === 'PREPAID' ? 'Prepaid' : 'To-Pay'}`
            : ''),
      });
    }
    if (ct.transportRequired !== false) {
      scopeRows.push({
        label: 'Transport',
        value:
          (ct.transportScope === 'VENDOR' ? "Vendor's scope" : "Buyer's scope") +
          (ct.deliveryType ? ` — ${ct.deliveryType === 'DOOR' ? 'Door' : 'Godown'} delivery` : '') +
          (ct.transporterName ? ` (${ct.transporterName})` : ''),
      });
    }
    if (ct.transitInsuranceRequired !== false) {
      scopeRows.push({
        label: 'Transit Insurance',
        value: ct.transitInsuranceScope === 'VENDOR' ? "Vendor's scope" : "Buyer's scope",
      });
      if (ct.transitInsuranceInstruction) {
        scopeRows.push({
          label: 'Transit Insurance Note',
          value: ct.transitInsuranceInstruction,
        });
      }
    }
    if (ct.erectionRequired !== false) {
      scopeRows.push({
        label: 'Erection & Commissioning',
        value:
          ct.erectionScope === 'VENDOR'
            ? "Vendor's scope" +
              (() => {
                const inc = [
                  ct.erectionIncludesTransport && 'transportation',
                  ct.erectionIncludesFood && 'food',
                  ct.erectionIncludesAccommodation && 'accommodation',
                ].filter(Boolean);
                return inc.length > 0 ? ` (incl. ${inc.join(', ')})` : '';
              })()
            : ct.erectionScope === 'NA'
              ? 'Not in scope'
              : ct.erectionCustomText || 'Custom',
      });
    }
  }

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
          <KeyValueTable rows={orderDetails} labelWidth="30%" valueWidth="70%" valueAlign="left" />
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
              valueAlign="left"
            />
          </ReportSection>
        )}

        {/* Line Items */}
        <ReportSection title="Line Items">
          <ReportTable
            columns={[
              { key: 'sno', header: '#', width: '5%' },
              { key: 'description', header: 'Description', width: '26%' },
              { key: 'specification', header: 'Specification', width: '11%' },
              { key: 'hsnSac', header: 'HSN/SAC', width: '9%' },
              { key: 'qty', header: 'Qty', width: '7%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '8%' },
              { key: 'rate', header: 'Unit Price', width: '12%', align: 'right' },
              { key: 'gst', header: 'GST %', width: '8%', align: 'right' },
              { key: 'amount', header: 'Amount', width: '14%', align: 'right' },
            ]}
            rows={sortedItems.map((item) => ({
              sno: item.lineNumber,
              description: item.description,
              specification: item.specification || '—',
              hsnSac: item.hsnSacCode || '—',
              qty: item.quantity,
              unit: item.unit,
              rate: formatCurrencyCode(item.unitPrice, po.currency),
              gst: `${item.gstRate}%`,
              amount: formatCurrencyCode(item.amount, po.currency),
            }))}
            fontSize={9}
          />
        </ReportSection>

        {/* Financial Summary */}
        <ReportSection title="Financial Summary">
          <View style={local.summaryRow}>
            <Text style={local.summaryLabel}>Subtotal:</Text>
            <Text style={local.summaryValue}>{formatCurrencyCode(po.subtotal, po.currency)}</Text>
          </View>
          {po.discount !== undefined && po.discount > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>Discount:</Text>
              <Text style={local.summaryValue}>
                {`- ${formatCurrencyCode(po.discount, po.currency)}`}
              </Text>
            </View>
          )}
          {po.packingForwardingAmount !== undefined && po.packingForwardingAmount > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>Packing &amp; Forwarding:</Text>
              <Text style={local.summaryValue}>
                {`+ ${formatCurrencyCode(po.packingForwardingAmount, po.currency)}`}
              </Text>
            </View>
          )}
          {po.cgst > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>CGST:</Text>
              <Text style={local.summaryValue}>{formatCurrencyCode(po.cgst, po.currency)}</Text>
            </View>
          )}
          {po.sgst > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>SGST:</Text>
              <Text style={local.summaryValue}>{formatCurrencyCode(po.sgst, po.currency)}</Text>
            </View>
          )}
          {po.igst > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>IGST:</Text>
              <Text style={local.summaryValue}>{formatCurrencyCode(po.igst, po.currency)}</Text>
            </View>
          )}
          {po.totalTax > 0 && (
            <View style={local.summaryRow}>
              <Text style={local.summaryLabel}>Total Tax:</Text>
              <Text style={local.summaryValue}>{formatCurrencyCode(po.totalTax, po.currency)}</Text>
            </View>
          )}
          <View style={local.summaryTotal}>
            <Text style={local.totalLabel}>Grand Total:</Text>
            <Text style={local.totalValue}>{formatCurrencyCode(po.grandTotal, po.currency)}</Text>
          </View>
          <Text style={local.totalInWords}>
            {`(In words: ${amountToWords(po.grandTotal, po.currency)})`}
          </Text>
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
                        (po.commercialTerms.priceBasis === 'FOR_SITE'
                          ? 'FOR Site'
                          : po.commercialTerms.priceBasis === 'EX_WORKS'
                            ? 'Ex-Works'
                            : 'FOR Destination') +
                        (po.commercialTerms.priceBasis === 'EX_WORKS' &&
                        po.commercialTerms.priceBasisLocation
                          ? ` (${po.commercialTerms.priceBasisLocation})`
                          : ''),
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
              ...(po.commercialTerms
                ? [
                    {
                      label: 'Packing & Forwarding',
                      value: po.commercialTerms.packingForwardingIncluded
                        ? 'Included in price'
                        : po.commercialTerms.pfChargeType === 'PERCENTAGE'
                          ? `Extra — ${po.commercialTerms.pfChargeValue}% of basic amount`
                          : po.commercialTerms.pfChargeType === 'LUMPSUM'
                            ? `Extra — Lump sum ${formatCurrencyCode(po.commercialTerms.pfChargeValue ?? 0, po.currency)}`
                            : 'Not included',
                    },
                  ]
                : []),
              ...(po.commercialTerms?.deliverySchedule
                ? [{ label: 'Delivery Schedule', value: po.commercialTerms.deliverySchedule }]
                : []),
              ...(po.expectedDeliveryDate
                ? [{ label: 'Expected Delivery', value: formatTimestamp(po.expectedDeliveryDate) }]
                : []),
            ]}
            labelWidth="30%"
            valueWidth="70%"
            valueAlign="left"
          />
        </ReportSection>

        {/* Payment Schedule — per-milestone tax mode (feedback kPmvFXbiYDMrtyZK5VEn);
            the flat "Payment Terms" row above stays as a quick-glance summary. */}
        {po.commercialTerms && po.commercialTerms.paymentSchedule.length > 0 && (
          <ReportSection title="Payment Schedule">
            <ReportTable
              columns={[
                { key: 'sno', header: 'S.No', width: '8%' },
                { key: 'type', header: 'Payment Type', width: '22%' },
                { key: 'percent', header: '%', width: '10%', align: 'right' },
                { key: 'tax', header: 'Tax', width: '18%' },
                { key: 'deliverables', header: 'Deliverables', width: '42%' },
              ]}
              rows={po.commercialTerms.paymentSchedule.map((m) => ({
                sno: m.serialNumber,
                type: m.paymentType,
                percent: `${m.percentage}%`,
                tax: m.carriesTax ? '+ 100% tax' : '—',
                deliverables: m.deliverables,
              }))}
              fontSize={9}
            />
          </ReportSection>
        )}

        {/* Service Terms — only when the PO covers service line items. */}
        {hasServiceTerms && serviceTerms && (
          <ReportSection title="Service Terms">
            <KeyValueTable
              rows={[
                ...(serviceTerms.scopeOfWork
                  ? [{ label: 'Scope of Work', value: serviceTerms.scopeOfWork }]
                  : []),
                ...(serviceTerms.deliverables
                  ? [{ label: 'Deliverables', value: serviceTerms.deliverables }]
                  : []),
                ...(serviceTerms.completionPeriod
                  ? [
                      {
                        label: 'Completion Period',
                        value: `${serviceTerms.completionPeriod} ${(
                          serviceTerms.completionPeriodUnit ?? 'DAYS'
                        ).toLowerCase()}`,
                      },
                    ]
                  : []),
                ...(serviceTerms.serviceLocation
                  ? [{ label: 'Service Location', value: serviceTerms.serviceLocation }]
                  : []),
                ...(serviceTerms.acceptanceCriteria
                  ? [{ label: 'Acceptance Criteria', value: serviceTerms.acceptanceCriteria }]
                  : []),
                ...(serviceTerms.exclusions
                  ? [{ label: 'Exclusions', value: serviceTerms.exclusions }]
                  : []),
              ]}
              labelWidth="30%"
              valueWidth="70%"
              valueAlign="left"
            />
          </ReportSection>
        )}

        {/* Safety & Compliance — only the requirements that are switched on. */}
        {hasSafety && safety && (
          <ReportSection title="Safety &amp; Compliance">
            <KeyValueTable
              rows={[
                ...(safety.safetyRequired
                  ? [{ label: 'Safety', value: safety.safetyDetails || 'Required' }]
                  : []),
                ...(safety.ppeRequired
                  ? [{ label: 'PPE', value: safety.ppeDetails || 'Required' }]
                  : []),
                ...(safety.workPermitRequired
                  ? [{ label: 'Work Permit', value: safety.workPermitDetails || 'Required' }]
                  : []),
                ...(safety.insuranceRequired
                  ? [{ label: 'Insurance', value: safety.insuranceDetails || 'Required' }]
                  : []),
              ]}
              labelWidth="30%"
              valueWidth="70%"
              valueAlign="left"
            />
          </ReportSection>
        )}

        {/* Terms & Conditions — grouped into respective sections (review 2.3).
            Billing / delivery addresses are intentionally NOT repeated here; they
            appear once in the Vendor + Addresses block above. */}

        {/* Scope of Work — each row omitted when its section is marked Not
            Required (feedback iZqGG); the whole section drops if all are off. */}
        {po.commercialTerms && scopeRows.length > 0 && (
          <ReportSection title="Scope of Work">
            <KeyValueTable rows={scopeRows} labelWidth="30%" valueWidth="70%" valueAlign="left" />
          </ReportSection>
        )}

        {/* Quality & Inspection */}
        {po.commercialTerms && (
          <ReportSection title="Quality &amp; Inspection">
            <KeyValueTable
              rows={[
                ...(po.commercialTerms.inspectionRequired === false
                  ? []
                  : [
                      {
                        label: 'Inspection',
                        value:
                          (po.commercialTerms.inspectorType === 'THIRD_PARTY'
                            ? 'Third-party inspection'
                            : po.commercialTerms.inspectorType === 'VDT'
                              ? 'VDT / VDT consultant'
                              : 'VDT consultant') +
                          (po.commercialTerms.inspectionType
                            ? ` — ${po.commercialTerms.inspectionType === 'STAGE' ? 'Stage' : 'Final'} inspection`
                            : ''),
                      },
                    ]),
                ...(po.commercialTerms.inspectionDocuments &&
                po.commercialTerms.inspectionDocuments.length > 0
                  ? [
                      {
                        label: 'Inspection Documents',
                        value: po.commercialTerms.inspectionDocuments.join(', '),
                      },
                    ]
                  : []),
                ...(po.commercialTerms.requiredDocuments.length > 0 ||
                (po.commercialTerms.otherDocuments && po.commercialTerms.otherDocuments.length > 0)
                  ? [
                      {
                        label: 'Post Order Documents',
                        value: [
                          ...po.commercialTerms.requiredDocuments.map((d) =>
                            d === 'DRAWING'
                              ? 'GA Drawing (GAD)'
                              : d === 'DATA_SHEET'
                                ? 'Data Sheet'
                                : d === 'QAP'
                                  ? 'QAP'
                                  : 'Other'
                          ),
                          ...(po.commercialTerms.otherDocuments ?? []),
                        ].join(', '),
                      },
                    ]
                  : []),
              ]}
              labelWidth="30%"
              valueWidth="70%"
              valueAlign="left"
            />
          </ReportSection>
        )}

        {/* Warranty & Penalties */}
        {(po.warrantyTerms || po.penaltyClause) && (
          <ReportSection title="Warranty &amp; Penalties">
            <KeyValueTable
              rows={[
                ...(po.warrantyTerms ? [{ label: 'Warranty', value: po.warrantyTerms }] : []),
                ...(po.penaltyClause ? [{ label: 'LD Clause', value: po.penaltyClause }] : []),
              ]}
              labelWidth="30%"
              valueWidth="70%"
              valueAlign="left"
            />
          </ReportSection>
        )}

        {/* Standard Clauses */}
        {(po.commercialTerms || (po.otherClauses && po.otherClauses.length > 0)) && (
          <ReportSection title="Standard Clauses">
            <KeyValueTable
              rows={[
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
              valueAlign="left"
            />
          </ReportSection>
        )}

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
              valueAlign="left"
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
              valueAlign="left"
            />
          </ReportSection>
        )}

        {/* Supporting Documents — filenames only. The actual files are bundled
            alongside the PDF in the PO ZIP download (no signed-URL leakage). */}
        {po.attachments && po.attachments.length > 0 && (
          <ReportSection title="Supporting Documents">
            <ReportTable
              columns={[
                { key: 'sno', header: '#', width: '8%' },
                { key: 'file', header: 'File', width: '72%' },
                { key: 'size', header: 'Size', width: '20%', align: 'right' },
              ]}
              rows={po.attachments.map((a, i) => ({
                sno: i + 1,
                file: a.fileName,
                size: formatFileSize(a.fileSize),
              }))}
              fontSize={9}
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

        <ReportFooter lines={[`Generated on ${formatDate(new Date())} | ${po.number}`]} />
      </ReportPage>
    </Document>
  );
}
