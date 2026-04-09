/**
 * MED Plant Bill of Materials Generator
 *
 * Generates a complete BOM for an MED plant from the design result,
 * including equipment, instrumentation, valves, and piping.
 *
 * Uses the shape database for fabricated components (shells, heads,
 * tube sheets, nozzles) and standard catalogues for bought-out items
 * (valves, instruments, pumps, strainers).
 *
 * Material weights include wastage allowances:
 * - Plates/shells: +10% cutting waste
 * - Tubes: +3% handling/damage allowance
 * - Grommets: +5% installation allowance
 */

import {
  generateInstrumentAccessories,
  type InstrumentPoint,
  type InstrumentAccessoryBOM,
} from './instrumentAccessoryGenerator';

import type { MEDDesignerResult } from './medDesigner';

// ============================================================================
// Types
// ============================================================================

export interface MEDBOMItem {
  /** Hierarchical item number (e.g., "1.2.3") */
  itemNumber: string;
  /** Category for grouping */
  category: MEDBOMCategory;
  /** Description */
  description: string;
  /** Tag number (e.g., "E-101", "TT-201") */
  tagNumber: string;
  /** Quantity */
  quantity: number;
  /** Unit (nos, kg, m, m², sets) */
  unit: string;
  /** Material of construction */
  material: string;
  /** Specification / standard */
  specification: string;
  /** Net weight per piece (kg) */
  netWeightKg: number;
  /** Wastage percentage */
  wastagePercent: number;
  /** Gross weight per piece (kg) = net × (1 + wastage) */
  grossWeightKg: number;
  /** Total gross weight (kg) = gross × quantity */
  totalWeightKg: number;
  /** Dimensions or size description */
  size: string;
  /** Parent item number (for sub-assemblies) */
  parentItem?: string;
  /** Shape type from shape database (if fabricated) */
  shapeType?: string;
  /** Notes */
  notes?: string;
}

export type MEDBOMCategory =
  | 'EVAPORATOR'
  | 'CONDENSER'
  | 'PREHEATER'
  | 'PIPING'
  | 'PUMP'
  | 'VALVE'
  | 'INSTRUMENT'
  | 'TANK'
  | 'ELECTRICAL'
  | 'MISCELLANEOUS';

export interface MEDInstrumentItem {
  tagNumber: string;
  type: 'TT' | 'PT' | 'FT' | 'LT' | 'LS' | 'AT' | 'CT'; // Temp, Pressure, Flow, Level, Level Switch, Analyser, Conductivity
  service: string;
  location: string;
  range: string;
  connection: string;
  material: string;
  notes?: string;
}

export interface MEDValveItem {
  tagNumber: string;
  type: 'GATE' | 'GLOBE' | 'BALL' | 'BUTTERFLY' | 'CHECK' | 'NRV';
  size: string; // DN
  rating: string;
  material: string;
  service: string;
  location: string;
  actuator?: string;
  notes?: string;
}

