/**
 * Proposal Costing & Pricing types (Stages 2 + 2.5)
 *
 * Two distinct concepts, on two distinct tabs:
 *
 * COSTING (internal) — `Proposal.pricingBlocks: PricingBlock[]`
 *   Pluggable building blocks that compose the proposal's internal cost
 *   basis: manpower roster, per-manday site costs, lump-sum costs, BOM
 *   cost sheet. The array shape is seeded from the parent enquiry's
 *   `workComponents` at create time, then editable. The Audience flag
 *   is retained for backwards compatibility but new entries are always
 *   internal — Costing is by definition never seen by the client.
 *
 * PRICING (client-facing) — `Proposal.clientPricing: ClientPricing`
 *   What the customer pays: markup % on the cost basis, plus client-
 *   facing lump-sum lines, plus tax. This is what renders on the PDF.
 *
 * See PROPOSALS-WORKFLOW-DESIGN-2026-04-25.md
 */

import type { CurrencyCode } from './common';

/**
 * Audience — retained for backwards compatibility with Stage 2 records.
 * In Stage 2.5+ all pricingBlocks are treated as INTERNAL regardless of
 * their stored audience; visibility is determined by the tab the data
 * lives on, not a per-block flag.
 *
 * @deprecated visibility is now driven by tab, not per-block
 */
export type Audience = 'CLIENT' | 'INTERNAL' | 'BOTH';

/**
 * Kinds of pricing block.
 */
export type PricingBlockKind =
  | 'MANPOWER_ROSTER' // people × days × day-rate
  | 'PER_MANDAY_COST' // site costs (accom, food, conveyance) × mandays
  | 'LUMP_SUM_LINES' // flat description + amount rows
  | 'BOM_COST_SHEET'; // links to estimation BOMs

/** Fields common to every block. */
export interface PricingBlockBase {
  id: string;
  label?: string; // Optional user label, e.g. "Site commissioning team"
  audience: Audience;
  currency: CurrencyCode; // Mirrors proposal.nativeCurrency
  subtotal: number; // Computed total of rows / linked BOMs
  notes?: string;
}

/* ─── Manpower roster ───────────────────────────────────────────────── */

export interface ManpowerRosterRow {
  id: string;
  role: string; // e.g. "Senior Mechanical Engineer"
  personName?: string; // optional named individual
  mandays: number;
  dayRate: number;
  total: number; // mandays × dayRate
  remarks?: string;
}

export interface ManpowerRosterBlock extends PricingBlockBase {
  kind: 'MANPOWER_ROSTER';
  rows: ManpowerRosterRow[];
}

/* ─── Per-manday costs (site costs) ─────────────────────────────────── */

export interface PerMandayCostRow {
  id: string;
  description: string; // e.g. "Accommodation", "Conveyance"
  mandays: number; // can be bound to a roster's total mandays
  ratePerManday: number;
  total: number; // mandays × ratePerManday
}

export interface PerMandayCostBlock extends PricingBlockBase {
  kind: 'PER_MANDAY_COST';
  rows: PerMandayCostRow[];
  /** Optional roster id whose mandays drive this block's row counts. */
  boundRosterId?: string;
}

/* ─── Lump-sum lines ────────────────────────────────────────────────── */

export interface LumpSumRow {
  id: string;
  description: string;
  amount: number;
}

export interface LumpSumLinesBlock extends PricingBlockBase {
  kind: 'LUMP_SUM_LINES';
  rows: LumpSumRow[];
}

/* ─── BOM cost sheet ────────────────────────────────────────────────── */

export interface BOMCostSheetBlock extends PricingBlockBase {
  kind: 'BOM_COST_SHEET';
  /** References to docs in the boms collection. Subtotal = sum of their totalCost. */
  linkedBomIds: string[];
}

/**
 * Discriminated union of all pricing blocks.
 * Use `kind` to narrow.
 */
export type PricingBlock =
  | ManpowerRosterBlock
  | PerMandayCostBlock
  | LumpSumLinesBlock
  | BOMCostSheetBlock;

/* ─── Pricing tab — client-facing pricing ─────────────────────────────── */

/**
 * A single client-facing lump-sum line on the Pricing tab.
 *
 * @deprecated Use {@link PriceSection} instead. Retained for read
 * compatibility with proposals authored before stage 2.5r.
 */
export interface PricingLumpSumRow {
  id: string;
  description: string;
  amount: number;
}

