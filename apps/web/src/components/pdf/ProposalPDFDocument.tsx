/**
 * Proposal PDF Document Template
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 * Supports both legacy (pricing) and new (unifiedScopeMatrix, pricingConfig) data structures.
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Proposal, Money, UnifiedScopeItem } from '@vapour/types';
import { MILESTONE_TAX_TYPE_LABELS } from '@vapour/types';
import { formatDate, formatCurrency as sharedFormatCurrency } from '@/lib/utils/formatters';
import {
  ReportPage,
  ReportSection,
  ReportTable,
  Watermark,
  ReportFooter,
  reportStyles as s,
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
  proposalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
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
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
    color: REPORT_THEME.text,
  },
  costSummary: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    border: `1pt solid ${REPORT_THEME.border}`,
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
    color: REPORT_THEME.primary,
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
    return sharedFormatCurrency(money.amount, money.currency, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const hasUnifiedScopeMatrix = Boolean(
    proposal.unifiedScopeMatrix &&
    proposal.unifiedScopeMatrix.categories.some((c) => c.items.length > 0)
  );

  // Stage 2.5: client-facing pricing layered on top of the internal cost basis.
  // Only one of clientPricing or the legacy pricingConfig will render.
  const hasClientPricing = Boolean(proposal.clientPricing);
  const hasPricingConfig = !hasClientPricing && Boolean(proposal.pricingConfig?.isComplete);

  const cp = proposal.clientPricing;
  const cpCurrency = cp?.currency ?? proposal.nativeCurrency ?? 'INR';
  const costBasis = (proposal.pricingBlocks ?? []).reduce((s, b) => s + (b.subtotal || 0), 0);
  const cpComputed = cp
    ? (() => {
        const overheadAmount = (costBasis * (cp.overheadPercent || 0)) / 100;
        const contingencyAmount = (costBasis * (cp.contingencyPercent || 0)) / 100;
        const profitAmount = (costBasis * (cp.profitPercent || 0)) / 100;
        const lumpSumTotal = cp.lumpSumLines.reduce((s, r) => s + (r.amount || 0), 0);
        const subtotal =
          costBasis + overheadAmount + contingencyAmount + profitAmount + lumpSumTotal;
        const taxAmount = (subtotal * (cp.taxRate || 0)) / 100;
        const total = subtotal + taxAmount;
        return {
          overheadAmount,
          contingencyAmount,
          profitAmount,
          lumpSumTotal,
          subtotal,
          taxAmount,
          total,
        };
      })()
    : null;

  const unifiedServices: UnifiedScopeItem[] = hasUnifiedScopeMatrix
    ? proposal.unifiedScopeMatrix!.categories.flatMap((c) =>
        c.items.filter((i) => i.included && i.classification === 'SERVICE')
      )
    : [];
  const unifiedSupply: UnifiedScopeItem[] = hasUnifiedScopeMatrix
    ? proposal.unifiedScopeMatrix!.categories.flatMap((c) =>
        c.items.filter((i) => i.included && i.classification === 'SUPPLY')
      )
    : [];
  const unifiedExclusions: UnifiedScopeItem[] = hasUnifiedScopeMatrix
    ? proposal.unifiedScopeMatrix!.categories.flatMap((c) => c.items.filter((i) => !i.included))
    : [];

  return (
    <Document>
      <ReportPage style={{ padding: 40, fontSize: 10 }}>
        {watermark && <Watermark text={watermark} />}

        {/* Header */}
        <View style={local.header}>
          <Text style={local.companyName}>Vapour Desal Technologies</Text>
          <Text>Professional Water Treatment Solutions</Text>
          <Text style={local.proposalTitle}>
            Techno-Commercial Proposal (Proposal No: {proposal.proposalNumber} Rev.
            {proposal.revision})
          </Text>
        </View>

        {/* Client Information */}
        <ReportSection title="TO">
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{proposal.clientName}</Text>
          {proposal.clientAddress && <Text>{proposal.clientAddress}</Text>}
          {proposal.clientContactPerson && <Text>Attention: {proposal.clientContactPerson}</Text>}
          {proposal.clientEmail && <Text>Email: {proposal.clientEmail}</Text>}
        </ReportSection>

        {/* Proposal Details */}
        <ReportSection title="Proposal Details">
          <View style={local.row}>
            <Text style={local.label}>Subject:</Text>
            <Text style={local.value}>{proposal.title}</Text>
          </View>
          <View style={local.row}>
            <Text style={local.label}>Date:</Text>
            <Text style={local.value}>{formatDate(proposal.preparationDate)}</Text>
          </View>
          <View style={local.row}>
            <Text style={local.label}>Valid Until:</Text>
            <Text style={local.value}>{formatDate(proposal.validityDate)}</Text>
          </View>
          <View style={local.row}>
            <Text style={local.label}>Enquiry Ref:</Text>
            <Text style={local.value}>{proposal.enquiryNumber}</Text>
          </View>
        </ReportSection>

        {/* Scope of Services — Unified Scope Matrix */}
        {hasUnifiedScopeMatrix && unifiedServices.length > 0 ? (
          <ReportSection title="Scope of Services">
            {proposal
              .unifiedScopeMatrix!.categories.filter((cat) =>
                cat.items.some((i) => i.included && i.classification === 'SERVICE')
              )
              .map((cat) => (
                <View key={cat.id} style={{ marginBottom: 8 }}>
                  <Text style={local.subsectionTitle}>{cat.label}</Text>
                  <View style={local.bulletList}>
                    {cat.items
                      .filter((i) => i.included && i.classification === 'SERVICE')
                      .map((item) => (
                        <Text key={item.id} style={local.bulletItem}>
                          • {item.name}
                          {item.description ? ` - ${item.description}` : ''}
                        </Text>
                      ))}
                  </View>
                </View>
              ))}
          </ReportSection>
        ) : null}

        {/* Scope of Supply — Unified Scope Matrix */}
        {hasUnifiedScopeMatrix && unifiedSupply.length > 0 ? (
          <ReportSection title="Scope of Supply">
            <ReportTable
              columns={[
                { key: 'num', header: '#', width: '8%' },
                { key: 'description', header: 'Description', width: '47%' },
                { key: 'qty', header: 'Qty', width: '15%' },
                { key: 'unit', header: 'Unit', width: '15%' },
              ]}
              rows={unifiedSupply.map((item, idx) => ({
                num: idx + 1,
                description: item.description ? `${item.name}\n${item.description}` : item.name,
                qty: item.quantity || '—',
                unit: item.unit || '—',
              }))}
            />
          </ReportSection>
        ) : null}

        {/* Exclusions & Clarifications — items the buyer asked for that aren't in this offer */}
        {hasUnifiedScopeMatrix && unifiedExclusions.length > 0 ? (
          <ReportSection title="Exclusions and Clarifications">
            <Text style={{ marginBottom: 6, fontSize: 9, color: REPORT_THEME.textSecondary }}>
              The following items from the enquiry / SOW are not included in this offer:
            </Text>
            <View style={local.bulletList}>
              {unifiedExclusions.map((item, idx) => (
                <View key={item.id} style={{ marginBottom: 6 }}>
                  <Text style={local.bulletItem}>
                    {idx + 1}. {item.name}
                  </Text>
                  {item.exclusionReason && (
                    <Text
                      style={{
                        marginLeft: 14,
                        fontSize: 9,
                        color: REPORT_THEME.textSecondary,
                        fontStyle: 'italic',
                      }}
                    >
                      {item.exclusionReason}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </ReportSection>
        ) : null}

        {/* Pricing Summary — stage 2.5 clientPricing */}
        {hasClientPricing && cp && cpComputed ? (
          <View style={local.costSummary}>
            <Text style={[s.sectionTitle, { borderBottom: 'none', marginBottom: 10 }]}>
              Commercial Summary
            </Text>
            {cp.overheadPercent > 0 && (
              <View style={local.costRow}>
                <Text style={local.costLabel}>Overhead ({cp.overheadPercent}%):</Text>
                <Text style={local.costValue}>
                  {sharedFormatCurrency(cpComputed.overheadAmount, cpCurrency, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            )}
            {cp.contingencyPercent > 0 && (
              <View style={local.costRow}>
                <Text style={local.costLabel}>Contingency ({cp.contingencyPercent}%):</Text>
                <Text style={local.costValue}>
                  {sharedFormatCurrency(cpComputed.contingencyAmount, cpCurrency, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            )}
            {cp.profitPercent > 0 && (
              <View style={local.costRow}>
                <Text style={local.costLabel}>Profit ({cp.profitPercent}%):</Text>
                <Text style={local.costValue}>
                  {sharedFormatCurrency(cpComputed.profitAmount, cpCurrency, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            )}
            {cp.lumpSumLines.map((row) => (
              <View key={row.id} style={local.costRow}>
                <Text style={local.costLabel}>{row.description || '—'}</Text>
                <Text style={local.costValue}>
                  {sharedFormatCurrency(row.amount || 0, cpCurrency, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            ))}
            <View
              style={{
                ...local.costRow,
                marginTop: 6,
                paddingTop: 6,
                borderTop: '0.5pt solid #ccc',
              }}
            >
              <Text style={local.costLabel}>Subtotal:</Text>
              <Text style={local.costValue}>
                {sharedFormatCurrency(cpComputed.subtotal, cpCurrency, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </Text>
            </View>
            {cp.taxRate > 0 && (
              <View style={local.costRow}>
                <Text style={local.costLabel}>{cp.taxLabel || `Tax (${cp.taxRate}%)`}:</Text>
                <Text style={local.costValue}>
                  {sharedFormatCurrency(cpComputed.taxAmount, cpCurrency, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            )}
            <View
              style={{
                ...local.costRow,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1pt solid #ccc',
              }}
            >
              <Text style={local.costLabel}>Total Amount:</Text>
              <Text style={local.totalCost}>
                {sharedFormatCurrency(cpComputed.total, cpCurrency, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Pricing Summary — legacy pricingConfig (only renders when clientPricing is absent) */}
        {hasPricingConfig && proposal.pricingConfig ? (
          <View style={local.costSummary}>
            <Text style={[s.sectionTitle, { borderBottom: 'none', marginBottom: 10 }]}>
              Commercial Summary
            </Text>
            <View style={local.costRow}>
              <Text style={local.costLabel}>Base Cost:</Text>
              <Text style={local.costValue}>
                {formatCurrency(proposal.pricingConfig.estimationSubtotal)}
              </Text>
            </View>
            <View style={local.costRow}>
              <Text style={local.costLabel}>
                Overhead ({proposal.pricingConfig.overheadPercent}%):
              </Text>
              <Text style={local.costValue}>
                {formatCurrency(proposal.pricingConfig.overheadAmount)}
              </Text>
            </View>
            <View style={local.costRow}>
              <Text style={local.costLabel}>
                Contingency ({proposal.pricingConfig.contingencyPercent}%):
              </Text>
              <Text style={local.costValue}>
                {formatCurrency(proposal.pricingConfig.contingencyAmount)}
              </Text>
            </View>
            <View style={local.costRow}>
              <Text style={local.costLabel}>
                Profit ({proposal.pricingConfig.profitMarginPercent}%):
              </Text>
              <Text style={local.costValue}>
                {formatCurrency(proposal.pricingConfig.profitAmount)}
              </Text>
            </View>
            <View
              style={{
                ...local.costRow,
                marginTop: 6,
                paddingTop: 6,
                borderTop: '0.5pt solid #ccc',
              }}
            >
              <Text style={local.costLabel}>Subtotal:</Text>
              <Text style={local.costValue}>
                {formatCurrency(proposal.pricingConfig.subtotalBeforeTax)}
              </Text>
            </View>
            <View style={local.costRow}>
              <Text style={local.costLabel}>GST ({proposal.pricingConfig.taxPercent}%):</Text>
              <Text style={local.costValue}>
                {formatCurrency(proposal.pricingConfig.taxAmount)}
              </Text>
            </View>
            <View
              style={{
                ...local.costRow,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1pt solid #ccc',
              }}
            >
              <Text style={local.costLabel}>Total Amount:</Text>
              <Text style={local.totalCost}>
                {formatCurrency(proposal.pricingConfig.totalPrice)}
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>
                Validity: {proposal.pricingConfig.validityDays} days from date of issue
              </Text>
            </View>
          </View>
        ) : null}

        {/* Delivery Schedule */}
        {includeDeliverySchedule && proposal.deliveryPeriod && (
          <ReportSection title="Delivery Schedule">
            <Text>{proposal.deliveryPeriod.description}</Text>
            {proposal.deliveryPeriod.milestones &&
              proposal.deliveryPeriod.milestones.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Milestones:</Text>
                  <ReportTable
                    columns={[
                      { key: 'num', header: '#', width: '8%' },
                      { key: 'description', header: 'Description', width: '37%' },
                      { key: 'deliverable', header: 'Deliverable', width: '20%' },
                      { key: 'duration', header: 'Duration', width: '12%' },
                      { key: 'payment', header: 'Payment', width: '12%' },
                      { key: 'tax', header: 'Tax', width: '11%' },
                    ]}
                    rows={proposal.deliveryPeriod.milestones.map((milestone, idx) => ({
                      num: milestone.milestoneNumber || idx + 1,
                      description: milestone.description,
                      deliverable: milestone.deliverable || '—',
                      duration: `${milestone.durationInWeeks} wks`,
                      payment: milestone.paymentPercentage
                        ? `${milestone.paymentPercentage}%`
                        : '—',
                      tax: milestone.taxType ? MILESTONE_TAX_TYPE_LABELS[milestone.taxType] : '—',
                    }))}
                  />
                </View>
              )}
          </ReportSection>
        )}

        {/* Payment Terms */}
        {proposal.pricing?.paymentTerms && (
          <ReportSection title="Payment Terms">
            <Text>{proposal.pricing.paymentTerms}</Text>
          </ReportSection>
        )}

        {/* Terms & Conditions */}
        {includeTerms && proposal.terms && (
          <ReportSection title="Terms &amp; Conditions">
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
              <View style={local.bulletList}>
                {proposal.terms.customTerms.map((term, idx) => (
                  <Text key={idx} style={local.bulletItem}>
                    • {term}
                  </Text>
                ))}
              </View>
            )}
          </ReportSection>
        )}

        <ReportFooter
          lines={[
            `This is a computer-generated document. Generated on ${formatDate(new Date())}`,
            'Vapour Desal Technologies | info@vapourdesal.com | www.vapourdesal.com',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
