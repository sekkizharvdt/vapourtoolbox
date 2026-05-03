/**
 * Proposal PDF Document Template
 *
 * Customer-facing proposal PDF. Uses the shared report components so the
 * format matches RFQ / PO / other modules (logo, header, theme).
 *
 * IMPORTANT: This document is what the client sees. It MUST NOT expose
 * internal markup percentages (overhead / contingency / profit) — those
 * are negotiation-sensitive and live only on the Costing tab. The
 * Commercial Summary collapses the cost basis + markups into a single
 * priced line and shows lump-sum lines, subtotal, tax, total.
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Proposal, UnifiedScopeItem } from '@vapour/types';
import { MILESTONE_TAX_TYPE_LABELS } from '@vapour/types';
import { formatDate, formatCurrency as sharedFormatCurrency } from '@/lib/utils/formatters';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  Watermark,
  ReportFooter,
  reportStyles as s,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';

export interface ProposalPDFCompany {
  name: string;
  address?: string;
  gstin?: string;
  email?: string;
  phone?: string;
  website?: string;
}

const local = StyleSheet.create({
  companyMeta: {
    marginTop: -8,
    marginBottom: 8,
  },
  companyMetaText: {
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
    textAlign: 'center',
  },
  proposalTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'center',
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
  includeTerms: boolean;
  includeDeliverySchedule: boolean;
  watermark?: string;
  company?: ProposalPDFCompany;
  logoDataUri?: string;
}

const DEFAULT_COMPANY: ProposalPDFCompany = {
  name: 'Vapour Desal Technologies Private Limited',
};

export const ProposalPDFDocument = ({
  proposal,
  includeTerms,
  includeDeliverySchedule,
  watermark,
  company = DEFAULT_COMPANY,
  logoDataUri,
}: ProposalPDFDocumentProps) => {
  const hasUnifiedScopeMatrix = Boolean(
    proposal.unifiedScopeMatrix &&
    proposal.unifiedScopeMatrix.categories.some((c) => c.items.length > 0)
  );

  // Stage 2.5: client-facing pricing. Only clientPricing renders on the
  // customer PDF; the legacy pricingConfig markup-breakdown is no longer
  // shown to clients (internal-only data).
  const hasClientPricing = Boolean(proposal.clientPricing);

  // Internal cost basis is always INR. Quote currency lives on clientPricing.
  // The conversion (INR → quote currency) is applied only to the final total.
  const cp = proposal.clientPricing;
  const inrCurrency = 'INR' as const;
  const quoteCurrency = cp?.currency ?? 'INR';
  const fxRate = cp?.fxRate ?? 1;
  const isForeignQuote = quoteCurrency !== 'INR' && fxRate > 0;
  const costBasis = (proposal.pricingBlocks ?? []).reduce((s, b) => s + (b.subtotal || 0), 0);
  const cpComputed = cp
    ? (() => {
        const overheadAmount = (costBasis * (cp.overheadPercent || 0)) / 100;
        const contingencyAmount = (costBasis * (cp.contingencyPercent || 0)) / 100;
        const profitAmount = (costBasis * (cp.profitPercent || 0)) / 100;
        // What the client sees as the price for the scope of work — markups
        // are rolled in here so they're invisible to the buyer.
        const scopeLinePrice = costBasis + overheadAmount + contingencyAmount + profitAmount;
        const lumpSumTotal = cp.lumpSumLines.reduce((s, r) => s + (r.amount ?? 0), 0);
        const subtotal = scopeLinePrice + lumpSumTotal;
        const taxAmount = (subtotal * (cp.taxRate || 0)) / 100;
        const totalInr = subtotal + taxAmount;
        const totalQuote = isForeignQuote ? totalInr / fxRate : totalInr;
        return {
          scopeLinePrice,
          subtotal,
          taxAmount,
          totalInr,
          totalQuote,
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

        {/* Header — shared format with RFQ / PO / other modules */}
        <ReportHeader
          title="Techno-Commercial Proposal"
          subtitle={company.name}
          logoDataUri={logoDataUri}
        />
        {(company.address || company.gstin) && (
          <View style={local.companyMeta}>
            {company.address && <Text style={local.companyMetaText}>{company.address}</Text>}
            {company.gstin && <Text style={local.companyMetaText}>GSTIN: {company.gstin}</Text>}
          </View>
        )}
        <Text style={local.proposalTitle}>
          Proposal No: {proposal.proposalNumber} Rev.{proposal.revision}
        </Text>

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

        {/* Commercial Summary — customer-facing.
            The cost basis + overhead + contingency + profit are rolled into a
            SINGLE priced line (described by the proposal title) so internal
            markup percentages never reach the client. Lump-sum lines render
            individually. Then subtotal, tax, total. */}
        {hasClientPricing && cp && cpComputed ? (
          <View style={local.costSummary}>
            <Text style={[s.sectionTitle, { borderBottom: 'none', marginBottom: 10 }]}>
              Commercial Summary
            </Text>
            {cpComputed.scopeLinePrice > 0 && (
              <View style={local.costRow}>
                <Text style={local.costLabel}>{proposal.title || 'Scope of Work'}</Text>
                <Text style={local.costValue}>
                  {sharedFormatCurrency(cpComputed.scopeLinePrice, inrCurrency, {
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
                  {sharedFormatCurrency(row.amount ?? 0, inrCurrency, {
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
                {sharedFormatCurrency(cpComputed.subtotal, inrCurrency, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </Text>
            </View>
            {cp.taxRate > 0 && (
              <View style={local.costRow}>
                <Text style={local.costLabel}>{cp.taxLabel || `Tax (${cp.taxRate}%)`}:</Text>
                <Text style={local.costValue}>
                  {sharedFormatCurrency(cpComputed.taxAmount, inrCurrency, {
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
              <Text style={local.costLabel}>Total Amount (INR):</Text>
              <Text style={local.totalCost}>
                {sharedFormatCurrency(cpComputed.totalInr, inrCurrency, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </Text>
            </View>
            {isForeignQuote && (
              <View style={local.costRow}>
                <Text style={local.costLabel}>
                  Total in {quoteCurrency} (at 1 {quoteCurrency} = ₹{fxRate}):
                </Text>
                <Text style={local.totalCost}>
                  {sharedFormatCurrency(cpComputed.totalQuote, quoteCurrency, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            )}
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

        {/* Terms & Conditions — structured termsBlocks render first;
            legacy `terms` named slots are only used when termsBlocks isn't
            present (older proposals from before stage 2.5j). */}
        {includeTerms &&
          (() => {
            const blocks = (proposal.termsBlocks ?? [])
              .filter((b) => b.included && b.body.trim().length > 0)
              .sort((a, b) => a.order - b.order);
            if (blocks.length > 0) {
              return (
                <ReportSection title="Terms &amp; Conditions">
                  {blocks.map((b, idx) => (
                    <View key={b.id} style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold' }}>
                        {idx + 1}. {b.title}
                      </Text>
                      <Text>{b.body}</Text>
                    </View>
                  ))}
                </ReportSection>
              );
            }
            // Legacy fallback for proposals created before structured terms.
            if (!proposal.terms) return null;
            const t = proposal.terms;
            const hasAny =
              !!t.warranty ||
              !!t.liquidatedDamages ||
              !!t.forceMajeure ||
              !!t.disputeResolution ||
              (t.customTerms && t.customTerms.length > 0);
            if (!hasAny) return null;
            return (
              <ReportSection title="Terms &amp; Conditions">
                {t.warranty && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Warranty:</Text>
                    <Text>{t.warranty}</Text>
                  </View>
                )}
                {t.liquidatedDamages && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Liquidated Damages:</Text>
                    <Text>{t.liquidatedDamages}</Text>
                  </View>
                )}
                {t.forceMajeure && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Force Majeure:</Text>
                    <Text>{t.forceMajeure}</Text>
                  </View>
                )}
                {t.disputeResolution && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Dispute Resolution:</Text>
                    <Text>{t.disputeResolution}</Text>
                  </View>
                )}
                {t.customTerms && t.customTerms.length > 0 && (
                  <View style={local.bulletList}>
                    {t.customTerms.map((term, idx) => (
                      <Text key={idx} style={local.bulletItem}>
                        • {term}
                      </Text>
                    ))}
                  </View>
                )}
              </ReportSection>
            );
          })()}

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
