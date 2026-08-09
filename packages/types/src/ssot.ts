/**
 * SSOT (Single Source of Truth) Type Definitions
 *
 * Process Master Data for thermal desalination plants
 * Based on inputexcel.xlsx structure
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Fluid Types (from FluidList sheet)
// ============================================
export type FluidType =
  | 'SEA WATER'
  | 'BRINE WATER'
  | 'DISTILLATE WATER'
  | 'STEAM'
  | 'NCG'
  | 'FEED WATER';

export const FLUID_TYPES: FluidType[] = [
  'SEA WATER',
  'BRINE WATER',
  'DISTILLATE WATER',
  'STEAM',
  'NCG',
  'FEED WATER',
];

// Line tag prefix to fluid type mapping
export const LINE_TAG_FLUID_MAP: Record<string, FluidType> = {
  SW: 'SEA WATER',
  B: 'BRINE WATER',
  D: 'DISTILLATE WATER',
  S: 'STEAM',
  NCG: 'NCG',
  F: 'FEED WATER',
};

// ============================================
// Steam Region Type
// ============================================
export type SteamRegion = 'saturation' | 'subcooled' | 'superheated';

// ============================================
// Provenance — generated vs hand-entered records
// ============================================

/**
 * How an SSOT record came to exist.
 *
 * `MED_DESIGN` records are produced by the MED designer bridge and are
 * refreshed whenever the design is regenerated. `FLASH_CHAMBER` records come
 * from the standalone flash chamber calculator, which sizes vessels the MED
 * designer does not (flash vessels, and the brine and distillate holdup drums
 * that are flash chambers without heat transfer). `MANUAL` records are typed
 * by a user and are never touched by regeneration.
 *
 * The two generated sources are kept distinct so regeneration only refreshes
 * what its own calculator owns: re-running the MED design must not overwrite a
 * flash chamber's geometry, and vice versa.
 */
export type SSOTRecordSource = 'MANUAL' | 'MED_DESIGN' | 'FLASH_CHAMBER';

/**
 * Provenance metadata carried by every register that the MED designer can
 * populate (streams, equipment, lines).
 *
 * Regeneration contract:
 *   - `MANUAL` records are skipped entirely.
 *   - `MED_DESIGN` records have their calculated fields refreshed, EXCEPT any
 *     field listed in `manualOverrides` — those were edited by hand and win
 *     over the design permanently (until the user clears the override).
 *
 * Without this, a design revision would silently discard hand-entered line
 * numbers, remarks and tuned instrument ranges, and the generator would stop
 * being used after the first revision.
 */
export interface SSOTProvenance {
  /** Whether this record was generated or hand-entered */
  source: SSOTRecordSource;
  /**
   * Stable identity of the generated record, used to match it on regeneration.
   *
   * Matching on the visible identifier is not safe — line numbers carry a
   * sequence that shifts when the effect count changes, so a re-run would
   * create duplicates instead of updating. The key is derived from what the
   * record *is* (stream tag, equipment tag, or stream + route), not what it is
   * currently called.
   */
  generatedKey?: string;
  /** Saved-calculation id of the MED design this was generated from */
  sourceCalculationId?: string;
  /** Short human label for the source design, e.g. "8-effect MED, GOR 8.2" */
  sourceLabel?: string;
  /** When the record was last refreshed from the design */
  lastGeneratedAt?: Timestamp;
  /**
   * Field names the user has edited by hand. Regeneration must not overwrite
   * these. Keys match the field names on the record itself, e.g. `['lineNumber',
   * 'description']`.
   */
  manualOverrides?: string[];
}

// ============================================
// INPUT_DATA - Master Stream Data (195 rows)
// ============================================
export interface ProcessStream {
  id: string;
  projectId: string;

  // Core fields (from INPUT_DATA sheet)
  lineTag: string; // Col 1: SW1, SW2, D19, S13, etc.
  description?: string; // Col 2
  flowRateKgS: number; // Col 3: kg/s
  flowRateKgHr: number; // Col 4: kg/hr (calculated = kgs * 3600)
  pressureMbar: number; // Col 5: mbar(a)
  pressureBar: number; // Col 6: bar(a) (= mbar / 1000)
  temperature: number; // Col 7: °C
  density: number; // Col 8: kg/m³
  tds?: number; // Col 9: ppm (for seawater/brine)
  enthalpy: number; // Col 10: kJ/kg

