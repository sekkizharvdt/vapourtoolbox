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

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ProcessEquipmentInput {
  equipmentName: string;
  equipmentTag: string;
  operatingPressure: number;
  operatingTemperature: number;
  fluidIn: string[];
  fluidOut: string[];
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
