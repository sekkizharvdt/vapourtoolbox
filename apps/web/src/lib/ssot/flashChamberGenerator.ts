/**
 * Flash Chamber → SSOT Generator
 *
 * Turns a completed flash chamber calculation into SSOT process registers:
 * one equipment record, its three streams, and the lines its nozzles imply.
 *
 * This is a PURE mapping function — no Firestore, no permissions, no I/O.
 * Persisting the output is the sync layer's job, exactly as for the MED bridge.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * `medDesignGenerator` leaves `liquidHoldupM3` and `elevationM` blank on every
 * item it writes, with a warning that they must be entered before the registers
 * can drive a dynamic simulation. They are blank because a MED design does not
 * fix an operating level — that is a vessel decision, and the flash chamber
 * calculator is the thing in this repo that makes it.
 *
 * It also covers the MED brine and distillate holdup drums, which are flash
 * chambers without heat transfer: last-effect brine falls into one, condenser
 * distillate into the other, and both are elevated to give the extraction pump
 * its NPSH margin.
 *
 * ── Holdup: which volume is published ────────────────────────────────────
 * `ChamberSizing.liquidHoldupVolume` is the RETENTION-ZONE volume, LG-L to
 * LG-H — the inventory the retention time buys. `ProcessEquipmentInput`'s
 * `liquidHoldupM3` is the NORMAL OPERATING holdup, measured from BTL up to the
 * operating level, which includes the heel below LG-L.
 *
 * They are not the same number. At the default 0.5 level ratio the operating
 * holdup is a little over half the retention volume — on the default case,
 * 2.109 m³ against 4.061 m³ — so publishing the retention volume under a field
 * that means operating holdup would overstate the liquid inventory by 93%,
 * very nearly a factor of two. That inflates a level or concentration time
 * constant directly, and a steady-state check cannot see it, so this file
 * computes the operating holdup from the elevations and reports the retention
 * volume separately rather than conflating them.
 */

import type {
  ProcessStreamInput,
  ProcessEquipmentInput,
  ProcessLineInput,
  FluidType,
  FlashChamberResult,
  NozzleSizing,
} from '@vapour/types';
import { MaterialCategory, PIPE_MATERIAL_CODES } from '@vapour/types';
import { getBrineSalinity } from '@vapour/constants';
import { enrichStreamInput } from './streamCalculations';
import {
  round,
  thToKgS,
  buildProvenance,
  cylinderVolumeM3,
  dnNumber,
  FLUID_CODE,
} from './generatorHelpers';

// ============================================================================
// Types
// ============================================================================

export interface FlashChamberSSOTGeneratorOptions {
  /** Saved-calculation id the design came from (stored as provenance) */
  sourceCalculationId?: string;
  /** Human label for the source, e.g. "Brine holdup drum, 60 °C" */
  sourceLabel?: string;
  /**
   * Equipment tag for the vessel. Defaults to `FC-01`. Stream tags are derived
   * from it, so two chambers in one project stay distinct.
   */
  equipmentTag?: string;
  /** Display name for the vessel. Defaults to "Flash Chamber". */
  equipmentName?: string;
  /**
   * Area/unit code used in generated line numbers (the "40" in
   * `200-40-SS316L-B-01`). Defaults to '00'.
   */
  areaCode?: string;
  /** Pipe material for the liquid service. Defaults to SS316L. */
  liquidMaterial?: MaterialCategory;
  /** Pipe material for the vapour service. Defaults to SS316L. */
  vapourMaterial?: MaterialCategory;
}

export interface FlashChamberSSOTGeneration {
  streams: ProcessStreamInput[];
  equipment: ProcessEquipmentInput[];
  lines: ProcessLineInput[];
  /** Things the calculation knows about but that must be entered by hand */
  warnings: string[];
}

const DEFAULT_EQUIPMENT_TAG = 'FC-01';
const DEFAULT_EQUIPMENT_NAME = 'Flash Chamber';
const DEFAULT_AREA_CODE = '00';

/**
 * The fluid the chamber holds.
 *
 * DM water flashes to distillate; seawater to brine. Flashing removes vapour,
 * it does not change the service, so one classification covers both the inlet
 * and the outlet liquid.
 */
function liquidFluidType(result: FlashChamberResult): FluidType {
  return result.inputs.waterType === 'DM_WATER' ? 'DISTILLATE WATER' : 'BRINE WATER';
}