  // Extended thermodynamic properties (calculated from steam/seawater tables)
  specificHeat?: number; // kJ/(kg·K) - Cp
  viscosity?: number; // Pa·s - dynamic viscosity
  thermalConductivity?: number; // W/(m·K) - for seawater
  entropy?: number; // kJ/(kg·K) - for steam
  boilingPointElevation?: number; // °C - for seawater/brine
  steamRegion?: SteamRegion; // For steam: saturation, subcooled, or superheated

  // Derived fields
  fluidType: FluidType; // Inferred from lineTag prefix: SW=SEA WATER, D=DISTILLATE, S=STEAM, etc.

  /** Generated-vs-manual provenance (absent on legacy hand-entered records = MANUAL) */
  provenance?: SSOTProvenance;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// Form input type (includes calculated fields for form submission)
export interface ProcessStreamInput {
  lineTag: string;
  description?: string;
  flowRateKgS: number;
  flowRateKgHr?: number; // Calculated: flowRateKgS * 3600
  pressureMbar: number;
  pressureBar?: number; // Calculated: pressureMbar / 1000
  temperature: number;
  tds?: number;
  fluidType: FluidType;
  density?: number; // Calculated from thermal properties
  enthalpy?: number; // Calculated from thermal properties
  // Extended thermodynamic properties (calculated)
  specificHeat?: number; // kJ/(kg·K) - Cp
  viscosity?: number; // Pa·s - dynamic viscosity
  thermalConductivity?: number; // W/(m·K) - for seawater
  entropy?: number; // kJ/(kg·K) - for steam
  boilingPointElevation?: number; // °C - for seawater/brine
  steamRegion?: SteamRegion; // For steam: saturation, subcooled, or superheated
  provenance?: SSOTProvenance;
}

// ============================================
// LIST_OF_EQUIPMENT (31 rows)
// ============================================
export interface ProcessEquipment {
  id: string;
  projectId: string;

  // Core fields
  equipmentName: string; // Col 1: Low Temperature Flash Vessel
  equipmentTag: string; // Col 2: LTFV, HTFV, MED-E1
  operatingPressure: number; // Col 3: mbar(a)
  operatingTemperature: number; // Col 4: °C

  // Fluid references (Line Tags from INPUT_DATA)
  fluidIn: string[]; // Col 5-9: Up to 5 inlet stream tags
  fluidOut: string[]; // Col 10-13: Up to 4 outlet stream tags

