/**
 * Shared helpers for the calculator → SSOT register generators.
 *
 * Extracted from `medDesignGenerator.ts` when the flash chamber gained its own
 * generator. They live here rather than being copied because a second copy of
 * `round()` or `satPressureMbar()` is exactly how two generators start
 * publishing the same quantity to different precision (CLAUDE.md rule 32).
 */

import type { SSOTProvenance, SSOTRecordSource, FluidType } from '@vapour/types';
import { MaterialCategory } from '@vapour/types';
import { getSaturationPressure } from '@vapour/constants';

/**
 * Pipe materials permitted for each fluid service, default first.
 *
 * **SS316L is the default on every service.** A uniform specification has worked
 * on previous projects and keeps procurement, welding procedures and spares to a
 * single grade. Material compatibility is properly a per-project review — driven
 * by chloride level, temperature and velocity — so the alternatives below are
 * offered per service and selected deliberately, never chosen by a generator.
 *
 * Grades and their line-number codes come from PIPE_MATERIAL_CODES in
 * @vapour/types — the canonical list — so codes never drift from the material
 * master.
 *
 * Lives here rather than in `medDesignGenerator` because the shared
 * GenerateSSOTDialog offers these choices for every calculator, not just MED.
 */
export const LINE_MATERIAL_OPTIONS: Record<FluidType, MaterialCategory[]> = {
  'DISTILLATE WATER': [
    MaterialCategory.PIPES_STAINLESS_316L,
    MaterialCategory.PIPES_STAINLESS_304L,
  ],
  'SEA WATER': [MaterialCategory.PIPES_STAINLESS_316L, MaterialCategory.PIPES_DUPLEX_2205],
  'BRINE WATER': [MaterialCategory.PIPES_STAINLESS_316L, MaterialCategory.PIPES_DUPLEX_2205],
  // Feed is deaerated seawater — same corrosivity family as the seawater side.
  'FEED WATER': [MaterialCategory.PIPES_STAINLESS_316L, MaterialCategory.PIPES_DUPLEX_2205],
  // Vapour ducts and the heating steam supply.
  STEAM: [MaterialCategory.PIPES_STAINLESS_316L, MaterialCategory.PIPES_STAINLESS_304L],
  NCG: [MaterialCategory.PIPES_STAINLESS_316L, MaterialCategory.PIPES_STAINLESS_304L],
  // ⚠ PROVISIONAL — awaiting the team's materials decision (plan §2.1, CP1).
  // Wet biogas carries H₂S, which with free water present is a sour service, so
  // this is a materials call rather than a default. 316L is offered alone
  // deliberately: a single conservative option cannot be mis-picked, whereas
  // offering carbon steel beside it would let the cheaper choice be made before
  // anyone has ruled on the H₂S partial pressure. Carbon steel with a corrosion
  // allowance, and HDPE for low-pressure buried mains, are the alternatives to
  // put to the team — neither is assumed here.
  BIOGAS: [MaterialCategory.PIPES_STAINLESS_316L],
};

/** Line-number fluid code per service */
export const FLUID_CODE: Record<FluidType, string> = {
  'SEA WATER': 'SW',
  'BRINE WATER': 'B',
  'DISTILLATE WATER': 'D',
  STEAM: 'S',
  NCG: 'NCG',
  'FEED WATER': 'F',
  BIOGAS: 'BG',
};

/** Leading digits of a DN designation, e.g. 'DN150' → '150' */
export function dnNumber(dn: string): string {
  const match = /(\d+)/.exec(dn);
  return match?.[1] ?? '000';
}

/** T/h → kg/s */
export function thToKgS(th: number): number {
  return (th * 1000) / 3600;
}

/** Round to a sensible number of decimals for stored engineering values */
export function round(value: number, decimals = 3): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Saturation pressure in mbar(a) at a given temperature */
export function satPressureMbar(tempC: number): number {
  return round(getSaturationPressure(tempC) * 1000, 2);
}

/** Internal volume of a cylinder from its inside diameter and length, m³ */
export function cylinderVolumeM3(idMM: number, lengthMM: number): number {
  const rM = idMM / 2000;
  return round(Math.PI * rM * rM * (lengthMM / 1000), 3);
}

/** Fields every generator's options object carries for provenance */
export interface GeneratorProvenanceOptions {
  /** Saved-calculation id the design came from */
  sourceCalculationId?: string;
  /** Human label for the source design, e.g. "8-effect MED, GOR 8.2" */
  sourceLabel?: string;
}

/**
 * Build the provenance stamp for a generated record.
 *
 * `source` is passed rather than defaulted so a new generator cannot silently
 * inherit `MED_DESIGN` and have its records refreshed by the wrong calculator.
 */
export function buildProvenance(
  source: SSOTRecordSource,
  options: GeneratorProvenanceOptions,
  generatedKey: string
): SSOTProvenance {
  return {
    source,
    generatedKey,
    ...(options.sourceCalculationId !== undefined && {
      sourceCalculationId: options.sourceCalculationId,
    }),
    ...(options.sourceLabel !== undefined && { sourceLabel: options.sourceLabel }),
  };
}
