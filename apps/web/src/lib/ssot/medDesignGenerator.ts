/**
 * MED Design → SSOT Generator
 *
 * Turns a completed MED designer result into the SSOT process registers:
 * streams, equipment and lines.
 *
 * This is a PURE mapping function — no Firestore, no permissions, no I/O.
 * Persisting the output (and merging it with records already in the project)
 * is `medDesignSync.ts`'s job.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * SSOT holds ~30 equipment items, ~200 lines and ~230 instruments per project.
 * Entering that by hand is what kept every project's registers empty. The MED
 * designer already computes the process conditions, geometry and pipe sizing,
 * so the registers can be generated from it instead.
 *
 * ── What this does NOT generate ──────────────────────────────────────────
 * Instruments and valves are template-driven, not physics-driven, and need an
 * instrumentation convention that doesn't exist yet. Auxiliary equipment
 * (pumps, ejectors, dosing skids) is reported as a warning rather than
 * generated, because the design result carries no operating pressure or
 * temperature for it and inventing those would put fabricated engineering
 * values into the register.
 *
 * ── Stream tag scheme ────────────────────────────────────────────────────
 * Prefixes follow LINE_TAG_FLUID_MAP in @vapour/types.
 *   S0            heating/motive steam to effect 1
 *   S1..Sn        vapour leaving effect 1..n
 *   B1..Bn        brine leaving effect 1..n
 *   BH            brine blowdown header
 *   D0            steam condensate return (effect 1 tube side)
 *   D1..Dn        distillate produced in effect 1..n
 *   DH / DP       distillate extraction header / product
 *   F1..Fn        spray feed to effect 1..n
 *   FH / FSH      feed water header / total spray header
 *   F-PH1..PHn    feed leaving preheater 1..n
 *   SW1/SW2/SW3   raw seawater to condenser / condenser outlet / reject
 */

import type {
  ProcessStreamInput,
  ProcessEquipmentInput,
  ProcessLineInput,
  FluidType,
  SSOTProvenance,
  EquipmentMetalMassDerivation,
} from '@vapour/types';
import { MaterialCategory, PIPE_MATERIAL_CODES } from '@vapour/types';
import { getSaturationPressure, METAL_PROPERTIES } from '@vapour/constants';
import { enrichStreamInput } from './streamCalculations';
import type { MEDDesignerResult, MEDDesignerEffect } from '../thermal/med/designerTypes';

// ============================================================================
// Types
// ============================================================================

/**
 * Pipe materials permitted for each fluid service, default first.
 *
 * **SS316L is the default on every service.** A uniform specification has worked
 * on previous projects and keeps procurement, welding procedures and spares to a
 * single grade. Material compatibility is properly a per-project review — driven
 * by chloride level, temperature and velocity — so the alternatives below are
 * offered per service and selected deliberately, never chosen by this generator.
 *
 * Grades and their line-number codes come from PIPE_MATERIAL_CODES in
 * @vapour/types — the canonical list — so codes never drift from the material
 * master.
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
};

export interface MEDSSOTGeneratorOptions {
  /** Saved-calculation id the design came from (stored as provenance) */
  sourceCalculationId?: string;
  /** Human label for the source design, e.g. "8-effect MED, GOR 8.2" */
  sourceLabel?: string;
  /**
   * Area/unit code used in generated line numbers (the "40" in
   * `200-40-SS316L-SW-01`). Defaults to '00'.
   */
  areaCode?: string;
  /**
   * Pipe material per fluid service. Anything not specified falls back to the
   * first entry of that fluid's LINE_MATERIAL_OPTIONS list.
   */
  materialByFluid?: Partial<Record<FluidType, MaterialCategory>>;
}

/** Line-number material code for a fluid service, e.g. 'SS316L', 'DX2205' */
function materialCodeFor(
  fluidType: FluidType,
  materialByFluid: Partial<Record<FluidType, MaterialCategory>>
): string {
  const category = materialByFluid[fluidType] ?? LINE_MATERIAL_OPTIONS[fluidType][0]!;
  return PIPE_MATERIAL_CODES[category]?.[1] ?? 'SS';
}

