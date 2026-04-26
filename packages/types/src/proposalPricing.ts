/**
 * Proposal Pricing Blocks (Stage 2)
 *
 * Pluggable building blocks that compose a proposal's pricing buildup.
 * A proposal carries an array of blocks; the array shape is determined by
 * the parent enquiry's `workComponents` at create time, then editable.
 *
 * Each block carries an `audience` so the same pricing data can drive both
 * the internal cost basis (INTERNAL) and the client-facing PDF (CLIENT/BOTH).
 *
 * See PROPOSALS-WORKFLOW-DESIGN-2026-04-25.md
 */

import type { CurrencyCode } from './common';

/**
 * Audience — who a pricing block is meant for.
 * INTERNAL blocks drive cost computation but are suppressed from the client PDF.
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
