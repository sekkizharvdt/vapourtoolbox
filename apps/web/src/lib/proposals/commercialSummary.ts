/**
 * Commercial Summary computation.
 *
 * Single source of truth for the customer-facing pricing rollup, shared
 * by the Pricing editor, the Preview, and the PDF. Drives the rule:
 *
 *   cost basis (INR) × (1 + overhead% + contingency% + profit%)
 *     = revenue target (INR)
 *     ÷ fxRate                 ← only if currency ≠ INR
 *     = revenue target (quote currency)
 *
 *   priceSections (amounts in quote currency) distribute that target.
 *     • 1 included section  → amount auto-tracks the target
 *     • N included sections → user splits; banner shows target vs sum
 */

import type { CurrencyCode, Proposal } from '@vapour/types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface CommercialSummarySection {
  id: string;
  title: string;
  description?: string;
  /** Amount in quote currency. */
  amount: number;
}

export interface CommercialSummary {
  currency: CurrencyCode;
  isForeignQuote: boolean;
  fxRate: number;

  /** Sum of pricingBlocks subtotals — INR, internal only. */
  costBasisInr: number;
  /** Total markup percentage (overhead + contingency + profit). */
  markupPercent: number;
  /** Revenue target before tax, in INR. */
  targetRevenueInr: number;
  /** Revenue target before tax, in quote currency. */
  targetRevenue: number;

  /** Included sections in render order, amounts in quote currency. */
  sections: CommercialSummarySection[];
  /** Sum of included section amounts (quote currency). */
  sectionsSum: number;
  /** sectionsSum − targetRevenue. Zero when single-section auto-sync is in effect. */
  delta: number;
  /** True when |delta| exceeds rounding tolerance. */
  hasDelta: boolean;

  taxRate: number;
  taxLabel: string;
  /** Tax amount in quote currency. Always 0 for foreign quotes. */
  taxAmount: number;
  /** Grand total in quote currency. */
  total: number;
}

/**
 * Compute the customer-facing rollup. Returns `null` when the proposal
 * has no clientPricing record (very old drafts).
 */
export function computeCommercialSummary(proposal: Proposal): CommercialSummary | null {
  const cp = proposal.clientPricing;
  if (!cp) return null;

  const currency: CurrencyCode = cp.currency ?? 'INR';
  const fxRate = cp.fxRate ?? 1;
  const isForeignQuote = currency !== 'INR' && fxRate > 0;

  const costBasisInr = round2(
    (proposal.pricingBlocks ?? []).reduce((s, b) => s + (b.subtotal || 0), 0)
  );

  const markupPercent = round2(
    (cp.overheadPercent || 0) + (cp.contingencyPercent || 0) + (cp.profitPercent || 0)
  );
  const targetRevenueInr = round2(costBasisInr * (1 + markupPercent / 100));
  const targetRevenue = isForeignQuote ? round2(targetRevenueInr / fxRate) : targetRevenueInr;

  const included = (cp.priceSections ?? [])
    .filter((s) => s.included)
    .sort((a, b) => a.order - b.order)
    .map<CommercialSummarySection>((s) => ({
      id: s.id,
      title: s.title || 'Section',
      description: s.description,
      amount: round2(s.amount || 0),
    }));

  let sections = included;

  // Single-section auto-sync. The customer's one revenue line is the
  // target, regardless of what's saved. If the user wants a different
  // amount they add a second section and split.
  const lone = sections[0];
  if (sections.length === 1 && lone) {
    sections = [{ ...lone, amount: targetRevenue }];
  }

  const sectionsSum = round2(sections.reduce((s, sec) => s + sec.amount, 0));
  const delta = round2(sectionsSum - targetRevenue);
  const hasDelta = Math.abs(delta) > 0.01;

  // Tax applies to INR quotes only — Indian GST is zero-rated on
  // exports, so foreign quotes show no tax row and no GST disclosure
  // on the PDF.
  const taxRate = isForeignQuote ? 0 : cp.taxRate || 0;
  const taxLabel = cp.taxLabel || 'Tax';
  const taxAmount = round2((sectionsSum * taxRate) / 100);
  const total = round2(sectionsSum + taxAmount);

  return {
    currency,
    isForeignQuote,
    fxRate,
    costBasisInr,
    markupPercent,
    targetRevenueInr,
    targetRevenue,
    sections,
    sectionsSum,
    delta,
    hasDelta,
    taxRate,
    taxLabel,
    taxAmount,
    total,
  };
}