export interface MEDSSOTGeneration {
  streams: ProcessStreamInput[];
  equipment: ProcessEquipmentInput[];
  lines: ProcessLineInput[];
  /** Things the design knows about but that must be entered by hand */
  warnings: string[];
}

// ============================================================================
// Helpers
// ============================================================================

/** T/h → kg/s */
function thToKgS(th: number): number {
  return (th * 1000) / 3600;
}

/** Round to a sensible number of decimals for stored engineering values */
function round(value: number, decimals = 3): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Saturation pressure in mbar(a) at a given temperature */
function satPressureMbar(tempC: number): number {
  return round(getSaturationPressure(tempC) * 1000, 2);
}

/** Internal volume of a horizontal cylinder, m³ */
function cylinderVolumeM3(idMM: number, lengthMM: number): number {
  const rM = idMM / 2000;
  return round(Math.PI * rM * rM * (lengthMM / 1000), 3);
}

function provenanceFor(options: MEDSSOTGeneratorOptions, generatedKey: string): SSOTProvenance {
  return {
    source: 'MED_DESIGN',
    generatedKey,
    ...(options.sourceCalculationId !== undefined && {
      sourceCalculationId: options.sourceCalculationId,
    }),
    ...(options.sourceLabel !== undefined && { sourceLabel: options.sourceLabel }),
  };
}

/**
 * Salinity of the brine leaving an effect.
 *
 * Taken from the core solver's salt balance (`brineOutSalinity`), NOT re-derived
 * from spray and brine flows here — the designer's liquid balance includes
 * cascaded brine and recirculation, so a naive `S_spray × spray / brineOut`
 * gives the wrong answer.
 */
function brineSalinity(effect: MEDDesignerEffect, spraySalinityPpm: number): number {
  return effect.brineOutSalinity > 0 ? round(effect.brineOutSalinity, 0) : spraySalinityPpm;
}

// ============================================================================
// Streams
// ============================================================================