  // ── Geometry & inventory ─────────────────────────────────────────────
  // Populated by the MED designer bridge, and consumed by the external dynamic
  // simulator: liquid holdup sets the level and concentration time constants,
  // and metal mass sets how much of a startup transient the wall absorbs.
  //
  // This comment used to assert that "metal mass usually dominates how long
  // startup takes". That is false for the vessels this repo sizes, and it was
  // measured rather than argued: water's specific heat is about eight times
  // steel's, so a wall dominates a liquid-filled vessel only once its mass
  // exceeds roughly eight times the holdup. A 2 m x 4 m drum in 6 mm 316L is
  // 1.5 t against a threshold of ~35 t — the wall carries about 4% of the
  // liquid's heat capacity, and no realistic plate thickness changes that.
  //
  // The claim is true of MED EFFECTS, where a tube bundle sits under a thin
  // falling film and the ratio inverts. Stated generally it is the kind of
  // inherited generality that gets quoted about the wrong vessel and then
  // justifies calibrating the wrong parameter.
  /** Equipment class, used to group registers and drive simulator templates */
  equipmentType?: ProcessEquipmentType;
  /** Shell inside diameter in mm */
  shellIDmm?: number;
  /** Shell tangent-to-tangent length in mm */
  shellLengthMM?: number;
  /** Total internal (gross) volume in m³ */
  grossVolumeM3?: number;
  /** Normal operating liquid holdup in m³ */
  liquidHoldupM3?: number;
  /**
   * Dry metal mass in kg, as the weight estimate forms it:
   * shell + dished heads + tubesheets + tubes + water boxes + internals.
   *
   * READ `metalMassDerivation` BEFORE USING THIS. The total is a shipping and
   * costing figure and is the wrong quantity for a thermal model in three ways:
   * water boxes sit on the COOLANT side, outside the wall the process fluid
   * touches, so they are on the wrong side of both the wall-to-liquid and the
   * wall-to-ambient heat paths; and water boxes and internals are percentage
   * allowances on shell weight (15% and 10%), not computed parts.
   *
   * This comment previously read "(shell + tubesheets + bundle)" — three
   * components where the value carries five. A consumer had no way to know, and
   * a wrong thermal mass is close to undetectable downstream: it moves a time
   * constant, not an equilibrium, so a steady-state gate passes it with correct
   * units and a plausible magnitude. A field name and its doc comment are claims
   * about what a number IS; both were wrong here.
   */
  metalMassKg?: number;
  /**
   * How `metalMassKg` was arrived at.
   *
   * Present so a consumer can CHECK the figure rather than only compare it: a
   * total that disagrees is a multi-revision question, a derivation that
   * disagrees names its own culprit. Also records what the mass does and does
   * not include, since a support skirt is thermally remote from the contents
   * and inflating the wall capacity with one would be invisible in a total.
   */
  metalMassDerivation?: EquipmentMetalMassDerivation;
  /** Wetted wall area at normal operating level in m² */
  wettedAreaM2?: number;
  /** Total internal wall area, wetted plus dry, in m² */
  totalAreaM2?: number;
  /** Heat transfer area in m² (evaporator/condenser/preheater) */
  heatTransferAreaM2?: number;
  /** Centreline (or bottom tangent line) elevation above FFL in m */
  elevationM?: number;

