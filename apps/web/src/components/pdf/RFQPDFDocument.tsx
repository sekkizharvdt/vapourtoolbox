/**
 * RFQ PDF Document Component
 *
 * @react-pdf/renderer component for generating RFQ PDFs.
 * Replaces the previous Puppeteer + Handlebars HTML template approach.
 *
 * Supports:
 * - Individual PDFs per vendor
 * - Combined PDF for all vendors
 * - Company logo, terms, watermark
 * - Items table with specs
 * - Vendor response form
 * - Supporting documents list
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { RFQPDFData } from '@vapour/types';
import {
  ReportPage,
  ReportHeader,
  ReportTable,
  KeyValueTable,
  MetadataRow,
  NotesSection,
  Watermark,
  ReportFooter,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';

/* ─── Local styles ───────────────────────────────────────── */

const local = StyleSheet.create({
  mainTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    textDecoration: 'underline',
    marginTop: 10,
    marginBottom: 10,
  },
  deadlineBox: {
    border: `1pt solid ${REPORT_THEME.text}`,
    padding: 8,
    marginBottom: 10,
  },
  deadlineTitle: {
    fontWeight: 'bold',
    marginBottom: 3,
    fontSize: 10,
  },
  deadlineText: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textDecoration: 'underline',
    marginTop: 12,
    marginBottom: 6,
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
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bulletDot: {
    width: 12,
    fontSize: 9,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.5,
  },
  emptyCell: {
    height: 16,
  },
  attachmentHint: {
    fontSize: 8,
    fontStyle: 'italic',
    color: REPORT_THEME.textSecondary,
    marginBottom: 4,
  },
  attachmentList: {
    border: `1pt solid ${REPORT_THEME.border}`,
    marginBottom: 8,
  },
  attachmentHeaderRow: {
    flexDirection: 'row',
    backgroundColor: REPORT_THEME.tableHeaderBg,
    borderBottom: `1pt solid ${REPORT_THEME.border}`,
  },
  attachmentRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
  },
  attachmentCell: {
    padding: 4,
    fontSize: 8,
  },
  attachmentHeader: {
    fontWeight: 'bold',
    fontSize: 8,
  },
});

/* ─── Component ──────────────────────────────────────────── */

interface RFQPDFDocumentProps {
  data: RFQPDFData;
  logoDataUri?: string;
}