function buildStreams(
  result: MEDDesignerResult,
  options: MEDSSOTGeneratorOptions,
  warnings: string[]
): ProcessStreamInput[] {
  const streams: ProcessStreamInput[] = [];
  const { effects, condenser, preheaters, inputs } = result;

  const swSalinity = Number(inputs.resolvedDefaults.swSalinity ?? inputs.seawaterSalinity ?? 35000);
  const spraySalinity = result.spraySalinity;

  const add = (
    lineTag: string,
    description: string,
    fluidType: FluidType,
    flowTh: number,
    pressureMbar: number,
    temperature: number,
    tds?: number
  ) => {
    streams.push({
      lineTag,
      description,
      fluidType,
      flowRateKgS: round(thToKgS(flowTh), 4),
      pressureMbar: round(pressureMbar, 2),
      temperature: round(temperature, 2),
      ...(tds !== undefined && { tds: round(tds, 0) }),
      provenance: provenanceFor(options, `stream:${lineTag}`),
    });
  };

  // ── Heating steam and its condensate ───────────────────────────────────
  add(
    'S0',
    'Heating steam to Effect 1',
    'STEAM',
    inputs.steamFlow,
    satPressureMbar(inputs.steamTemperature),
    inputs.steamTemperature,
    0
  );
  add(
    'D0',
    'Steam condensate return from Effect 1',
    'DISTILLATE WATER',
    result.steamCondensateReturn,
    satPressureMbar(inputs.steamTemperature),
    inputs.steamTemperature,
    0
  );

  // ── Per-effect streams ─────────────────────────────────────────────────
  for (const e of effects) {
    const i = e.effect;

    add(
      `S${i}`,
      `Vapour from Effect ${i}`,
      'STEAM',
      e.distillateFlow + e.flashVapourFlow,
      e.pressure,
      e.vapourOutTemp,
      0
    );
    add(
      `B${i}`,
      `Brine from Effect ${i}`,
      'BRINE WATER',
      e.brineOutFlow,
      e.pressure,
      e.brineTemp,
      brineSalinity(e, spraySalinity)
    );
    // Distillate produced in effect i condenses the vapour that entered it,
    // so it leaves at the incoming vapour saturation temperature.
    add(
      `D${i}`,
      `Distillate from Effect ${i}`,
      'DISTILLATE WATER',
      e.distillateFlow,
      e.pressure,
      e.incomingVapourTemp,
      0
    );
    add(
      `F${i}`,
      `Spray feed to Effect ${i}`,
      'FEED WATER',
      e.minSprayFlow,
      e.pressure,
      e.sprayTemp,
      spraySalinity
    );
  }

  // ── Seawater side ──────────────────────────────────────────────────────
  add(
    'SW1',
    'Raw seawater to final condenser',
    'SEA WATER',
    condenser.seawaterFlow,
    1013.25,
    inputs.seawaterTemperature,
    swSalinity
  );
  add(
    'SW2',
    'Seawater from final condenser',
    'SEA WATER',
    condenser.seawaterFlow,
    1013.25,
    Number(inputs.resolvedDefaults.condenserSWOutlet ?? inputs.seawaterTemperature + 5),
    swSalinity
  );
  if (result.swReject > 0) {
    add(
      'SW3',
      'Seawater reject to outfall',
      'SEA WATER',
      result.swReject,
      1013.25,
      Number(inputs.resolvedDefaults.condenserSWOutlet ?? inputs.seawaterTemperature + 5),
      swSalinity
    );
  }

  // ── Preheater feed outlets ─────────────────────────────────────────────
  for (const ph of preheaters) {
    add(
      `F-PH${ph.id}`,
      `Feed from Preheater ${ph.id} (vapour from ${ph.vapourSource})`,
      'FEED WATER',
      ph.flowTh,
      satPressureMbar(ph.vapourTemp),
      ph.swOutlet,
      spraySalinity
    );
  }

  // ── Headers ────────────────────────────────────────────────────────────
  add(
    'FH',
    'Feed water header (make-up)',
    'FEED WATER',
    result.makeUpFeed,
    1013.25,
    Number(inputs.resolvedDefaults.condenserSWOutlet ?? inputs.seawaterTemperature + 5),
    swSalinity
  );
  add(
    'FSH',
    'Total spray header',
    'FEED WATER',
    effects.reduce((s, e) => s + e.minSprayFlow, 0),
    effects[0]?.pressure ?? 1013.25,
    effects[0]?.sprayTemp ?? inputs.seawaterTemperature,
    spraySalinity
  );
  const lastEffect = effects[effects.length - 1];
  add(
    'BH',
    'Brine blowdown header',
    'BRINE WATER',
    result.brineBlowdown,
    lastEffect?.pressure ?? 1013.25,
    lastEffect?.brineTemp ?? inputs.seawaterTemperature,
    lastEffect ? brineSalinity(lastEffect, spraySalinity) : spraySalinity
  );
  add(
    'DH',
    'Distillate extraction header',
    'DISTILLATE WATER',
    lastEffect?.accumDistillateFlow ?? result.totalDistillate,
    lastEffect?.pressure ?? 1013.25,
    lastEffect?.incomingVapourTemp ?? inputs.seawaterTemperature,
    0
  );
  add(
    'DP',
    'Distillate product to storage',
    'DISTILLATE WATER',
    result.totalDistillate,
    1013.25,
    lastEffect?.incomingVapourTemp ?? inputs.seawaterTemperature,
    0
  );

  if (spraySalinity <= 0) {
    warnings.push(
      'Design reported a spray salinity of zero — brine and feed stream TDS values will need checking.'
    );
  }

  return streams;
}

// ============================================================================
// Equipment
// ============================================================================

/**
 * Expand a shell weight estimate into the derivation the dynamic simulator asks
 * for: components rather than a total, and the basis of each.
 *
 * `estimateShellWeight` hardcodes the shell density to duplex regardless of the
 * material selected — recorded in `caveats` rather than silently corrected here,
 * because changing it moves every shell weight and therefore the BOM and cost
 * estimates. Flagged so a consumer is not misled, and so the fix is a deliberate
 * decision rather than a side effect of this export.
 */