  /** Generated-vs-manual provenance (absent on legacy hand-entered records = MANUAL) */
  provenance?: SSOTProvenance;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * How `metalMassKg` was arrived at, component by component.
 *
 * Present so a consumer can CHECK the figure rather than only compare it: a
 * total that disagrees is a multi-revision question, a derivation that disagrees
 * names its own culprit.
 *
 * The breakdown matters more than the total for a thermal model, because the
 * components are not equivalent. Shell, heads and tubesheets are computed from
 * geometry and sit in the process stream. Water boxes are on the COOLANT side —
 * a different thermal path. Water boxes and internals are percentage allowances
 * on the shell weight, not computed parts. A consumer wanting thermally-active
 * metal in contact with the contents should sum the components it wants rather
 * than take `metalMassKg` whole or discount it by a factor of its own invention.
 */
export interface EquipmentMetalMassDerivation {
  /** Metal grade key from METAL_PROPERTIES */
  material: string;
  /** Human-readable grade */
  materialLabel: string;
  /** Density used for the shell, heads and tubesheets, kg/m³ */
  densityKgM3: number;
  /** Wall thickness used, mm */
  wallThicknessMm: number;
  /**
   * Where the thickness came from.
   *
   * `assumed` means no calculation and no procurement record produced it. This
   * repo performs no external-pressure buckling check (ASME VIII Div 1 UG-28),
   * which is what actually sets plate on a vacuum vessel, alongside corrosion
   * allowance and minimum practical plate. A consumer must not treat an assumed
   * thickness as a design value, nor draw a conclusion resting on its magnitude.
   */
  wallThicknessSource: 'assumed' | 'user-input' | 'procurement-record' | 'calculated';
  /**
   * How the mass was formed.
   *
   * `component-breakdown` sums parts computed from geometry. `areal-allowance`
   * is a kg/m² rule of thumb against heat transfer area — a budgetary figure
   * with no geometry behind it, and not a basis for a thermal mass.
   */
  basis: 'component-breakdown' | 'areal-allowance';
  /** areal-allowance only: kg per m² of heat transfer area */
  kgPerM2?: number;
  /** areal-allowance only: the area the factor was applied to, m² */
  appliedToAreaM2?: number;
  /** component-breakdown only. Per-component masses in kg, summing to `metalMassKg`. */
  componentsKg?: {
    /** Cylindrical shell — computed from geometry */
    shell: number;
    /** Two 2:1 SE dished heads — computed from geometry */
    dishedHeads: number;
    /** Two tubesheets, approximated as solid plates — computed from geometry */
    tubeSheets: number;
    /** Tube bundle — computed from geometry and tube material density */
    tubes: number;
    /** Coolant-side water boxes — a percentage ALLOWANCE on shell weight */
    waterBoxes: number;
    /** Demisters, spray pipes, baffles — a percentage ALLOWANCE on shell weight */
    internals: number;
  };
  /** Which components are computed from geometry rather than allowances */
  computedFromGeometry?: string[];
  /** Which are percentage allowances, and the percentage used */
  percentageAllowances?: { component: string; percentOfShell: number }[];
  /** Anything deliberately outside the figure entirely */
  excludes: string[];
  /** Caveats a consumer must read before using the number */
  caveats?: string[];
}

/** Equipment classes the MED designer can emit */
export type ProcessEquipmentType =
  | 'EVAPORATOR_EFFECT'
  | 'CONDENSER'
  | 'PREHEATER'
  | 'FLASH_VESSEL'
  | 'PUMP'
  | 'EJECTOR'
  | 'VACUUM_PUMP'
  | 'DOSING_SKID'
  | 'THERMOCOMPRESSOR'
  | 'OTHER';

export interface ProcessEquipmentInput {
  equipmentName: string;
  equipmentTag: string;
  operatingPressure: number;
  operatingTemperature: number;
  fluidIn: string[];
  fluidOut: string[];
  // Geometry & inventory (optional — populated by the MED designer bridge)
  equipmentType?: ProcessEquipmentType;
  shellIDmm?: number;
  shellLengthMM?: number;
  grossVolumeM3?: number;
  liquidHoldupM3?: number;
  metalMassKg?: number;
  /**
   * How `metalMassKg` was arrived at.
   *
   * Was missing from this input type while `ProcessEquipment` carried it, so
   * `medDesignGenerator` wrote it only because a conditional spread bypasses
   * excess-property checking — the field reached Firestore unchecked. Rule 22:
   * every typed field must be writable on create.
   */
  metalMassDerivation?: EquipmentMetalMassDerivation;
  /** Wetted wall area at normal operating level in m² */
  wettedAreaM2?: number;
  /** Total internal wall area, wetted plus dry, in m² */
  totalAreaM2?: number;
  heatTransferAreaM2?: number;
  elevationM?: number;
  provenance?: SSOTProvenance;
}

// ============================================
// LIST OF LINES (214 rows)
// ============================================
export interface ProcessLine {
  id: string;
  projectId: string;
  sNo: number; // Col 1: S.No

  // Core fields
  lineNumber: string; // Col 2: 200-40-SS-SW-01
  fluid: string; // Col 3: Sea water
  inputDataTag: string; // Col 4: SW1, SW2 (ref to INPUT_DATA)

  // Flow data
  flowRateKgS: number; // Col 5: kg/s
  density: number; // Col 6: kg/m³

  // Pipe sizing (calculated)
  designVelocity: number; // Col 7: m/s (target velocity for sizing)
  calculatedID: number; // Col 8: mm (calculated from V = Q/A)
  selectedID: number; // Col 9: mm (actual pipe ID selected from pipe table)
  actualVelocity: number; // Col 10: m/s (recalculated with selected ID)

  // Additional fields
  pipeSize?: string; // e.g., "NB200", "NB100"
  schedule?: string; // e.g., "40", "80"

  /** Equipment tag this line runs from (for plant connectivity) */
  fromEquipmentTag?: string;
  /** Equipment tag this line runs to (for plant connectivity) */
  toEquipmentTag?: string;

