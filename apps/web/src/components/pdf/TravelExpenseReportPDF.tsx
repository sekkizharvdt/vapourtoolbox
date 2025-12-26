/**
 * Travel Expense Report PDF Template
 *
 * React-PDF template for generating travel expense reports
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { TravelExpenseReport, TravelExpenseCategory } from '@vapour/types';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: '2pt solid #1976d2',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 3,
  },
  companyTagline: {
    fontSize: 8,
    color: '#666',
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
  reportNumber: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    color: '#666',
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
    borderBottom: '1pt solid #e0e0e0',
    paddingBottom: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  infoItem: {
    width: '50%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 6,
    fontWeight: 'bold',
    fontSize: 8,
    borderBottom: '1pt solid #ccc',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '0.5pt solid #e0e0e0',
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  colDate: { width: '12%' },
  colCategory: { width: '15%' },
  colDescription: { width: '28%' },
  colVendor: { width: '15%' },
  colAmount: { width: '15%', textAlign: 'right' },
  colGst: { width: '15%', textAlign: 'right' },
  categoryTotals: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryItem: {
    width: '33.33%',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 8,
    color: '#666',
  },
  categoryValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  grandTotal: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#1976d2',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
  approvalSection: {
    marginTop: 20,
    padding: 10,
    border: '1pt solid #e0e0e0',
    borderRadius: 4,
  },
  approvalRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  approvalLabel: {
    width: '25%',
    fontSize: 9,
    color: '#666',
  },
  approvalValue: {
    width: '75%',
    fontSize: 9,
  },
  signatureSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    padding: 10,
    border: '1pt solid #e0e0e0',
  },
  signatureLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 30,
  },
  signatureLine: {
    borderTop: '1pt solid #000',
    marginTop: 25,
    paddingTop: 5,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  signatureDate: {
    fontSize: 8,
    color: '#666',
    marginTop: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#999',
    textAlign: 'center',
    borderTop: '0.5pt solid #e0e0e0',
    paddingTop: 8,
  },
  statusBadge: {
    padding: '3 8',
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  statusApproved: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  statusPending: {
    backgroundColor: '#fff3e0',
    color: '#ef6c00',
  },
  statusRejected: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  statusDraft: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
});

const CATEGORY_LABELS: Record<TravelExpenseCategory, string> = {
  TRAVEL: 'Travel',
  ACCOMMODATION: 'Accommodation',
  LOCAL_CONVEYANCE: 'Local Conveyance',
  FOOD: 'Food & Meals',
  OTHER: 'Other',
};

interface TravelExpenseReportPDFProps {
  report: TravelExpenseReport;
  companyName?: string;
  showSignatures?: boolean;
}

export const TravelExpenseReportPDF = ({
  report,
  companyName = 'Vapour Desal Technologies',
  showSignatures = true,
}: TravelExpenseReportPDFProps) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDateValue = (date: Date | { toDate: () => Date }): string => {
    const d = 'toDate' in date ? date.toDate() : date;
    return format(d, 'dd MMM yyyy');
  };

  const getStatusStyle = () => {
    switch (report.status) {
      case 'APPROVED':
      case 'REIMBURSED':
        return styles.statusApproved;
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return styles.statusPending;
      case 'REJECTED':
        return styles.statusRejected;
      default:
        return styles.statusDraft;
    }
  };

  const getStatusLabel = () => {
    switch (report.status) {
      case 'DRAFT':
        return 'Draft';
      case 'SUBMITTED':
        return 'Pending Approval';
      case 'UNDER_REVIEW':
        return 'Under Review';
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Rejected';
      case 'REIMBURSED':
        return 'Reimbursed';
      default:
        return report.status;
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.companyTagline}>Innovative Desalination & Process Solutions</Text>
        </View>

        {/* Report Title */}
        <Text style={styles.reportTitle}>TRAVEL EXPENSE REPORT</Text>
        <Text style={styles.reportNumber}>{report.reportNumber}</Text>

        {/* Status Badge */}
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <View style={[styles.statusBadge, getStatusStyle()]}>
            <Text>{getStatusLabel()}</Text>
          </View>
        </View>

        {/* Trip Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Employee</Text>
              <Text style={styles.infoValue}>{report.employeeName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{report.department || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Trip Purpose</Text>
              <Text style={styles.infoValue}>{report.tripPurpose}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Trip Dates</Text>
              <Text style={styles.infoValue}>
                {formatDateValue(report.tripStartDate)} - {formatDateValue(report.tripEndDate)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Destinations</Text>
              <Text style={styles.infoValue}>{report.destinations.join(', ')}</Text>
            </View>
            {report.projectName && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Project</Text>
                <Text style={styles.infoValue}>{report.projectName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Expense Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colDate}>Date</Text>
              <Text style={styles.colCategory}>Category</Text>
              <Text style={styles.colDescription}>Description</Text>
              <Text style={styles.colVendor}>Vendor</Text>
              <Text style={styles.colAmount}>Amount</Text>
              <Text style={styles.colGst}>GST</Text>
            </View>
            {report.items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.colDate}>{formatDateValue(item.expenseDate)}</Text>
                <Text style={styles.colCategory}>{CATEGORY_LABELS[item.category]}</Text>
                <Text style={styles.colDescription}>
                  {item.description}
                  {item.fromLocation &&
                    item.toLocation &&
                    `\n${item.fromLocation} → ${item.toLocation}`}
                </Text>
                <Text style={styles.colVendor}>{item.vendorName || '-'}</Text>
                <Text style={styles.colAmount}>{formatCurrency(item.amount)}</Text>
                <Text style={styles.colGst}>
                  {item.gstAmount ? formatCurrency(item.gstAmount) : '-'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Category Totals */}
        <View style={styles.categoryTotals}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 10 }]}>
            Category Summary
          </Text>
          <View style={styles.categoryGrid}>
            {(Object.keys(report.categoryTotals) as TravelExpenseCategory[]).map((category) => (
              <View key={category} style={styles.categoryItem}>
                <Text style={styles.categoryLabel}>{CATEGORY_LABELS[category]}</Text>
                <Text style={styles.categoryValue}>
                  {formatCurrency(report.categoryTotals[category] || 0)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Grand Total */}
        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(report.totalAmount)}</Text>
        </View>

        {/* GST Summary */}
        {report.totalGstAmount > 0 && (
          <View style={{ marginTop: 5, textAlign: 'right' }}>
            <Text style={{ fontSize: 9, color: '#666' }}>
              (Includes GST: {formatCurrency(report.totalGstAmount)})
            </Text>
          </View>
        )}

        {/* Approval Details */}
        {(report.status === 'APPROVED' || report.status === 'REIMBURSED') && (
          <View style={styles.approvalSection}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Approval Details</Text>
            <View style={styles.approvalRow}>
              <Text style={styles.approvalLabel}>Approved By:</Text>
              <Text style={styles.approvalValue}>{report.approvedByName || '-'}</Text>
            </View>
            {report.approvedAt && (
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>Approved On:</Text>
                <Text style={styles.approvalValue}>{formatDateValue(report.approvedAt)}</Text>
              </View>
            )}
            {report.approvedAmount && report.approvedAmount !== report.totalAmount && (
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>Approved Amount:</Text>
                <Text style={styles.approvalValue}>{formatCurrency(report.approvedAmount)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Reimbursement Details */}
        {report.status === 'REIMBURSED' && (
          <View style={[styles.approvalSection, { marginTop: 10 }]}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Reimbursement Details</Text>
            {report.reimbursedAmount && (
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>Amount Reimbursed:</Text>
                <Text style={styles.approvalValue}>{formatCurrency(report.reimbursedAmount)}</Text>
              </View>
            )}
            {report.reimbursementDate && (
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>Reimbursed On:</Text>
                <Text style={styles.approvalValue}>
                  {formatDateValue(report.reimbursementDate)}
                </Text>
              </View>
            )}
            {report.reimbursementTransactionId && (
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>Transaction ID:</Text>
                <Text style={styles.approvalValue}>{report.reimbursementTransactionId}</Text>
              </View>
            )}
          </View>
        )}

        {/* Signature Section */}
        {showSignatures && (
          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Employee Signature</Text>
              <View style={styles.signatureLine}>
                <Text style={styles.signatureName}>{report.employeeName}</Text>
                <Text style={styles.signatureDate}>Date: _______________</Text>
              </View>
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Approver Signature</Text>
              <View style={styles.signatureLine}>
                <Text style={styles.signatureName}>
                  {report.approvedByName || '_______________'}
                </Text>
                <Text style={styles.signatureDate}>Date: _______________</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            Generated on {format(new Date(), 'dd MMM yyyy, HH:mm')} | {report.reportNumber} | This
            is a computer-generated document
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default TravelExpenseReportPDF;