function metalMassDerivation(
  weight: {
    shell: number;
    dishedHeads: number;
    tubeSheets: number;
    tubes: number;
    waterBoxes: number;
    internals: number;
  },
  wallThicknessMm: number,
  wallThicknessSource: EquipmentMetalMassDerivation['wallThicknessSource']
): EquipmentMetalMassDerivation {
  return {
    basis: 'component-breakdown',
    material: 'duplex_2205',
    materialLabel: METAL_PROPERTIES.duplex_2205.label,
    densityKgM3: METAL_PROPERTIES.duplex_2205.densityKgM3,
    wallThicknessMm,
    wallThicknessSource,
    componentsKg: {
      shell: weight.shell,
      dishedHeads: weight.dishedHeads,
      tubeSheets: weight.tubeSheets,
      tubes: weight.tubes,
      waterBoxes: weight.waterBoxes,
      internals: weight.internals,
    },
    computedFromGeometry: ['shell', 'dishedHeads', 'tubeSheets', 'tubes'],
    percentageAllowances: [
      { component: 'waterBoxes', percentOfShell: 15 },
      { component: 'internals', percentOfShell: 10 },
    ],
    excludes: ['support saddles or skirt', 'nozzles', 'manways', 'flange pairs', 'insulation'],
    caveats: [
      'Shell, heads and tubesheets use DUPLEX density (7,800 kg/m³) regardless of the material ' +
        'selected elsewhere — a hardcode in estimateShellWeight, not a material decision.',
      '"waterBoxes" is inherited shell-and-tube terminology, NOT a description of contents. ' +
        'On a MED effect the tube side carries condensing STEAM, so these are steam chests and ' +
        'condensate boxes — there is no cooling water in a MED effect anywhere. That metal is ' +
        'not touching the brine, but it is on the heating path rather than thermally isolated. ' +
        'Genuine seawater water boxes exist on the CONDENSER, which carries no breakdown at all.',
      'waterBoxes and internals are percentage allowances on shell weight, not computed parts.',
      'Wall thickness on a vacuum vessel is set by external-pressure buckling, which this repo ' +
        'does not calculate. Treat an "assumed" source as a placeholder, not a design value.',
    ],
  };
}

/**
 * Derivation for a mass that came from a kg/m² rule of thumb rather than
 * geometry — the condenser (50 kg/m²) and preheaters (60 kg/m²).
 *
 * Published as its own basis so a consumer cannot mistake a budgetary weight
 * allowance for a computed metal mass. There is no thickness, no material and no
 * geometry behind these figures.
 */
function arealAllowanceDerivation(
  kgPerM2: number,
  areaM2: number,
  service: string
): EquipmentMetalMassDerivation {
  return {
    basis: 'areal-allowance',
    material: 'unspecified',
    materialLabel: 'Not specified by the estimate',
    densityKgM3: 0,
    wallThicknessMm: 0,
    wallThicknessSource: 'assumed',
    kgPerM2,
    appliedToAreaM2: round(areaM2, 2),
    excludes: [],
    caveats: [
      `${service} mass is a budgetary allowance of ${kgPerM2} kg per m² of heat transfer area. ` +
        'It is NOT a geometric calculation: no thickness, material or component breakdown exists ' +
        'behind it. Do not use it as a thermal mass without substituting a real estimate.',
    ],
  };
}