  /** Generated-vs-manual provenance (absent on legacy hand-entered records = MANUAL) */
  provenance?: SSOTProvenance;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ProcessLineInput {
  sNo?: number;
  lineNumber: string;
  fluid: string;
  inputDataTag: string;
  flowRateKgS: number;
  density: number;
  designVelocity: number;
  calculatedID?: number; // Calculated from flow/velocity
  selectedID: number;
  actualVelocity?: number; // Calculated from flow/selectedID
  pipeSize?: string;
  schedule?: string;
  fromEquipmentTag?: string;
  toEquipmentTag?: string;
  provenance?: SSOTProvenance;
}

// ============================================
// LIST OF INSTRUMENTS (229 rows)
// ============================================
export interface ProcessInstrument {
  id: string;
  projectId: string;
  sNo: number; // Col 1

  // Core fields
  pidNo: string; // Col 2: SP40-01-03-001
  lineNo: string; // Col 3: 200-40-SS-SW-01
  tagNo: string; // Col 4: PIT-101, PG-101
  instrumentValveNo?: string; // Col 5: IV-101
  serviceLocation: string; // Col 6: Suction Side - Sea water pump
  instrumentType: string; // Col 7: Pressure Indicating Transmitter
  fluid: string; // Col 8: Sea water

  // Operating conditions - Pressure (mbar(a))
  pressureMin?: number; // Col 9
  pressureNor?: number; // Col 10
  pressureMax?: number; // Col 11

  // Operating conditions - Temperature (°C)
  temperatureMin?: number; // Col 12
  temperatureNor?: number; // Col 13
  temperatureMax?: number; // Col 14

  // Operating conditions - Flow rate (kg/hr)
  flowRateMin?: number; // Col 15
  flowRateNor?: number; // Col 16
  flowRateMax?: number; // Col 17

  // Operating conditions - TDS (ppm)
  tdsMin?: number; // Col 18
  tdsNor?: number; // Col 19
  tdsMax?: number; // Col 20

  // Instrument data
  instRange?: string; // Col 21
  type?: string; // Col 22
  endConnection?: string; // Col 23
  moc?: string; // Col 24: Material of Construction
  installation?: string; // Col 25
  accessories?: string; // Col 26
  hookupDiagram?: string; // Col 27

  // Signal type
  signalLocal?: string; // Col 28
  signalPLC?: string; // Col 29
  ioType?: string; // Col 30

  // Additional
  modelNo?: string; // Col 31
  accessoriesExtra?: string; // Col 32
  remarks?: string; // Col 33

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ProcessInstrumentInput {
  sNo?: number;
  pidNo: string;
  lineNo: string;
  tagNo: string;
  instrumentValveNo?: string;
  serviceLocation: string;
  instrumentType: string;
  fluid: string;
  pressureMin?: number;
  pressureNor?: number;
  pressureMax?: number;
  temperatureMin?: number;
  temperatureNor?: number;
  temperatureMax?: number;
  flowRateMin?: number;
  flowRateNor?: number;
  flowRateMax?: number;
  tdsMin?: number;
  tdsNor?: number;
  tdsMax?: number;
  instRange?: string;
  type?: string;
  endConnection?: string;
  moc?: string;
  installation?: string;
  accessories?: string;
  hookupDiagram?: string;
  signalLocal?: string;
  signalPLC?: string;
  ioType?: string;
  modelNo?: string;
  accessoriesExtra?: string;
  remarks?: string;
}

// ============================================
// LIST OF VALVES (264 rows)
// ============================================
export interface ProcessValve {
  id: string;
  projectId: string;
  sNo: number; // Col 1

  // Core fields
  pidNo: string; // Col 2: SP40-01-03-001
  lineNumber: string; // Col 3: 200-40-SS-SW-01
  valveTag: string; // Col 4: IV-101, BFV-101, MOV-101
  serviceLocation: string; // Col 5: PIT-101 - Isolation Valve
  valveType: string; // Col 6: BALL VALVE, BUTTERFLY
  endConnection: string; // Col 7: THREADED, FLANGED
  sizeNB: string; // Col 8: NB15, NB200
  fluid: string; // Col 9: Sea water

  // Operating conditions - Pressure (Bar)
  pressureMin?: number; // Col 10
  pressureNor?: number; // Col 11
  pressureMax?: number; // Col 12