export interface MEDCompleteBOM {
  equipment: MEDBOMItem[];
  instruments: MEDInstrumentItem[];
  valves: MEDValveItem[];
  /** Instrument accessories BOM (thermowells, cable glands, cables, ferrules, JBs, I/O) */
  instrumentAccessories?: InstrumentAccessoryBOM;
  summary: {
    totalEquipmentItems: number;
    totalInstruments: number;
    totalValves: number;
    totalWeight: number; // kg
    categories: { category: MEDBOMCategory; items: number; weight: number }[];
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Material densities in kg/m³ */
const DENSITY = {
  DUPLEX_SS: 7800,
  SS316L: 7960,
  AL_5052: 2680,
  TI_GR2: 4510,
  RUBBER: 1200,
  SS316_MESH: 800, // wire mesh bulk density
};

/** Wastage allowances */
const WASTAGE = {
  PLATE: 0.1, // 10% cutting waste
  TUBE: 0.03, // 3% handling/damage
  GROMMET: 0.05, // 5% installation
  NOZZLE: 0.05, // 5%
  PIPE: 0.08, // 8% cutting/fitting
  DEMISTER: 0.02, // 2%
  STANDARD: 0.0, // bought-out items, no wastage
};

// ============================================================================
// Weight Calculation Helpers
// ============================================================================

/** Cylindrical shell weight (kg) */
function shellWeight(od_mm: number, thk_mm: number, length_mm: number, density: number): number {
  const r_outer = od_mm / 2 / 1000; // m
  const r_inner = (od_mm / 2 - thk_mm) / 1000; // m
  const volume = Math.PI * (r_outer * r_outer - r_inner * r_inner) * (length_mm / 1000); // m³
  return volume * density;
}

/** 2:1 Semi-ellipsoidal head weight (kg) — ASME UG-32(d) */
function ellipsoidalHeadWeight(od_mm: number, thk_mm: number, density: number): number {
  // Approximate: surface area ≈ 1.084 × π × (D/2)²
  // Volume of metal ≈ surface area × thickness
  const D = od_mm / 1000; // m
  const t = thk_mm / 1000;
  const surfaceArea = 1.084 * Math.PI * (D / 2) * (D / 2);
  return surfaceArea * t * density;
}

/** Tube sheet weight (kg) — circular plate */
function tubeSheetWeight(od_mm: number, thk_mm: number, density: number): number {
  const A = Math.PI * (od_mm / 2 / 1000) ** 2; // m²
  return A * (thk_mm / 1000) * density;
}

/** Single tube weight (kg) */
function tubeWeight(od_mm: number, wall_mm: number, length_mm: number, density: number): number {
  const r_outer = od_mm / 2 / 1000;
  const r_inner = (od_mm / 2 - wall_mm) / 1000;
  const volume = Math.PI * (r_outer * r_outer - r_inner * r_inner) * (length_mm / 1000);
  return volume * density;
}

/** Grommet weight (kg) — rubber ring */
function grommetWeight(holeDia_mm: number, tubeDia_mm: number): number {
  // Approximate as a ring: OD = hole, ID = tube, height ≈ 15mm
  const r_outer = holeDia_mm / 2 / 1000;
  const r_inner = tubeDia_mm / 2 / 1000;
  const height = 0.015; // 15mm typical
  return Math.PI * (r_outer * r_outer - r_inner * r_inner) * height * DENSITY.RUBBER;
}

// ============================================================================
// BOM Generator
// ============================================================================

/**
 * Generate a complete Bill of Materials for an MED plant.
 *
 * @param result MED design result from designMED()
 * @returns Complete BOM with equipment, instruments, and valves
 */
export function generateMEDBOM(result: MEDDesignerResult): MEDCompleteBOM {
  const equipment: MEDBOMItem[] = [];
  const instruments: MEDInstrumentItem[] = [];
  const valves: MEDValveItem[] = [];

  const nEff = result.effects.length;
  const shellThk = 8; // mm
  const tubeSheetThk = 8; // mm
  const tubeOD = result.inputs.tubeOD ?? 25.4;
  const tubeWall = result.inputs.tubeWallThickness ?? 1.0;
  const holeDia = 28.4; // grommet hole
  const tiTubeOD = 17; // condenser/PH tubes
  const tiTubeWall = 0.4;

  // Item numbering is done per-section (1.x for evap, 2.x for condenser, etc.)

  // ── EVAPORATOR EFFECTS ──────────────────────────────────────────────
  for (let i = 0; i < nEff; i++) {
    const e = result.effects[i]!;
    const effTag = `E-${(i + 1).toString().padStart(2, '0')}`;
    const shellOD = e.shellODmm;
    const shellLen = e.shellLengthMM;
    const prefix = `1.${i + 1}`;

    // 1. Cylindrical Shell
    const sw = shellWeight(shellOD, shellThk, shellLen, DENSITY.DUPLEX_SS);
    equipment.push({
      itemNumber: `${prefix}.1`,
      category: 'EVAPORATOR',
      description: `Evaporator Shell ${effTag}`,
      tagNumber: effTag,
      quantity: 1,
      unit: 'nos',
      material: 'Duplex SS UNS S32304',
      specification: 'SA 240',
      netWeightKg: Math.round(sw),
      wastagePercent: WASTAGE.PLATE * 100,
      grossWeightKg: Math.round(sw * (1 + WASTAGE.PLATE)),
      totalWeightKg: Math.round(sw * (1 + WASTAGE.PLATE)),
      size: `OD ${shellOD}mm × ${shellLen}mm L × ${shellThk}mm thk`,
      shapeType: 'CYLINDRICAL_SHELL',
    });

    // 2. Dished Heads (2:1 SE) — 2 per effect (unless shared between effects)
    const headCount = i === 0 ? 1 : i === nEff - 1 ? 1 : 0; // only first and last get heads
    if (headCount > 0) {
      const hw = ellipsoidalHeadWeight(shellOD, shellThk, DENSITY.DUPLEX_SS);
      equipment.push({
        itemNumber: `${prefix}.2`,
        category: 'EVAPORATOR',
        description: `2:1 SE Dished Head for ${effTag}`,
        tagNumber: `${effTag}-HEAD`,
        quantity: headCount,
        unit: 'nos',
        material: 'Duplex SS UNS S32304',
        specification: 'SA 240, ASME UG-32(d)',
        netWeightKg: Math.round(hw),
        wastagePercent: WASTAGE.PLATE * 100,
        grossWeightKg: Math.round(hw * (1 + WASTAGE.PLATE)),
        totalWeightKg: Math.round(hw * (1 + WASTAGE.PLATE) * headCount),
        size: `OD ${shellOD}mm × ${shellThk}mm thk`,
        shapeType: 'HEAD_ELLIPSOIDAL',
      });
    }

    // 3. Tube Sheets — 2 per effect
    const tsw = tubeSheetWeight(shellOD, tubeSheetThk, DENSITY.DUPLEX_SS);
    equipment.push({
      itemNumber: `${prefix}.3`,
      category: 'EVAPORATOR',
      description: `Tube Sheet for ${effTag}`,
      tagNumber: `${effTag}-TS`,
      quantity: 2,
      unit: 'nos',
      material: 'Duplex SS UNS S32304',
      specification: 'SA 240',
      netWeightKg: Math.round(tsw),
      wastagePercent: WASTAGE.PLATE * 100,
      grossWeightKg: Math.round(tsw * (1 + WASTAGE.PLATE)),
      totalWeightKg: Math.round(tsw * (1 + WASTAGE.PLATE) * 2),
      size: `OD ${shellOD}mm × ${tubeSheetThk}mm thk`,
      shapeType: 'TUBE_SHEET',
      notes: 'With vapour cutout on right half',
    });

    // 4. Al 5052 Tubes (main bundle)
    const mainTubes = Math.max(0, e.tubes - 3 * 27); // subtract top 3 rows (approx)
    const tw = tubeWeight(tubeOD, tubeWall, e.tubeLength * 1000, DENSITY.AL_5052);
    equipment.push({
      itemNumber: `${prefix}.4`,
      category: 'EVAPORATOR',
      description: `Al 5052 Tubes for ${effTag}`,
      tagNumber: `${effTag}-TUBE-AL`,
      quantity: mainTubes,
      unit: 'nos',
      material: 'Aluminium 5052',
      specification: `${tubeOD}mm OD × ${tubeWall}mm wall × ${e.tubeLength}m L`,
      netWeightKg: Math.round(tw * 100) / 100,
      wastagePercent: WASTAGE.TUBE * 100,
      grossWeightKg: Math.round(tw * (1 + WASTAGE.TUBE) * 100) / 100,
      totalWeightKg: Math.round(tw * (1 + WASTAGE.TUBE) * mainTubes),
      size: `${tubeOD}mm OD × ${tubeWall}mm × ${e.tubeLength * 1000}mm`,
      shapeType: 'TUBE_STRAIGHT',
    });

    // 5. Ti Gr2 Tubes (top 3 rows — erosion protection)
    const tiTubes = Math.min(3 * 27, e.tubes); // top 3 rows ≈ 3 × tubes per row
    const tiTw = tubeWeight(tubeOD, 0.4, e.tubeLength * 1000, DENSITY.TI_GR2);
    equipment.push({
      itemNumber: `${prefix}.5`,
      category: 'EVAPORATOR',
      description: `Ti Gr2 Tubes (top 3 rows) for ${effTag}`,
      tagNumber: `${effTag}-TUBE-TI`,
      quantity: tiTubes,
      unit: 'nos',
      material: 'Titanium SB 338 Gr 2',
      specification: `${tubeOD}mm OD × 0.4mm wall × ${e.tubeLength}m L`,
      netWeightKg: Math.round(tiTw * 100) / 100,
      wastagePercent: WASTAGE.TUBE * 100,
      grossWeightKg: Math.round(tiTw * (1 + WASTAGE.TUBE) * 100) / 100,
      totalWeightKg: Math.round(tiTw * (1 + WASTAGE.TUBE) * tiTubes),
      size: `${tubeOD}mm OD × 0.4mm × ${e.tubeLength * 1000}mm`,
      shapeType: 'TUBE_STRAIGHT',
      notes: 'Top 3 rows for spray erosion protection',
    });

    // 6. Rubber Grommets
    const gw = grommetWeight(holeDia, tubeOD);
    equipment.push({
      itemNumber: `${prefix}.6`,
      category: 'EVAPORATOR',
      description: `Rubber Grommets for ${effTag}`,
      tagNumber: `${effTag}-GROM`,
      quantity: e.tubes * 2, // 2 per tube (both tube sheets)
      unit: 'nos',
      material: 'EPDM Rubber',
      specification: `${holeDia}mm hole × ${tubeOD}mm tube`,
      netWeightKg: Math.round(gw * 1000) / 1000,
      wastagePercent: WASTAGE.GROMMET * 100,
      grossWeightKg: Math.round(gw * (1 + WASTAGE.GROMMET) * 1000) / 1000,
      totalWeightKg: Math.round(gw * (1 + WASTAGE.GROMMET) * e.tubes * 2 * 10) / 10,
      size: `ID ${tubeOD}mm × OD ${holeDia}mm`,
    });

    // 7. Demister Pad
    const demArea = result.auxiliaryEquipment.demisters[i]?.requiredArea ?? 0.5;
    const demWeight = demArea * 0.1 * DENSITY.SS316_MESH; // 100mm thick
    equipment.push({
      itemNumber: `${prefix}.7`,
      category: 'EVAPORATOR',
      description: `Wire Mesh Demister for ${effTag}`,
      tagNumber: `${effTag}-DEM`,
      quantity: 1,
      unit: 'nos',
      material: 'SS 316 Wire Mesh',
      specification: '100mm thick, wire mesh type',
      netWeightKg: Math.round(demWeight),
      wastagePercent: WASTAGE.DEMISTER * 100,
      grossWeightKg: Math.round(demWeight * (1 + WASTAGE.DEMISTER)),
      totalWeightKg: Math.round(demWeight * (1 + WASTAGE.DEMISTER)),
      size: `${demArea.toFixed(2)} m² × 100mm thick`,
    });

    // ── Instruments per effect ──
    instruments.push({
      tagNumber: `TT-${(i + 1).toString().padStart(2, '0')}01`,
      type: 'TT',
      service: `Brine Temperature ${effTag}`,
      location: `${effTag} shell, brine sump`,
      range: '0-80°C',
      connection: '½" NPT',
      material: 'Ti Gr2 thermowell',
    });

    instruments.push({
      tagNumber: `PT-${(i + 1).toString().padStart(2, '0')}01`,
      type: 'PT',
      service: `Shell Pressure ${effTag}`,
      location: `${effTag} shell, top`,
      range: '0-200 mbar abs',
      connection: '½" NPT',
      material: 'SS316L diaphragm',
    });

    instruments.push({
      tagNumber: `FT-${(i + 1).toString().padStart(2, '0')}01`,
      type: 'FT',
      service: `Spray Flow ${effTag}`,
      location: `${effTag} spray inlet line`,
      range: '0-15 m³/h',
      connection: 'Flanged, matching line size',
      material: 'SS316L',
    });

    // E1 brine siphon: TBT measurement
    if (i === 0) {
      instruments.push({
        tagNumber: 'TT-0102',
        type: 'TT',
        service: 'Top Brine Temperature (TBT)',
        location: 'E1 brine siphon outlet',
        range: '0-80°C',
        connection: '½" NPT',
        material: 'Ti Gr2 thermowell',
        notes: 'Critical — monitors TBT for scaling control',
      });
    }
  }

  // ── CONDENSER ────────────────────────────────────────────────────────
  const fc = result.condenser;
  const fcTag = 'FC-01';
  const fcShellOD = fc.shellODmm;
  const fcTubeLen = fc.tubeLengthMM;

  const fcSw = shellWeight(fcShellOD, shellThk, fcTubeLen + 500, DENSITY.SS316L); // +500 for waterbox
  equipment.push({
    itemNumber: '2.1',
    category: 'CONDENSER',
    description: 'Final Condenser Shell',
    tagNumber: fcTag,
    quantity: 1,
    unit: 'nos',
    material: 'SS 316L',
    specification: 'SA 240',
    netWeightKg: Math.round(fcSw),
    wastagePercent: WASTAGE.PLATE * 100,
    grossWeightKg: Math.round(fcSw * (1 + WASTAGE.PLATE)),
    totalWeightKg: Math.round(fcSw * (1 + WASTAGE.PLATE)),
    size: `OD ${fcShellOD}mm × ${fcTubeLen + 500}mm L × ${shellThk}mm thk`,
    shapeType: 'CYLINDRICAL_SHELL',
  });

  // FC Tubes
  const fcTw = tubeWeight(tiTubeOD, tiTubeWall, fcTubeLen, DENSITY.TI_GR2);
  equipment.push({
    itemNumber: '2.2',
    category: 'CONDENSER',
    description: 'Condenser Ti Tubes',
    tagNumber: `${fcTag}-TUBE`,
    quantity: fc.tubes,
    unit: 'nos',
    material: 'Titanium SB 338 Gr 2',
    specification: `${tiTubeOD}mm OD × ${tiTubeWall}mm wall × ${fcTubeLen}mm L`,
    netWeightKg: Math.round(fcTw * 100) / 100,
    wastagePercent: WASTAGE.TUBE * 100,
    grossWeightKg: Math.round(fcTw * (1 + WASTAGE.TUBE) * 100) / 100,
    totalWeightKg: Math.round(fcTw * (1 + WASTAGE.TUBE) * fc.tubes),
    size: `${tiTubeOD}mm OD × ${tiTubeWall}mm × ${fcTubeLen}mm`,
    shapeType: 'TUBE_STRAIGHT',
  });

  // FC Tube Sheets
  const fcTsw = tubeSheetWeight(fcShellOD, tubeSheetThk, DENSITY.SS316L);
  equipment.push({
    itemNumber: '2.3',
    category: 'CONDENSER',
    description: 'Condenser Tube Sheets',
    tagNumber: `${fcTag}-TS`,
    quantity: 2,
    unit: 'nos',
    material: 'SS 316L',
    specification: 'SA 240',
    netWeightKg: Math.round(fcTsw),
    wastagePercent: WASTAGE.PLATE * 100,
    grossWeightKg: Math.round(fcTsw * (1 + WASTAGE.PLATE)),
    totalWeightKg: Math.round(fcTsw * (1 + WASTAGE.PLATE) * 2),
    size: `OD ${fcShellOD}mm × ${tubeSheetThk}mm thk`,
    shapeType: 'TUBE_SHEET',
  });

  // ── PREHEATERS ───────────────────────────────────────────────────────
  for (let i = 0; i < result.preheaters.length; i++) {
    const ph = result.preheaters[i]!;
    const phTag = `PH-${(i + 1).toString().padStart(2, '0')}`;
    const phTubeLen = ph.tubeLengthMM;

    const phTw = tubeWeight(tiTubeOD, tiTubeWall, phTubeLen, DENSITY.TI_GR2);
    equipment.push({
      itemNumber: `3.${i + 1}.1`,
      category: 'PREHEATER',
      description: `Preheater ${phTag} Ti Tubes`,
      tagNumber: `${phTag}-TUBE`,
      quantity: ph.tubes,
      unit: 'nos',
      material: 'Titanium SB 338 Gr 2',
      specification: `${tiTubeOD}mm OD × ${tiTubeWall}mm wall × ${phTubeLen}mm L`,
      netWeightKg: Math.round(phTw * 100) / 100,
      wastagePercent: WASTAGE.TUBE * 100,
      grossWeightKg: Math.round(phTw * (1 + WASTAGE.TUBE) * 100) / 100,
      totalWeightKg: Math.round(phTw * (1 + WASTAGE.TUBE) * ph.tubes),
      size: `${tiTubeOD}mm OD × ${tiTubeWall}mm × ${phTubeLen}mm`,
      shapeType: 'TUBE_STRAIGHT',
    });
  }

  // ── PUMPS ────────────────────────────────────────────────────────────
  const pumpServices = result.auxiliaryEquipment.pumps;
  for (let i = 0; i < pumpServices.length; i++) {
    const pump = pumpServices[i]!;
    const pumpTag = `P-${(i + 1).toString().padStart(2, '0')}`;
    const isRecircPump = pump.service.toLowerCase().includes('recirc');
    const qty = pump.quantity;

    equipment.push({
      itemNumber: `4.${i + 1}`,
      category: 'PUMP',
      description: `${pump.service}`,
      tagNumber: pumpTag,
      quantity: parseInt(qty) || 2,
      unit: 'nos',
      material: isRecircPump ? 'Duplex SS' : 'SS316L',
      specification: `${pump.flowRateM3h.toFixed(1)} m³/h, ${pump.totalHead.toFixed(1)} m TDH, ${pump.motorPower} kW`,
      netWeightKg: 0, // bought-out, weight from vendor
      wastagePercent: 0,
      grossWeightKg: 0,
      totalWeightKg: 0,
      size: `${pump.motorPower} kW motor`,
      notes: isRecircPump ? 'With VFD for turndown' : undefined,
    });

    // Pump valves and fittings
    const pumpQty = parseInt(qty) || 2;
    for (let p = 0; p < pumpQty; p++) {
      const suffix = pumpQty > 1 ? String.fromCharCode(65 + p) : ''; // A, B

      // Suction isolation valve
      valves.push({
        tagNumber: `XV-${pumpTag}${suffix}-S`,
        type: 'GATE',
        size: 'Matching pump suction',
        rating: 'PN10',
        material: isRecircPump ? 'Duplex SS' : 'SS316L',
        service: `${pump.service} suction isolation`,
        location: `${pumpTag}${suffix} suction`,
      });

      // Suction strainer
      valves.push({
        tagNumber: `ST-${pumpTag}${suffix}`,
        type: 'GATE', // using GATE as placeholder for strainer
        size: 'Matching pump suction',
        rating: 'PN10',
        material: 'SS316L basket',
        service: `${pump.service} suction strainer`,
        location: `${pumpTag}${suffix} suction, after isolation`,
        notes: 'Y-type basket strainer, 1mm perforation',
      });

      // Discharge isolation valve
      valves.push({
        tagNumber: `XV-${pumpTag}${suffix}-D`,
        type: 'GATE',
        size: 'Matching pump discharge',
        rating: 'PN10',
        material: isRecircPump ? 'Duplex SS' : 'SS316L',
        service: `${pump.service} discharge isolation`,
        location: `${pumpTag}${suffix} discharge`,
      });

      // Non-return valve (discharge)
      valves.push({
        tagNumber: `NRV-${pumpTag}${suffix}`,
        type: 'NRV',
        size: 'Matching pump discharge',
        rating: 'PN10',
        material: isRecircPump ? 'Duplex SS' : 'SS316L',
        service: `${pump.service} discharge NRV`,
        location: `${pumpTag}${suffix} discharge, after isolation`,
      });

      // Pressure gauge (discharge)
      instruments.push({
        tagNumber: `PG-${pumpTag}${suffix}`,
        type: 'PT',
        service: `${pump.service} discharge pressure`,
        location: `${pumpTag}${suffix} discharge`,
        range: '0-6 bar',
        connection: '½" NPT',
        material: 'SS316L Bourdon tube',
        notes: 'Local pressure gauge for shutoff head check',
      });
    }
  }

  // ── HOLDUP TANKS ─────────────────────────────────────────────────────
  // Brine holdup tank with partition plate (at last effect)
  // Partition 1: receives brine cascade + SW make-up → recirc pump suction
  // Partition 2: overflow from P1 = brine reject (blowdown)
  equipment.push({
    itemNumber: '5.1',
    category: 'TANK',
    description: 'Brine Holdup Tank (with partition plate)',
    tagNumber: 'T-01',
    quantity: 1,
    unit: 'nos',
    material: 'Duplex SS UNS S32304',
    specification: 'Cylindrical, vertical, atmospheric, internal partition plate',
    netWeightKg: 250, // includes partition plate
    wastagePercent: WASTAGE.PLATE * 100,
    grossWeightKg: 275,
    totalWeightKg: 275,
    size: '~1.5 m³ (2 min holdup, split P1/P2)',
    notes:
      'P1: brine cascade + SW make-up mixing, recirc pump suction. P2: overflow = brine blowdown. Located below last effect.',
  });

  // Spray branch manual globe valves (one per effect for flow balancing)
  for (let i = 0; i < nEff; i++) {
    valves.push({
      tagNumber: `GV-SP-E${i + 1}`,
      type: 'GLOBE',
      size: 'DN50', // typical spray branch size
      rating: 'PN10',
      material: 'Duplex SS',
      service: `Effect ${i + 1} spray flow control`,
      location: `Spray branch to E${i + 1}`,
      notes: 'Manual globe valve, set at commissioning for required spray flow',
    });
  }

  // Brine tank instruments
  instruments.push({
    tagNumber: 'LT-T01',
    type: 'LT',
    service: 'Brine Holdup Level',
    location: 'T-01',
    range: '0-1000 mm',
    connection: 'Flanged',
    material: 'SS316L, differential pressure',
  });
  instruments.push({
    tagNumber: 'LSH-T01',
    type: 'LS',
    service: 'Brine Holdup High Level Switch',
    location: 'T-01, 80% level',
    range: 'On/Off',
    connection: 'Flanged',
    material: 'Magnetic float, SS316L',
    notes: 'Alarm: high level',
  });
  instruments.push({
    tagNumber: 'LSL-T01',
    type: 'LS',
    service: 'Brine Holdup Low Level Switch',
    location: 'T-01, 20% level',
    range: 'On/Off',
    connection: 'Flanged',
    material: 'Magnetic float, SS316L',
    notes: 'Trip: low level → stop recirc pump',
  });

  // Distillate holdup tank (at condenser)
  equipment.push({
    itemNumber: '5.2',
    category: 'TANK',
    description: 'Distillate Holdup Tank',
    tagNumber: 'T-02',
    quantity: 1,
    unit: 'nos',
    material: 'SS 316L',
    specification: 'Cylindrical, vertical, atmospheric',
    netWeightKg: 150,
    wastagePercent: WASTAGE.PLATE * 100,
    grossWeightKg: 165,
    totalWeightKg: 165,
    size: '~0.5 m³ (2 min holdup)',
    notes: 'Located below condenser, gravity feed to distillate pump',
  });

  instruments.push({
    tagNumber: 'LT-T02',
    type: 'LT',
    service: 'Distillate Holdup Level',
    location: 'T-02',
    range: '0-800 mm',
    connection: 'Flanged',
    material: 'SS316L, differential pressure',
  });
  instruments.push({
    tagNumber: 'LSH-T02',
    type: 'LS',
    service: 'Distillate High Level Switch',
    location: 'T-02, 80% level',
    range: 'On/Off',
    connection: 'Flanged',
    material: 'Magnetic float, SS316L',
  });
  instruments.push({
    tagNumber: 'LSL-T02',
    type: 'LS',
    service: 'Distillate Low Level Switch',
    location: 'T-02, 20% level',
    range: 'On/Off',
    connection: 'Flanged',
    material: 'Magnetic float, SS316L',
    notes: 'Trip: low level → stop distillate pump',
  });

  // ── PROCESS MEASUREMENT POINTS ──────────────────────────────────────
  // Seawater inlet
  instruments.push(
    {
      tagNumber: 'TT-SW-01',
      type: 'TT',
      service: 'Seawater Inlet Temperature',
      location: 'SW pump discharge header',
      range: '0-50°C',
      connection: '½" NPT',
      material: 'SS316L thermowell',
    },
    {
      tagNumber: 'CT-SW-01',
      type: 'CT',
      service: 'Seawater Inlet Conductivity',
      location: 'SW pump discharge header',
      range: '0-60,000 µS/cm',
      connection: 'Insertion type',
      material: 'Ti Gr2 electrode',
    },
    {
      tagNumber: 'FT-SW-01',
      type: 'FT',
      service: 'Seawater Inlet Flow',
      location: 'SW pump discharge header',
      range: `0-${Math.round(result.condenser.seawaterFlowM3h * 1.5)} m³/h`,
      connection: 'Flanged',
      material: 'SS316L, electromagnetic',
    }
  );

  // Reject brine
  instruments.push(
    {
      tagNumber: 'TT-BR-01',
      type: 'TT',
      service: 'Reject Brine Temperature',
      location: 'Brine blowdown pump discharge',
      range: '0-80°C',
      connection: '½" NPT',
      material: 'Ti Gr2 thermowell',
    },
    {
      tagNumber: 'CT-BR-01',
      type: 'CT',
      service: 'Reject Brine Conductivity',
      location: 'Brine blowdown pump discharge',
      range: '0-120,000 µS/cm',
      connection: 'Insertion type',
      material: 'Ti Gr2 electrode',
    },
    {
      tagNumber: 'FT-BR-01',
      type: 'FT',
      service: 'Reject Brine Flow',
      location: 'Brine blowdown pump discharge',
      range: `0-${Math.round(result.brineBlowdown * 1.5)} T/h`,
      connection: 'Flanged',
      material: 'SS316L, electromagnetic',
    }
  );

  // Distillate
  instruments.push(
    {
      tagNumber: 'TT-DI-01',
      type: 'TT',
      service: 'Distillate Temperature',
      location: 'Distillate pump discharge',
      range: '0-60°C',
      connection: '½" NPT',
      material: 'SS316L thermowell',
    },
    {
      tagNumber: 'CT-DI-01',
      type: 'CT',
      service: 'Distillate Conductivity',
      location: 'Distillate pump discharge',
      range: '0-100 µS/cm',
      connection: 'Insertion type',
      material: 'SS316L electrode',
      notes: 'Critical — monitors product purity',
    },
    {
      tagNumber: 'FT-DI-01',
      type: 'FT',
      service: 'Distillate Flow',
      location: 'Distillate pump discharge',
      range: `0-${Math.round(result.totalDistillate * 1.5)} T/h`,
      connection: 'Flanged',
      material: 'SS316L, electromagnetic',
    }
  );

  // ── VACUUM SYSTEM ─────────────────────────────────────────────────────
  if (result.vacuumSystem) {
    const vs = result.vacuumSystem;
    equipment.push({
      itemNumber: `${nEff + 3}.1`,
      category: 'MISCELLANEOUS',
      description: `Vacuum System — ${vs.trainConfig}`,
      tagNumber: 'VS-01',
      quantity: 1,
      unit: 'lot',
      material: 'SS316L / Cast Iron',
      specification: `NCG load: ${vs.totalDryNcgKgH.toFixed(1)} kg/h, Motive steam: ${Math.round(vs.totalMotiveSteamKgH)} kg/h`,
      netWeightKg: 0,
      wastagePercent: 0,
      grossWeightKg: 0,
      totalWeightKg: 0,
      size: `Last effect: ${Math.round(vs.lastEffectPressureMbar)} mbar`,
      notes: `Power: ${vs.totalPowerKW.toFixed(1)} kW. Evacuation: ${Math.round(vs.evacuationTimeMinutes)} min`,
    });
  }

  // ── CHEMICAL DOSING ──────────────────────────────────────────────────
  if (result.dosing) {
    const dos = result.dosing;
    equipment.push(
      {
        itemNumber: `${nEff + 4}.1`,
        category: 'MISCELLANEOUS',
        description: 'Anti-scalant Dosing Pump',
        tagNumber: 'DP-AS-01',
        quantity: 2,
        unit: 'nos',
        material: 'PVDF wetted parts',
        specification: `Flow: ${dos.chemicalFlowLh.toFixed(2)} L/h, Metering type`,
        netWeightKg: 15,
        wastagePercent: 0,
        grossWeightKg: 15,
        totalWeightKg: 30,
        size: dos.dosingLineOD,
        notes: '1 duty + 1 standby',
      },
      {
        itemNumber: `${nEff + 4}.2`,
        category: 'TANK',
        description: 'Anti-scalant Storage Tank',
        tagNumber: 'TK-AS-01',
        quantity: 1,
        unit: 'nos',
        material: 'HDPE',
        specification: `Volume: ${dos.storageTankM3.toFixed(2)} m³`,
        netWeightKg: Math.round(dos.storageTankM3 * 50),
        wastagePercent: 0,
        grossWeightKg: Math.round(dos.storageTankM3 * 50),
        totalWeightKg: Math.round(dos.storageTankM3 * 50),
        size: `${dos.storageTankM3.toFixed(2)} m³`,
        notes: `Monthly consumption: ${Math.round(dos.monthlyConsumptionKg)} kg`,
      }
    );
  }

  // ── SIPHON PIPING ────────────────────────────────────────────────────
  const siphons = result.auxiliaryEquipment?.siphons ?? [];
  for (let si = 0; si < siphons.length; si++) {
    const s = siphons[si]!;
    equipment.push({
      itemNumber: `${nEff + 5}.${si + 1}`,
      category: 'PIPING',
      description: `${s.fluidType === 'distillate' ? 'Distillate' : 'Brine'} Siphon E${s.fromEffect}→E${s.toEffect}`,
      tagNumber: `SP-${s.fluidType === 'distillate' ? 'D' : 'B'}-${s.fromEffect}${s.toEffect}`,
      quantity: 1,
      unit: 'nos',
      material: s.fluidType === 'distillate' ? 'SS316L' : 'Duplex 2205',
      specification: `${s.pipeSize}, Min height: ${s.minimumHeight.toFixed(3)} m`,
      netWeightKg: 0,
      wastagePercent: 10,
      grossWeightKg: 0,
      totalWeightKg: 0,
      size: s.pipeSize,
      notes: `Flow: ${s.flowRate.toFixed(2)} T/h, Velocity: ${s.velocity.toFixed(2)} m/s`,
    });
  }

  // ── LINE SIZING (HEADERS) ────────────────────────────────────────────
  const lines = result.auxiliaryEquipment?.lineSizing ?? [];
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li]!;
    equipment.push({
      itemNumber: `${nEff + 6}.${li + 1}`,
      category: 'PIPING',
      description: `${l.service} Header`,
      tagNumber: `LN-${li + 1}`,
      quantity: 1,
      unit: 'lot',
      material: 'Duplex 2205',
      specification: `${l.pipeSize} (${l.dn})`,
      netWeightKg: 0,
      wastagePercent: 10,
      grossWeightKg: 0,
      totalWeightKg: 0,
      size: `${l.pipeSize} ${l.dn}`,
      notes: `Flow: ${l.flowRate.toFixed(2)} T/h, Vel: ${l.velocity.toFixed(2)} m/s (${l.velocityStatus})`,
    });
  }