function buildEquipment(
  result: MEDDesignerResult,
  options: MEDSSOTGeneratorOptions,
  warnings: string[]
): ProcessEquipmentInput[] {
  const equipment: ProcessEquipmentInput[] = [];
  const { effects, condenser, preheaters, weightEstimate, inputs } = result;

  const shellThickness = Number(inputs.resolvedDefaults.shellThickness ?? 8);
  // 'user-input' when the designer supplied one, otherwise the 8 mm default —
  // which is an assumption, and labelled as such so a consumer does not read it
  // as a design value. See ASSUMED_VESSEL_WALL_THICKNESS_MM for the separate
  // 6 mm figure agreed for the dynamic simulator; the two are NOT reconciled.
  const thicknessSource: EquipmentMetalMassDerivation['wallThicknessSource'] =
    inputs.resolvedDefaults.shellThickness !== undefined ? 'user-input' : 'assumed';

  // ── Evaporator effects ─────────────────────────────────────────────────
  effects.forEach((e, idx) => {
    const shellID = e.shellODmm - 2 * shellThickness;
    const shellWeight = weightEstimate?.evaporatorShells?.[idx];

    equipment.push({
      equipmentName: `MED Evaporator Effect ${e.effect}`,
      equipmentTag: `MED-E${e.effect}`,
      equipmentType: 'EVAPORATOR_EFFECT',
      operatingPressure: round(e.pressure, 2),
      operatingTemperature: round(e.brineTemp, 2),
      // Effect 1 is heated by live steam; every later effect by the previous
      // effect's vapour.
      fluidIn: [e.effect === 1 ? 'S0' : `S${e.effect - 1}`, `F${e.effect}`],
      fluidOut: [`S${e.effect}`, `B${e.effect}`, `D${e.effect}`],
      shellIDmm: round(shellID, 1),
      shellLengthMM: round(e.shellLengthMM, 1),
      grossVolumeM3: cylinderVolumeM3(shellID, e.shellLengthMM),
      heatTransferAreaM2: round(e.installedArea, 2),
      ...(shellWeight?.total !== undefined && {
        metalMassKg: round(shellWeight.total, 0),
        metalMassDerivation: metalMassDerivation(shellWeight, shellThickness, thicknessSource),
      }),
      provenance: provenanceFor(options, `equipment:MED-E${e.effect}`),
    });
  });

  // ── Final condenser ────────────────────────────────────────────────────
  const condShellID = condenser.shellODmm - 2 * shellThickness;
  const lastEffectNo = effects.length;
  equipment.push({
    equipmentName: 'Final Condenser',
    equipmentTag: 'MED-COND',
    equipmentType: 'CONDENSER',
    operatingPressure: satPressureMbar(condenser.vapourTemp),
    operatingTemperature: round(condenser.vapourTemp, 2),
    fluidIn: [`S${lastEffectNo}`, 'SW1'],
    fluidOut: ['SW2', 'DH'],
    shellIDmm: round(condShellID, 1),
    shellLengthMM: round(condenser.tubeLengthMM, 1),
    grossVolumeM3: cylinderVolumeM3(condShellID, condenser.tubeLengthMM),
    heatTransferAreaM2: round(condenser.designArea, 2),
    ...(weightEstimate?.condenserWeight !== undefined && {
      metalMassKg: round(weightEstimate.condenserWeight, 0),
      metalMassDerivation: arealAllowanceDerivation(50, condenser.designArea, 'Final condenser'),
    }),
    provenance: provenanceFor(options, 'equipment:MED-COND'),
  });

  // ── Preheaters ─────────────────────────────────────────────────────────
  // The design reports one lumped preheater weight, so per-unit metal mass is
  // left blank rather than guessed by dividing it.
  preheaters.forEach((ph) => {
    const phShellID = ph.shellODmm - 2 * shellThickness;
    equipment.push({
      equipmentName: `Feed Preheater ${ph.id} (vapour from ${ph.vapourSource})`,
      equipmentTag: `MED-PH${ph.id}`,
      equipmentType: 'PREHEATER',
      operatingPressure: satPressureMbar(ph.vapourTemp),
      operatingTemperature: round(ph.vapourTemp, 2),
      fluidIn: ['FH'],
      fluidOut: [`F-PH${ph.id}`],
      shellIDmm: round(phShellID, 1),
      shellLengthMM: round(ph.tubeLengthMM, 1),
      grossVolumeM3: cylinderVolumeM3(phShellID, ph.tubeLengthMM),
      heatTransferAreaM2: round(ph.designArea, 2),
      provenance: provenanceFor(options, `equipment:MED-PH${ph.id}`),
    });
  });

  if (preheaters.length > 0 && weightEstimate?.preheatersWeight) {
    warnings.push(
      `Preheater metal mass left blank: the design reports one combined figure ` +
        `(${Math.round(weightEstimate.preheatersWeight)} kg) for all ${preheaters.length} units.`
    );
  }

  // ── Auxiliary equipment — reported, not generated ──────────────────────
  const pumps = result.auxiliaryEquipment?.pumps ?? [];
  if (pumps.length > 0) {
    warnings.push(
      `${pumps.length} pump(s) sized by the design (${pumps
        .map((p) => p.service)
        .join(', ')}) were not added: the design carries no operating pressure ` +
        `or temperature for them, so they need entering by hand.`
    );
  }
  if (result.vacuumSystem) {
    warnings.push(
      'Vacuum system equipment (ejectors / LRVP) was not added — it needs entering by hand.'
    );
  }
  if (result.dosing) {
    warnings.push('Chemical dosing skids were not added — they need entering by hand.');
  }

  warnings.push(
    'Liquid holdup is blank on every item: it follows from the operating level, ' +
      'which is an operating decision rather than a design output. It must be ' +
      'entered before the registers can drive a dynamic simulation.'
  );

  return equipment;
}

