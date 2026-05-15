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
 *
 * Tax handling: the user sets a tax rate and label. For INR quotes the
 * customer PDF prints a separate "Tax / GST" line. For foreign-currency
 * quotes with a non-zero rate (`rollTaxIntoSections === true`), the PDF
 * bakes the tax into each section's printed amount and suppresses the
 * tax line — the customer sees one rolled number per row plus a single
 * total in the quote currency.
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
  /** Tax amount in quote currency. */
  taxAmount: number;
  /** Grand total in quote currency. */
  total: number;
  /**
   * True when the customer PDF should bake tax into each section amount
   * and hide the separate Subtotal + Tax rows. Used for foreign-currency
   * export quotes where the customer sees a single rolled total, not a
   * line-item GST disclosure. For INR quotes this stays false and the
   * PDF prints the normal subtotal + tax + total breakdown.
   */
  rollTaxIntoSections: boolean;
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

  // Tax is whatever the user has set. Indian GST is typically zero-rated
  // on exports under LUT, but the user — not the helper — decides whether
  // to apply tax on a foreign-currency quote (place-of-supply rules,
  // missing LUT, destination-country VAT all have edge cases).
  const taxRate = cp.taxRate || 0;
  const taxLabel = cp.taxLabel || 'Tax';
  const taxAmount = round2((sectionsSum * taxRate) / 100);
  const total = round2(sectionsSum + taxAmount);
  const rollTaxIntoSections = isForeignQuote && taxRate > 0;

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
    rollTaxIntoSections,
  };
}