  // ── SHELL NOZZLES ────────────────────────────────────────────────────
  const nozzleSchedule = result.auxiliaryEquipment?.nozzleSchedule;
  if (nozzleSchedule && nozzleSchedule.nozzles.length > 0) {
    nozzleSchedule.nozzles.forEach((nz, ni) => {
      equipment.push({
        itemNumber: `${nEff + 7}.${ni + 1}`,
        category: 'MISCELLANEOUS',
        description: `${nz.service.replace(/_/g, ' ')} Nozzle — E${nz.effect}`,
        tagNumber: `NZ-${nz.effect}-${nz.service.slice(0, 2).toUpperCase()}`,
        quantity: 1,
        unit: 'nos',
        material: 'Duplex 2205',
        specification: `${nz.pipeSize} (${nz.dn})`,
        netWeightKg: 0,
        wastagePercent: 0,
        grossWeightKg: 0,
        totalWeightKg: 0,
        size: nz.pipeSize,
        notes: `Flow: ${nz.flowRate.toFixed(2)} T/h, Vel: ${nz.velocity.toFixed(2)} m/s (${nz.velocityStatus})`,
      });
    });
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────
  const totalWeight = equipment.reduce((s, e) => s + e.totalWeightKg, 0);
  const categorySummary = new Map<MEDBOMCategory, { items: number; weight: number }>();
  for (const item of equipment) {
    const cat = categorySummary.get(item.category) ?? { items: 0, weight: 0 };
    cat.items += item.quantity;
    cat.weight += item.totalWeightKg;
    categorySummary.set(item.category, cat);
  }

  // ── INSTRUMENT ACCESSORIES ─────────────────────────────────────────────
  // Convert the instrument schedule to InstrumentPoints and generate accessories
  let instrumentAccessories: InstrumentAccessoryBOM | undefined;
  try {
    const instPoints: InstrumentPoint[] = instruments.map((inst) => ({
      tagNumber: inst.tagNumber,
      type: inst.type as InstrumentPoint['type'],
      service: inst.service,
      location: inst.location,
      processFluid: inst.location.toLowerCase().includes('brine')
        ? 'brine'
        : inst.location.toLowerCase().includes('sw') || inst.location.toLowerCase().includes('sea')
          ? 'seawater'
          : inst.location.toLowerCase().includes('distill')
            ? 'distillate'
            : 'other',
    }));
    instrumentAccessories = generateInstrumentAccessories(instPoints);
  } catch {
    // Non-critical — accessory generation failure doesn't block the BOM
  }

  return {
    equipment,
    instruments,
    valves,
    instrumentAccessories,
    summary: {
      totalEquipmentItems: equipment.length,
      totalInstruments: instruments.length,
      totalValves: valves.length,
      totalWeight,
      categories: Array.from(categorySummary.entries()).map(([category, data]) => ({
        category,
        ...data,
      })),
    },
  };
}