// ============================================================================
// Lines
// ============================================================================

/** Header line services → the stream tag each one carries */
const HEADER_SERVICE_STREAM_MAP: Record<string, string> = {
  'Seawater to Condenser': 'SW1',
  'Feed Water Header': 'FH',
  'Distillate Extraction Header': 'DH',
  'Distillate Product': 'DP',
  'Steam Condensate Return': 'D0',
  'Brine Blowdown Header': 'BH',
  'Spray Header (total)': 'FSH',
};

/** Header line services → the equipment tags they run between */
const HEADER_SERVICE_ROUTE_MAP: Record<string, { from?: string; to?: string }> = {
  'Seawater to Condenser': { to: 'MED-COND' },
  'Feed Water Header': { from: 'MED-COND' },
  'Distillate Extraction Header': { from: 'MED-COND' },
  'Distillate Product': { from: 'MED-COND' },
  'Steam Condensate Return': { from: 'MED-E1' },
  'Brine Blowdown Header': {},
  'Spray Header (total)': {},
};

const FLUID_CODE: Record<FluidType, string> = {
  'SEA WATER': 'SW',
  'BRINE WATER': 'B',
  'DISTILLATE WATER': 'D',
  STEAM: 'S',
  NCG: 'NCG',
  'FEED WATER': 'F',
};

/** Fluid type implied by a generated stream tag */
function fluidForStreamTag(tag: string): FluidType {
  if (tag.startsWith('SW')) return 'SEA WATER';
  if (tag.startsWith('NCG')) return 'NCG';
  if (tag.startsWith('B')) return 'BRINE WATER';
  if (tag.startsWith('D')) return 'DISTILLATE WATER';
  if (tag.startsWith('F')) return 'FEED WATER';
  return 'STEAM';
}

/** Numeric DN from a "DN200"/"NB200"/"200" style label */
function dnNumber(dn: string): string {
  const match = /(\d+)/.exec(dn);
  return match?.[1] ?? '000';
}