// ============================================================================
// Generator
// ============================================================================

export function generateFlashChamberSSOT(
  result: FlashChamberResult,
  options: FlashChamberSSOTGeneratorOptions = {}
): FlashChamberSSOTGeneration {
  const warnings: string[] = [];

  const tag = options.equipmentTag ?? DEFAULT_EQUIPMENT_TAG;
  const name = options.equipmentName ?? DEFAULT_EQUIPMENT_NAME;
  const areaCode = options.areaCode ?? DEFAULT_AREA_CODE;
  const liquidMaterial = options.liquidMaterial ?? MaterialCategory.PIPES_STAINLESS_316L;
  const vapourMaterial = options.vapourMaterial ?? MaterialCategory.PIPES_STAINLESS_316L;

  const { inputs, heatMassBalance: hmb, chamberSizing: cs, elevations, nozzles } = result;

  const liquidFluid = liquidFluidType(result);
  const isDMWater = inputs.waterType === 'DM_WATER';

  // Outlet salinity is not carried on the result, so it is re-derived from the
  // published flows using the SAME shared salt balance the calculator uses
  // (getBrineSalinity in @vapour/constants) rather than a local reimplementation.
  const outletSalinity = isDMWater
    ? 0
    : getBrineSalinity(inputs.salinity, hmb.inlet.flowRate, hmb.vapor.flowRate);

  // ── Stream tags ────────────────────────────────────────────────────────
  const inletTag = `${tag}-IN`;
  const outletTag = `${tag}-OUT`;
  const vapourTag = `${tag}-VAP`;

  // ── Streams ────────────────────────────────────────────────────────────
  // Flows, temperatures and pressures come from the heat and mass balance rows
  // rather than being recomposed from inputs — the balance is what the rest of
  // the result was solved against, so any disagreement here would be a second
  // version of the same quantity.
  const streams: ProcessStreamInput[] = [
    enrichStreamInput({
      lineTag: inletTag,
      description: `Inlet water to ${name}`,
      fluidType: liquidFluid,
      flowRateKgS: round(thToKgS(hmb.inlet.flowRate), 4),
      pressureMbar: round(hmb.inlet.pressure, 2),
      temperature: round(hmb.inlet.temperature, 2),
      tds: round(inputs.salinity, 0),
      provenance: buildProvenance('FLASH_CHAMBER', options, `stream:${inletTag}`),
    }),
    enrichStreamInput({
      lineTag: outletTag,
      description: `Flashed water from ${name}`,
      fluidType: liquidFluid,
      flowRateKgS: round(thToKgS(hmb.brine.flowRate), 4),
      pressureMbar: round(hmb.brine.pressure, 2),
      // The liquid leaves at saturation PLUS the boiling point elevation; the
      // vapour leaves at saturation. Publishing one temperature for both is the
      // classic way a BPE gets lost between tools.
      temperature: round(hmb.brine.temperature, 2),
      tds: round(outletSalinity, 0),
      provenance: buildProvenance('FLASH_CHAMBER', options, `stream:${outletTag}`),
    }),
    enrichStreamInput({
      lineTag: vapourTag,
      description: `Flash vapour from ${name}`,
      fluidType: 'STEAM',
      flowRateKgS: round(thToKgS(hmb.vapor.flowRate), 4),
      pressureMbar: round(hmb.vapor.pressure, 2),
      temperature: round(hmb.vapor.temperature, 2),
      tds: 0,
      provenance: buildProvenance('FLASH_CHAMBER', options, `stream:${vapourTag}`),
    }),
  ];

  const streamsByTag = new Map(streams.map((s) => [s.lineTag, s]));

  // ── Equipment ──────────────────────────────────────────────────────────
  // Normal operating holdup: BTL up to the operating level. See the file header
  // for why this is not `cs.liquidHoldupVolume`.
  const operatingHoldupHeightM = elevations.operatingLevel - elevations.btl;
  const operatingHoldupM3 = round(cs.crossSectionArea * operatingHoldupHeightM, 3);

  // Gross volume is the tangent-to-tangent cylinder only, recomputed from the
  // published diameter and height so the register and the geometry it quotes
  // cannot drift apart.
  const grossVolumeM3 = cylinderVolumeM3(cs.diameter, cs.totalHeight);

  const equipment: ProcessEquipmentInput[] = [
    {
      equipmentName: name,
      equipmentTag: tag,
      equipmentType: 'FLASH_VESSEL',
      operatingPressure: round(hmb.brine.pressure, 2),
      // The vessel's process temperature is the liquid it holds (saturation +
      // BPE). The vapour temperature is carried on the vapour stream.
      operatingTemperature: round(hmb.brine.temperature, 2),
      fluidIn: [inletTag],
      fluidOut: [vapourTag, outletTag],
      shellIDmm: round(cs.diameter, 1),
      shellLengthMM: round(cs.totalHeight, 1),
      grossVolumeM3,
      liquidHoldupM3: operatingHoldupM3,
      // Bottom tangent line above FFL — the datum the extraction pump's static
      // head is measured from.
      elevationM: round(elevations.btl, 3),
      provenance: buildProvenance('FLASH_CHAMBER', options, `equipment:${tag}`),
    },
  ];

  // ── Lines ──────────────────────────────────────────────────────────────
  // One line per sized nozzle. The nozzle sizing already selected a standard
  // pipe size, so the line carries that size rather than being re-sized.
  const NOZZLE_ROUTE: Record<
    NozzleSizing['type'],
    { streamTag: string; fluid: FluidType; from?: string; to?: string }
  > = {
    inlet: { streamTag: inletTag, fluid: liquidFluid, to: tag },
    outlet: { streamTag: outletTag, fluid: liquidFluid, from: tag },
    vapor: { streamTag: vapourTag, fluid: 'STEAM', from: tag },
  };

  const lines: ProcessLineInput[] = [];
  let seq = 0;

  for (const nozzle of nozzles) {
    const route = NOZZLE_ROUTE[nozzle.type];
    const stream = streamsByTag.get(route.streamTag);
    if (!stream) {
      warnings.push(
        `Line for ${nozzle.name} references stream ${route.streamTag}, which was not generated — line skipped.`
      );
      continue;
    }

    const material = route.fluid === 'STEAM' ? vapourMaterial : liquidMaterial;
    const materialCode = PIPE_MATERIAL_CODES[material]?.[1] ?? 'SS';
    // DN (mm), not NPS (inches) — the MED bridge's line numbers lead with DN,
    // and the same field must not mean inches in one register and mm in another.
    const dn = dnNumber(nozzle.dn);

    lines.push({
      lineNumber: `${dn}-${areaCode}-${materialCode}-${FLUID_CODE[route.fluid]}-${String(++seq).padStart(2, '0')}`,
      fluid: route.fluid,
      inputDataTag: route.streamTag,
      // Flow and density come from the stream, not re-derived here — the stream
      // is the single source of truth and the two must not disagree.
      flowRateKgS: stream.flowRateKgS,
      density: round(stream.density ?? 0, 2),
      designVelocity: round(nozzle.actualVelocity, 3),
      // The nozzle sizing carries a real bore from the pipe schedule, so this is
      // the actual inside diameter in mm.
      selectedID: round(nozzle.actualID, 1),
      actualVelocity: round(nozzle.actualVelocity, 3),
      pipeSize: `NB${dn}`,
      ...(route.from !== undefined && { fromEquipmentTag: route.from }),
      ...(route.to !== undefined && { toEquipmentTag: route.to }),
      provenance: buildProvenance('FLASH_CHAMBER', options, `line:${route.streamTag}`),
    });
  }

  // ── What this generator deliberately does not publish ───────────────────
  warnings.push(
    `Retention-zone volume is ${round(cs.liquidHoldupVolume, 3)} m³ (LG-L to LG-H, from the ` +
      `${inputs.retentionTime} min retention time). The register carries the NORMAL OPERATING ` +
      `holdup of ${operatingHoldupM3} m³ instead, measured BTL to operating level. Use the ` +
      `operating figure for inventory and time constants; the retention volume is a sizing basis.`
  );

  warnings.push(
    `Gross volume ${grossVolumeM3} m³ is the tangent-to-tangent cylinder only — it excludes the ` +
      `dished ends, which this calculator does not size, so vapour space is understated.`
  );

  warnings.push(
    'Metal mass is blank: the flash chamber calculator carries no wall thickness or material, so ' +
      'there is no geometric basis for one. It must be entered before the register can carry a ' +
      'wall thermal mass.'
  );

  if (result.warnings.length > 0) {
    warnings.push(...result.warnings.map((w) => `Calculation warning: ${w}`));
  }

  return { streams, equipment, lines, warnings };
}