export function RFQPDFDocument({ data, logoDataUri }: RFQPDFDocumentProps) {
  const {
    rfqNumber,
    issueDate,
    dueDate,
    validityPeriod,
    company,
    vendor,
    vendors,
    rfq,
    items,
    generalTerms,
    paymentTerms,
    deliveryTerms,
    warrantyTerms,
    contact,
    customNotes,
    watermark,
    isIndividualVendor,
  } = data;

  // Build spec string for an item (specification + technicalSpec + makeModel)
  const buildSpecString = (item: RFQPDFData['items'][0]): string => {
    const parts: string[] = [];
    if (item.specification) parts.push(item.specification);
    if (item.technicalSpec) parts.push(item.technicalSpec);
    if (item.makeModel) parts.push(`Make/Model: ${item.makeModel}`);
    return parts.join('\n');
  };

  return (
    <Document>
      <ReportPage>
        {watermark && <Watermark text={watermark} />}

        {/* Header with logo + company info */}
        <ReportHeader
          title="REQUEST FOR QUOTATION (RFQ)"
          subtitle={company.name}
          logoDataUri={logoDataUri}
        />

        {/* Company details under header */}
        {(company.address || company.gstin) && (
          <View style={{ marginTop: -8, marginBottom: 8 }}>
            {company.address && (
              <Text style={{ fontSize: 8, color: REPORT_THEME.textSecondary, textAlign: 'center' }}>
                {company.address}
              </Text>
            )}
            {company.gstin && (
              <Text style={{ fontSize: 8, color: REPORT_THEME.textSecondary, textAlign: 'center' }}>
                GSTIN: {company.gstin}
              </Text>
            )}
          </View>
        )}

        {/* RFQ Metadata */}
        <MetadataRow
          items={[
            { label: 'RFQ No', value: rfqNumber },
            { label: 'Issue Date', value: issueDate },
            { label: 'Due Date', value: dueDate },
            { label: 'Quote Validity', value: validityPeriod || '30 Days' },
          ]}
        />

        {/* Vendor Section */}
        <Text style={local.sectionTitle}>TO</Text>
        {isIndividualVendor && vendor ? (
          <KeyValueTable
            labelWidth="25%"
            valueWidth="75%"
            rows={[
              { label: 'Vendor Name', value: vendor.name },
              ...(vendor.contactPerson
                ? [{ label: 'Contact Person', value: vendor.contactPerson }]
                : []),
              ...(vendor.email ? [{ label: 'Email', value: vendor.email }] : []),
              ...(vendor.address ? [{ label: 'Address', value: vendor.address }] : []),
            ]}
          />
        ) : vendors && vendors.length > 0 ? (
          <ReportTable
            columns={[
              { key: 'label', header: '', width: '25%' },
              { key: 'vendor', header: '', width: '75%' },
            ]}
            rows={vendors.map((v, i) => ({
              label: i === 0 ? 'Vendors' : '',
              vendor: `${v.name}${v.email ? ` (${v.email})` : ''}`,
            }))}
          />
        ) : null}

        {/* RFQ Details */}
        <KeyValueTable
          labelWidth="20%"
          valueWidth="80%"
          rows={[
            { label: 'RFQ Title', value: rfq.title },
            ...(rfq.projectNames.length > 0
              ? [{ label: 'Project', value: rfq.projectNames.join(', ') }]
              : []),
            ...(rfq.purchaseRequestNumbers.length > 0
              ? [{ label: 'PR No', value: rfq.purchaseRequestNumbers.join(', ') }]
              : []),
          ]}
        />

        {/* Submission Deadline */}
        <View style={local.deadlineBox}>
          <Text style={local.deadlineTitle}>SUBMISSION DEADLINE</Text>
          <Text style={local.deadlineText}>
            Please submit your quotation by {dueDate}. Late submissions may not be considered. All
            prices should be valid for a minimum period as specified in the terms below.
          </Text>
        </View>

        {/* Items Required */}
        <Text style={local.sectionTitle}>ITEMS REQUIRED</Text>
        <ReportTable
          fontSize={8}
          columns={[
            { key: 'sno', header: 'S.No', width: '6%', align: 'center' },
            { key: 'description', header: 'Description', width: '28%' },
            { key: 'specification', header: 'Specification', width: '24%' },
            { key: 'qty', header: 'Qty', width: '8%', align: 'center' },
            { key: 'unit', header: 'Unit', width: '8%', align: 'center' },
            { key: 'unitPrice', header: 'Unit Price', width: '13%', align: 'right' },
            { key: 'totalPrice', header: 'Total Price', width: '13%', align: 'right' },
          ]}
          rows={items.map((item) => ({
            sno: item.lineNumber,
            description: item.description,
            specification: buildSpecString(item),
            qty: item.quantity,
            unit: item.unit,
            unitPrice: '',
            totalPrice: '',
          }))}
        />

        {/* Commercial Terms */}
        <Text style={local.sectionTitle}>COMMERCIAL TERMS</Text>
        <KeyValueTable
          labelWidth="25%"
          valueWidth="75%"
          rows={[
            {
              label: 'Payment Terms',
              value: paymentTerms?.join('; ') || 'As per the vendor',
            },
            {
              label: 'Delivery Terms',
              value: deliveryTerms?.join('; ') || 'As per the vendor',
            },
            {
              label: 'Warranty',
              value: warrantyTerms?.join('; ') || 'As applicable / NA',
            },
          ]}
        />

        {/* Quotation Requirements */}
        <Text style={local.sectionTitle}>QUOTATION REQUIREMENTS</Text>
        <View style={local.numberedList}>
          {[
            'Quote unit price and total price for each line item',
            'Specify delivery period / lead time for each item',
            'Mention any deviations from specifications clearly, if any',
            'Prices to be inclusive of all applicable taxes (GST)',
            `Quotation validity minimum ${validityPeriod || '30 days'}`,
            'Attach relevant certificates, test reports and technical documents where applicable',
          ].map((req, i) => (
            <View key={i} style={local.bulletItem}>
              <Text style={local.bulletDot}>{'\u2022'}</Text>
              <Text style={local.bulletText}>{req}</Text>
            </View>
          ))}
        </View>

        {/* General Terms & Conditions */}
        <Text style={local.sectionTitle}>GENERAL TERMS & CONDITIONS</Text>
        <View style={local.numberedList}>
          {(
            generalTerms || [
              'All specifications mentioned are minimum requirements.',
              'Vendor must provide detailed technical specifications.',
              'Prices shall include all applicable taxes unless stated otherwise.',
            ]
          ).map((term, i) => (
            <View key={i} style={local.numberedItem}>
              <Text style={local.numberedIndex}>{i + 1}.</Text>
              <Text style={local.numberedText}>{term}</Text>
            </View>
          ))}
        </View>

        {/* Additional Notes */}
        {customNotes && <NotesSection title="ADDITIONAL NOTES" notes={customNotes} />}
      </ReportPage>

      {/* Page 2: Supporting Documents, Response Form, Contact */}
      <ReportPage>
        {watermark && <Watermark text={watermark} />}

        {/* Supporting Documents — filenames only.
            The actual files are delivered alongside the PDF inside the RFQ ZIP
            bundle, so the PDF never carries hyperlinks (no signed-URL leakage,
            and the document stays consistent however it's shared). */}
        {rfq.attachments && rfq.attachments.length > 0 && (
          <>
            <Text style={local.sectionTitle}>SUPPORTING DOCUMENTS</Text>
            <Text style={local.attachmentHint}>The following files are bundled with this RFQ.</Text>
            <View style={local.attachmentList}>
              {/* Header row */}
              <View style={local.attachmentHeaderRow}>
                <Text style={[local.attachmentCell, local.attachmentHeader, { width: '45%' }]}>
                  File
                </Text>
                <Text style={[local.attachmentCell, local.attachmentHeader, { width: '20%' }]}>
                  Type
                </Text>
                <Text style={[local.attachmentCell, local.attachmentHeader, { width: '35%' }]}>
                  Description
                </Text>
              </View>
              {rfq.attachments.map((a, i) => (
                <View key={i} style={local.attachmentRow}>
                  <View style={[local.attachmentCell, { width: '45%' }]}>
                    <Text>{a.fileName}</Text>
                  </View>
                  <Text style={[local.attachmentCell, { width: '20%' }]}>{a.attachmentType}</Text>
                  <Text style={[local.attachmentCell, { width: '35%' }]}>
                    {a.description || ''}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Vendor Response Section */}
        <Text style={local.sectionTitle}>VENDOR RESPONSE (To be filled by Vendor)</Text>
        <KeyValueTable
          labelWidth="35%"
          valueWidth="65%"
          rows={[
            { label: 'Quote Reference No', value: '' },
            { label: 'Quote Date', value: '' },
            { label: 'Quote Validity (Days)', value: '' },
            { label: 'Delivery Period', value: '' },
            { label: 'Total Basic Amount', value: '' },
            { label: 'Total Tax (GST)', value: '' },
            { label: 'Grand Total', value: '' },
            { label: 'Payment Terms Accepted (Y/N)', value: '' },
            { label: 'Remarks (if any)', value: '' },
          ]}
        />

        {/* Contact Section */}
        <Text style={local.sectionTitle}>FOR QUERIES, PLEASE CONTACT</Text>
        <ReportTable
          columns={[
            { key: 'name', header: 'Name', width: '34%', align: 'center' },
            { key: 'email', header: 'Email', width: '33%', align: 'center' },
            { key: 'phone', header: 'Phone', width: '33%', align: 'center' },
          ]}
          rows={[
            {
              name: contact?.name || 'A.Kumaran',
              email: contact?.email || 'procurement@vapourdesal.com',
              phone: contact?.phone || '9786385661',
            },
          ]}
        />

        <ReportFooter
          lines={[`${company.name} | ${rfqNumber}`, `Generated on ${data.generatedAt}`]}
        />
      </ReportPage>
    </Document>
  );
}