function buildLines(
  result: MEDDesignerResult,
  options: MEDSSOTGeneratorOptions,
  streamsByTag: Map<string, ProcessStreamInput>,
  warnings: string[]
): ProcessLineInput[] {
  const lines: ProcessLineInput[] = [];
  const areaCode = options.areaCode ?? '00';
  const materialByFluid = options.materialByFluid ?? {};
  const lineSizing = result.auxiliaryEquipment?.lineSizing ?? [];
  const nozzles = result.auxiliaryEquipment?.nozzleSchedule?.nozzles ?? [];

  let seq = 0;
  const nextSeq = () => String(++seq).padStart(2, '0');

  const add = (
    streamTag: string,
    description: string,
    dn: string,
    velocity: number,
    route: { from?: string; to?: string }
  ) => {
    const fluidType = fluidForStreamTag(streamTag);
    const stream = streamsByTag.get(streamTag);
    if (!stream) {
      warnings.push(
        `Line "${description}" references stream ${streamTag}, which was not generated — line skipped.`
      );
      return;
    }
    const dnNum = dnNumber(dn);
    const materialCode = materialCodeFor(fluidType, materialByFluid);

    lines.push({
      lineNumber: `${dnNum}-${areaCode}-${materialCode}-${FLUID_CODE[fluidType]}-${nextSeq()}`,
      fluid: fluidType,
      inputDataTag: streamTag,
      // Flow and density come from the stream, not the sizing record — the
      // stream is the single source of truth and the two must not disagree.
      flowRateKgS: stream.flowRateKgS,
      density: round(stream.density ?? 0, 2),
      designVelocity: round(velocity, 3),
      selectedID: Number(dnNum),
      actualVelocity: round(velocity, 3),
      pipeSize: `NB${dnNum}`,
      ...(route.from !== undefined && { fromEquipmentTag: route.from }),
      ...(route.to !== undefined && { toEquipmentTag: route.to }),
      provenance: provenanceFor(options, `line:${streamTag}:${route.from ?? ''}>${route.to ?? ''}`),
    });
  };

  // ── Header lines ───────────────────────────────────────────────────────
  for (const ls of lineSizing) {
    const streamTag = HEADER_SERVICE_STREAM_MAP[ls.service];
    if (!streamTag) {
      warnings.push(`Line service "${ls.service}" has no stream mapping — line not generated.`);
      continue;
    }
    add(streamTag, ls.service, ls.dn, ls.velocity, HEADER_SERVICE_ROUTE_MAP[ls.service] ?? {});
  }

  // ── Per-effect shell nozzles ───────────────────────────────────────────
  const effectCount = result.effects.length;
  for (const nz of nozzles) {
    const effTag = `MED-E${nz.effect}`;
    let streamTag: string;
    let route: { from?: string; to?: string };

    switch (nz.service) {
      case 'vapour_inlet':
        // The vapour inlet of effect i and the vapour outlet of effect i-1 are
        // the same physical line. Only effect 1's inlet is a distinct line (the
        // heating steam supply), so skip the rest to avoid duplicates.
        if (nz.effect !== 1) continue;
        streamTag = 'S0';
        route = { to: effTag };
        break;
      case 'vapour_outlet':
        streamTag = `S${nz.effect}`;
        route = {
          from: effTag,
          to: nz.effect === effectCount ? 'MED-COND' : `MED-E${nz.effect + 1}`,
        };
        break;
      case 'brine_inlet':
        streamTag = `F${nz.effect}`;
        route = { to: effTag };
        break;
      case 'brine_outlet':
        streamTag = `B${nz.effect}`;
        route = {
          from: effTag,
          ...(nz.effect < effectCount && { to: `MED-E${nz.effect + 1}` }),
        };
        break;
      case 'distillate_outlet':
        streamTag = `D${nz.effect}`;
        route = {
          from: effTag,
          ...(nz.effect < effectCount && { to: `MED-E${nz.effect + 1}` }),
        };
        break;
      case 'vent':
        // NCG vents have no generated stream — skip rather than dangle a
        // reference to a stream that does not exist.
        continue;
      default:
        continue;
    }

    add(streamTag, `Effect ${nz.effect} ${nz.service}`, nz.dn, nz.velocity, route);
  }

  if (lineSizing.length === 0 && nozzles.length === 0) {
    warnings.push(
      'The design carried no line sizing or nozzle schedule, so no lines were generated.'
    );
  }

  return lines;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate SSOT stream, equipment and line records from a completed MED design.
 *
 * Pure — safe to call for a preview before the user commits anything.
 */
export function generateSSOTFromMEDDesign(
  result: MEDDesignerResult,
  options: MEDSSOTGeneratorOptions = {}
): MEDSSOTGeneration {
  const warnings: string[] = [];

  // Enrich with density/enthalpy/Cp/viscosity using the same helper the stream
  // service uses on write, so the generated lines can carry real densities and
  // the preview shows the values that will actually be stored.
  const streams = buildStreams(result, options, warnings).map(enrichStreamInput);
  const equipment = buildEquipment(result, options, warnings);

  const streamsByTag = new Map(streams.map((s) => [s.lineTag, s]));
  const lines = buildLines(result, options, streamsByTag, warnings);

  return { streams, equipment, lines, warnings };
}