/**
 * One section on the customer-facing Commercial Summary. Each section
 * is a flat priced row the customer sees on the PDF. The Pricing tab
 * renders the list, the PDF sums them, applies tax (INR quotes only),
 * and prints the total.
 *
 * Single-section mode is special: when the included section list has
 * exactly one row, its amount auto-syncs to the cost-basis-times-markup
 * target. As soon as the user adds a second section, both amounts
 * become user-controlled and the editor surfaces a reconciliation
 * banner against the target.
 *
 * Examples on an EPC bid table:
 *   { title: "MED Process System",   amount: 5000000 }
 *   { title: "Solar Thermal System", amount: 2500000 }
 *   { title: "O&M for 1 year",       amount:  600000 }
 *
 * For a survey or single-deliverable proposal, one section is enough.
 */
export interface PriceSection {
  id: string;
  title: string;
  /** Optional fine-print line under the title. */
  description?: string;
  /**
   * Section amount in the proposal's *quote* currency (ClientPricing.currency).
   * For INR quotes this is INR; for foreign quotes (USD/EUR/…) this is
   * already converted — no further fxRate division happens at render time.
   */
  amount: number;
  /** Whether the section prints on the customer PDF. */
  included: boolean;
  /** 0-based render order; lower numbers print first. */
  order: number;
}

/**
 * The Pricing tab's full state. Stored on `Proposal.clientPricing`.
 *
 * Single source of truth: cost basis (INR, from Costing) × (1 + markup%)
 * = total revenue target. Convert to quote currency via fxRate. The
 * priceSections distribute that target across customer-facing rows.
 *
 *   Cost basis (INR, sum of pricingBlocks — internal-only)
 *     × (1 + overheadPercent + contingencyPercent + profitPercent)
 *     = Revenue target (INR)
 *     ÷ fxRate                        ← only if currency ≠ INR
 *     = Revenue target (quote currency)
 *
 *   priceSections (each amount stored in quote currency)
 *     sum = subtotal
 *     + tax (INR quotes only; foreign exports are zero-rated)
 *     = Total (quote currency)
 *
 * Single-section behaviour: when there is exactly one included section,
 * its amount auto-syncs to the revenue target so changing markup % flows
 * straight through to the customer PDF. As soon as a second section is
 * added, amounts become user-controlled and the editor shows the gap
 * between the target and the sum.
 */
export interface ClientPricing {
  // Markup % applied to cost basis (INR). Each percentage applies to
  // cost basis independently; the three sum to define the total markup.
  // Markup is internal context but it drives the customer-facing
  // section total via the revenue target.
  overheadPercent: number;
  contingencyPercent: number;
  profitPercent: number;

  /**
   * Customer-facing price sections (Stage 2.5r). Each section prints as
   * its own row in the Commercial Summary. For an EPC bid this lets
   * you split into "MED Process System" / "Solar Thermal System" /
   * "O&M 1 year" / etc.; for a survey, one section is enough.
   *
   * Amounts are in `currency` (the quote currency), not INR.
   */
  priceSections?: PriceSection[];

  /**
   * Schema version for priceSections.
   *   undefined or 1 = legacy. Section amounts were stored in INR
   *     regardless of quote currency; foreign-quote PDFs divided by
   *     fxRate at render time.
   *   2 = current. Section amounts are stored in the quote currency
   *     directly.
   * The PricingEditor and the shared computeCommercialSummary helper
   * migrate version-1 records on read (divide by fxRate when foreign);
   * the next save stamps version 2.
   */
  priceSectionsVersion?: number;

  /**
   * @deprecated Replaced by {@link priceSections}. Retained for read
   * compatibility with proposals authored before stage 2.5r — the
   * editor and PDF lift any non-empty `lumpSumLines` into sections on
   * first open.
   */
  lumpSumLines: PricingLumpSumRow[];

  // Tax
  taxRate: number; // percent, e.g. 18 for GST 18%
  taxLabel: string; // e.g. "GST 18%"

  // Quote currency — what the customer sees on the offer. Default INR.
  // When `currency !== 'INR'`, the final total is converted using `fxRate`.
  currency: CurrencyCode;

  /**
   * Snapshot conversion rate: how many INR equal 1 unit of `currency`.
   * For INR, fxRate is 1. For USD, fxRate is e.g. 92 (₹92 = $1).
   * Frozen at quote time — does not move with the market.
   */
  fxRate: number;
}
