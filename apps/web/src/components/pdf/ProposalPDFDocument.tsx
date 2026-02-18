/**
 * Proposal PDF Document Template
 *
 * React-PDF template for professional proposal documents
 * Supports both legacy (scopeOfSupply, pricing) and new (scopeMatrix, pricingConfig) data structures
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Proposal, ScopeItem, Money } from '@vapour/types';
import { PROJECT_PHASE_LABELS, MILESTONE_TAX_TYPE_LABELS } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 5,
  },
  proposalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
  },
  section: {
    marginTop: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
    borderBottom: '1pt solid #e0e0e0',
    paddingBottom: 4,
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
    color: '#333',
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
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    fontWeight: 'bold',
    borderBottom: '1pt solid #ccc',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '0.5pt solid #e0e0e0',
  },
  col1: { width: '8%' },
  col2: { width: '47%' },
  col3: { width: '15%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    borderTop: '0.5pt solid #ccc',
    paddingTop: 10,
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: 60,
    color: '#f0f0f0',
    opacity: 0.3,
    fontWeight: 'bold',
  },
  costSummary: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    border: '1pt solid #e0e0e0',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 10,
  },
  costValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalCost: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  bulletList: {
    marginLeft: 15,
    marginTop: 5,
  },
  bulletItem: {
    marginBottom: 4,
  },
});

interface ProposalPDFDocumentProps {
  proposal: Proposal;
  showCostBreakdown: boolean;
  showIndirectCosts: boolean;
  includeTerms: boolean;
  includeDeliverySchedule: boolean;
  watermark?: string;
}

export const ProposalPDFDocument = ({
  proposal,
  showCostBreakdown: _showCostBreakdown,
  showIndirectCosts: _showIndirectCosts,
  includeTerms,
  includeDeliverySchedule,
  watermark,
}: ProposalPDFDocumentProps) => {
  const formatCurrency = (
    money: Money | { amount: number; currency: string } | undefined | null
  ) => {
    if (!money) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(money.amount);
  };

  // Check each new data structure independently
  const hasScopeMatrix = Boolean(
    proposal.scopeMatrix &&
    (proposal.scopeMatrix.services.length > 0 ||
      proposal.scopeMatrix.supply.length > 0 ||
      proposal.scopeMatrix.exclusions.length > 0)
  );
  const hasPricingConfig = Boolean(proposal.pricingConfig?.isComplete);

  // Group scope items by phase for new structure
  const groupByPhase = (items: ScopeItem[]) => {
    const grouped: Record<string, ScopeItem[]> = {};
    items.forEach((item) => {
      const phase = item.phase || 'GENERAL';
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(item);
    });
    return grouped;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {watermark && (
          <View style={styles.watermark}>
            <Text>{watermark}</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>Vapour Desal Technologies</Text>
          <Text>Professional Water Treatment Solutions</Text>
          <Text style={styles.proposalTitle}>
            Techno-Commercial Proposal (Proposal No: {proposal.proposalNumber} Rev.
            {proposal.revision})
          </Text>
        </View>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TO</Text>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{proposal.clientName}</Text>
          {proposal.clientAddress && <Text>{proposal.clientAddress}</Text>}
          {proposal.clientContactPerson && <Text>Attention: {proposal.clientContactPerson}</Text>}
          {proposal.clientEmail && <Text>Email: {proposal.clientEmail}</Text>}
        </View>

        {/* Proposal Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proposal Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Subject:</Text>
            <Text style={styles.value}>{proposal.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{formatDate(proposal.preparationDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Valid Until:</Text>
            <Text style={styles.value}>{formatDate(proposal.validityDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Enquiry Ref:</Text>
            <Text style={styles.value}>{proposal.enquiryNumber}</Text>
          </View>
        </View>

        {/* Scope of Work - scopeMatrix services or legacy */}
        {hasScopeMatrix &&
        proposal.scopeMatrix?.services &&
        proposal.scopeMatrix.services.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scope of Services</Text>
            {Object.entries(groupByPhase(proposal.scopeMatrix.services)).map(([phase, items]) => (
              <View key={phase} style={{ marginBottom: 8 }}>
                <Text style={styles.subsectionTitle}>
                  {phase === 'GENERAL'
                    ? 'General'
                    : PROJECT_PHASE_LABELS[phase as keyof typeof PROJECT_PHASE_LABELS] || phase}
                </Text>
                <View style={styles.bulletList}>
                  {items.map((item) => (
                    <Text key={item.id} style={styles.bulletItem}>
                      • {item.itemNumber}. {item.name}
                      {item.description ? ` - ${item.description}` : ''}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : proposal.scopeOfWork ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scope of Work</Text>
            {proposal.scopeOfWork.summary && <Text>{proposal.scopeOfWork.summary}</Text>}

            {proposal.scopeOfWork.objectives && proposal.scopeOfWork.objectives.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Objectives:</Text>
                <View style={styles.bulletList}>
                  {proposal.scopeOfWork.objectives.map((obj, idx) => (
                    <Text key={idx} style={styles.bulletItem}>
                      • {obj}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {proposal.scopeOfWork.deliverables && proposal.scopeOfWork.deliverables.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Deliverables:</Text>
                <View style={styles.bulletList}>
                  {proposal.scopeOfWork.deliverables.map((del, idx) => (
                    <Text key={idx} style={styles.bulletItem}>
                      • {del}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* Scope of Supply - scopeMatrix or legacy */}
        {hasScopeMatrix &&
        proposal.scopeMatrix?.supply &&
        proposal.scopeMatrix.supply.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scope of Supply</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>#</Text>
                <Text style={styles.col2}>Description</Text>
                <Text style={styles.col3}>Qty</Text>
                <Text style={styles.col4}>Unit</Text>
              </View>
              {proposal.scopeMatrix.supply.map((item, idx) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.col1}>{item.itemNumber || idx + 1}</Text>
                  <Text style={styles.col2}>
                    {item.name}
                    {item.description && `\n${item.description}`}
                  </Text>
                  <Text style={styles.col3}>{item.quantity || '—'}</Text>
                  <Text style={styles.col4}>{item.unit || '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : proposal.scopeOfSupply && proposal.scopeOfSupply.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scope of Supply</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>#</Text>
                <Text style={styles.col2}>Description</Text>
                <Text style={styles.col3}>Qty</Text>
                <Text style={styles.col4}>Unit Price</Text>
                <Text style={styles.col5}>Amount</Text>
              </View>
              {proposal.scopeOfSupply.map((item, idx) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.col1}>{idx + 1}</Text>
                  <Text style={styles.col2}>
                    {item.itemName}
                    {item.description && `\n${item.description}`}
                  </Text>
                  <Text style={styles.col3}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={styles.col4}>
                    {item.unitPrice ? formatCurrency(item.unitPrice) : 'N/A'}
                  </Text>
                  <Text style={styles.col5}>{formatCurrency(item.totalPrice)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Exclusions */}
        {hasScopeMatrix &&
          proposal.scopeMatrix?.exclusions &&
          proposal.scopeMatrix.exclusions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exclusions</Text>
              <View style={styles.bulletList}>
                {proposal.scopeMatrix.exclusions.map((item) => (
                  <Text key={item.id} style={styles.bulletItem}>
                    • {item.itemNumber}. {item.name}
                    {item.description ? ` - ${item.description}` : ''}
                  </Text>
                ))}
              </View>
            </View>
          )}

        {/* Pricing Summary - pricingConfig or legacy */}
        {hasPricingConfig && proposal.pricingConfig ? (
          <View style={styles.costSummary}>
            <Text style={{ ...styles.sectionTitle, borderBottom: 'none', marginBottom: 10 }}>
              Commercial Summary
            </Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Base Cost:</Text>
              <Text style={styles.costValue}>
                {formatCurrency(proposal.pricingConfig.estimationSubtotal)}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>
                Overhead ({proposal.pricingConfig.overheadPercent}%):
              </Text>
              <Text style={styles.costValue}>
                {formatCurrency(proposal.pricingConfig.overheadAmount)}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>
                Contingency ({proposal.pricingConfig.contingencyPercent}%):
              </Text>
              <Text style={styles.costValue}>
                {formatCurrency(proposal.pricingConfig.contingencyAmount)}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>
                Profit ({proposal.pricingConfig.profitMarginPercent}%):
              </Text>
              <Text style={styles.costValue}>
                {formatCurrency(proposal.pricingConfig.profitAmount)}
              </Text>
            </View>
            <View
              style={{
                ...styles.costRow,
                marginTop: 6,
                paddingTop: 6,
                borderTop: '0.5pt solid #ccc',
              }}
            >
              <Text style={styles.costLabel}>Subtotal:</Text>
              <Text style={styles.costValue}>
                {formatCurrency(proposal.pricingConfig.subtotalBeforeTax)}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>GST ({proposal.pricingConfig.taxPercent}%):</Text>
              <Text style={styles.costValue}>
                {formatCurrency(proposal.pricingConfig.taxAmount)}
              </Text>
            </View>
            <View
              style={{
                ...styles.costRow,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1pt solid #ccc',
              }}
            >
              <Text style={styles.costLabel}>Total Amount:</Text>
              <Text style={styles.totalCost}>
                {formatCurrency(proposal.pricingConfig.totalPrice)}
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 9, color: '#666' }}>
                Validity: {proposal.pricingConfig.validityDays} days from date of issue
              </Text>
            </View>
          </View>
        ) : proposal.pricing ? (
          <View style={styles.costSummary}>
            <Text style={{ ...styles.sectionTitle, borderBottom: 'none', marginBottom: 10 }}>
              Pricing Summary
            </Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Subtotal:</Text>
              <Text style={styles.costValue}>{formatCurrency(proposal.pricing.subtotal)}</Text>
            </View>
            {proposal.pricing.taxItems?.map((tax) => (
              <View key={tax.id} style={styles.costRow}>
                <Text style={styles.costLabel}>
                  {tax.taxType} ({tax.taxRate}%):
                </Text>
                <Text style={styles.costValue}>{formatCurrency(tax.taxAmount)}</Text>
              </View>
            ))}
            <View
              style={{
                ...styles.costRow,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1pt solid #ccc',
              }}
            >
              <Text style={styles.costLabel}>Total Amount:</Text>
              <Text style={styles.totalCost}>{formatCurrency(proposal.pricing.totalAmount)}</Text>
            </View>
          </View>
        ) : null}

        {/* Delivery Schedule */}
        {includeDeliverySchedule && proposal.deliveryPeriod && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Schedule</Text>
            <Text>{proposal.deliveryPeriod.description}</Text>
            {proposal.deliveryPeriod.milestones &&
              proposal.deliveryPeriod.milestones.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Milestones:</Text>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={{ width: '8%' }}>#</Text>
                      <Text style={{ width: '37%' }}>Description</Text>
                      <Text style={{ width: '20%' }}>Deliverable</Text>
                      <Text style={{ width: '12%' }}>Duration</Text>
                      <Text style={{ width: '12%' }}>Payment</Text>
                      <Text style={{ width: '11%' }}>Tax</Text>
                    </View>
                    {proposal.deliveryPeriod.milestones.map((milestone, idx) => (
                      <View key={idx} style={styles.tableRow}>
                        <Text style={{ width: '8%' }}>{milestone.milestoneNumber || idx + 1}</Text>
                        <Text style={{ width: '37%' }}>{milestone.description}</Text>
                        <Text style={{ width: '20%' }}>{milestone.deliverable || '—'}</Text>
                        <Text style={{ width: '12%' }}>{milestone.durationInWeeks} wks</Text>
                        <Text style={{ width: '12%' }}>
                          {milestone.paymentPercentage ? `${milestone.paymentPercentage}%` : '—'}
                        </Text>
                        <Text style={{ width: '11%' }}>
                          {milestone.taxType ? MILESTONE_TAX_TYPE_LABELS[milestone.taxType] : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
          </View>
        )}

        {/* Payment Terms */}
        {proposal.pricing?.paymentTerms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Terms</Text>
            <Text>{proposal.pricing.paymentTerms}</Text>
          </View>
        )}

        {/* Terms & Conditions */}
        {includeTerms && proposal.terms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            {proposal.terms.warranty && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold' }}>Warranty:</Text>
                <Text>{proposal.terms.warranty}</Text>
              </View>
            )}
            {proposal.terms.liquidatedDamages && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold' }}>Liquidated Damages:</Text>
                <Text>{proposal.terms.liquidatedDamages}</Text>
              </View>
            )}
            {proposal.terms.forceMajeure && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold' }}>Force Majeure:</Text>
                <Text>{proposal.terms.forceMajeure}</Text>
              </View>
            )}
            {proposal.terms.disputeResolution && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold' }}>Dispute Resolution:</Text>
                <Text>{proposal.terms.disputeResolution}</Text>
              </View>
            )}
            {proposal.terms.customTerms && proposal.terms.customTerms.length > 0 && (
              <View style={styles.bulletList}>
                {proposal.terms.customTerms.map((term, idx) => (
                  <Text key={idx} style={styles.bulletItem}>
                    • {term}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated document. Generated on {formatDate(new Date())}</Text>
          <Text>Vapour Desal Technologies | info@vapourdesal.com | www.vapourdesal.com</Text>
        </View>
      </Page>
    </Document>
  );
};
