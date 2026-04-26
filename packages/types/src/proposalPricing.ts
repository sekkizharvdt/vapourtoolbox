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
 * e.g. "MED Process System — supply, install, commission",
 *      "Admin charges", "Profit", "Mobilisation".
 */
export interface PricingLumpSumRow {
  id: string;
  description: string;
  amount: number;
}

/**
 * The Pricing tab's full state. Stored on `Proposal.clientPricing`.
 *
 * INR is the base currency for every input on this tab — internal costing,
 * markup percentages, lump-sum lines, and tax are all in INR. The
 * `currency` field is the *quote* currency the customer sees on the PDF;
 * if it's not INR, the final total (and only the final total) is converted
 * via `fxRate` at the very end. The conversion rate is captured at quote
 * time so the PDF doesn't shift as exchange rates move.
 *
 * Layout:
 *   Cost basis (INR, sum of pricingBlocks — never shown to client)
 *   + Overhead     (overheadPercent × cost basis)
 *   + Contingency  (contingencyPercent × cost basis)
 *   + Profit       (profitPercent × cost basis)
 *   + Lump-sum lines (each rendered as its own line on the PDF)
 *   = Subtotal (INR)
 *   + Tax (taxRate × subtotal)
 *   = Total (INR)
 *   ÷ fxRate
 *   = Total in `currency`
 */
export interface ClientPricing {
  // Markup % on cost basis (cost basis is INR)
  overheadPercent: number;
  contingencyPercent: number;
  profitPercent: number;

  // Client-facing lump-sum lines (amounts in INR, regardless of quote currency)
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