  // Operating conditions - Temperature (°C)
  temperatureMin?: number; // Col 13
  temperatureNor?: number; // Col 14
  temperatureMax?: number; // Col 15

  // Operating conditions - Flow (m³/hr)
  flowMin?: number; // Col 16
  flowNor?: number; // Col 17
  flowMax?: number; // Col 18

  // Pressure drop
  deltaPressure?: number; // Col 19: bar

  // Valve data
  valveOperation?: string; // Col 20
  type?: string; // Col 21 (sub-type)
  endConnectionDetail?: string; // Col 22
  bodyMaterial?: string; // Col 23
  trimMaterial?: string; // Col 24
  seatMaterial?: string; // Col 25
  packingMaterial?: string; // Col 26
  leakageClass?: string; // Col 27

  // Signal type
  signalLocal?: string; // Col 28
  signalPLC?: string; // Col 29
  ioType?: string; // Col 30

  // Additional
  modelNo?: string; // Col 31
  accessories?: string; // Col 32
  remarks?: string; // Col 33

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ProcessValveInput {
  sNo?: number;
  pidNo: string;
  lineNumber: string;
  valveTag: string;
  serviceLocation: string;
  valveType: string;
  endConnection: string;
  sizeNB: string;
  fluid: string;
  pressureMin?: number;
  pressureNor?: number;
  pressureMax?: number;
  temperatureMin?: number;
  temperatureNor?: number;
  temperatureMax?: number;
  flowMin?: number;
  flowNor?: number;
  flowMax?: number;
  deltaPressure?: number;
  valveOperation?: string;
  type?: string;
  endConnectionDetail?: string;
  bodyMaterial?: string;
  trimMaterial?: string;
  seatMaterial?: string;
  packingMaterial?: string;
  leakageClass?: string;
  signalLocal?: string;
  signalPLC?: string;
  ioType?: string;
  modelNo?: string;
  accessories?: string;
  remarks?: string;
}

// Common valve types
export const VALVE_TYPES = [
  'BALL VALVE',
  'BUTTERFLY',
  'GATE VALVE',
  'GLOBE VALVE',
  'CHECK VALVE',
  'NON RETURN VALVE',
  'MOTORIZED GLOBE VALVE',
  'CONTROL VALVE',
  'SAFETY VALVE',
  'RELIEF VALVE',
] as const;

export const END_CONNECTIONS = ['THREADED', 'FLANGED', 'WELDED', 'SOCKET WELD'] as const;

// ============================================
// Pipe Table (19 rows) - Lookup table
// ============================================
export interface PipeSize {
  id: string;
  projectId: string;

  idRangeMin: number; // Col 1: ID range minimum (mm)
  idRangeMax: number; // Col 2: ID range maximum (mm)
  pipeSizeNB: number; // Col 3: Nominal Bore (15, 25, 40, etc.)
  outerDiameter: number; // Col 4: OD (mm)
  thicknessSch40: number; // Col 5: Wall thickness for Sch 40 (mm)

  // Calculated inner diameter
  innerDiameter: number; // OD - 2 * thickness

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
}

export interface PipeSizeInput {
  idRangeMin: number;
  idRangeMax: number;
  pipeSizeNB: number;
  outerDiameter: number;
  thicknessSch40: number;
}

// Standard pipe sizes (NB in mm)
export const STANDARD_PIPE_SIZES = [
  15, 25, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400,
] as const;

// ============================================
// Instrument Types
// ============================================
export const INSTRUMENT_TYPES = [
  'Pressure Indicating Transmitter',
  'Pressure Gauge',
  'Temperature Indicator',
  'Temperature Transmitter',
  'Flow Transmitter',
  'Flow Indicator',
  'Level Transmitter',
  'Level Indicator',
  'Level Switch',
  'Pressure Switch',
  'Temperature Switch',
  'Control Valve',
  'Analyzer',
] as const;

// ============================================
// SSOT Statistics
// ============================================
export interface SSOTStats {
  streamCount: number;
  equipmentCount: number;
  lineCount: number;
  instrumentCount: number;
  valveCount: number;
}
